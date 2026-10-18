import { supabase } from "@/lib/supabase";
import { diretorVirtualService } from "./diretorVirtualService";
import type { MetricaRobo, DecisaoDiretor, AcaoDecisao } from "./diretorVirtualService";

export type TipoEventoLive = "analise" | "decisao" | "acao" | "erro";

export interface EventoDiretorLive {
  id: string;
  tipo_evento: TipoEventoLive;
  robo_id: string | null;
  rotina_id: string | null;
  descricao: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ResultadoCiclo {
  metricasColetadas: number;
  decisoesGeradas: number;
  acoesExecutadas: number;
  erros: number;
  eventos: number;
  duracaoMs: number;
}

interface RotinaResumo {
  id: string;
  robo_id: string;
  nome: string;
  tipo: string;
  status: string;
  ativo: boolean;
  proxima_execucao: string | null;
  interval_seconds: number | null;
}

interface DecisaoInternal {
  origem: string;
  robo_id: string | null;
  rotina_id: string | null;
  tipo: "priorizacao" | "risco" | "falha" | "overload" | "oportunidade";
  descricao: string;
  impacto: "low" | "medium" | "high" | "critical";
  acao: AcaoDecisao;
  detalhes: Record<string, unknown>;
}

const TEMPO_MAXIMO_CICLO_MS = 10000;

function nowISO(): string {
  return new Date().toISOString();
}

export const diretorVirtualLiveService = {

  async registrarEvento(
    tipoEvento: TipoEventoLive,
    descricao: string,
    roboId: string | null = null,
    rotinaId: string | null = null,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await supabase.from("diretor_virtual_eventos_ia").insert({
      tipo_evento: tipoEvento,
      robo_id: roboId,
      rotina_id: rotinaId,
      descricao,
      payload,
    }).then().catch(() => {});
  },

  async listarEventos(limite = 100): Promise<EventoDiretorLive[]> {
    const { data } = await supabase
      .from("diretor_virtual_eventos_ia")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limite);
    return (data || []) as EventoDiretorLive[];
  },

  async listarMetricas(): Promise<MetricaRobo[]> {
    return diretorVirtualService.listarMetricas();
  },

  async processarDecisoesGlobais(modo: string = "semi_auto"): Promise<ResultadoCiclo> {
    const inicio = Date.now();

    const resultado: ResultadoCiclo = {
      metricasColetadas: 0,
      decisoesGeradas: 0,
      acoesExecutadas: 0,
      erros: 0,
      eventos: 0,
      duracaoMs: 0,
    };

    try {
      // 1. Coletar métricas globais do sistema
      const metricas = await diretorVirtualService.coletarMetricasSistema();
      resultado.metricasColetadas = metricas.length;

      await this.registrarEvento("analise", `Iniciando análise global: ${metricas.length} robôs monitorados`);

      const decisoesGeradas: DecisaoInternal[] = [];

      // 2. Buscar rotinas_ia para análise detalhada
      const { data: rotinas } = await supabase
        .from("rotinas_ia")
        .select("id, robo_id, nome, tipo, status, ativo, proxima_execucao, interval_seconds")
        .eq("ativo", true);
      const todasRotinas = (rotinas || []) as RotinaResumo[];

      const agora = nowISO();

      // 3. Identificar problemas por robô
      for (const m of metricas) {
        const rotinasDoRobo = todasRotinas.filter((r) => r.robo_id === m.robo_id);
        const rotinasAtrasadas = rotinasDoRobo.filter(
          (r) => r.proxima_execucao && r.proxima_execucao < agora && r.status !== "paused" && r.status !== "error"
        );

        // Sobrecarga (>80% load)
        if (m.carga_percentual > 80) {
          decisoesGeradas.push({
            origem: "live_engine",
            robo_id: m.robo_id,
            rotina_id: null,
            tipo: "overload",
            descricao: `[LIVE] Robô ${m.robo_nome || m.robo_id} com carga crítica de ${m.carga_percentual}% — reduzindo frequência`,
            impacto: m.carga_percentual > 90 ? "critical" : "high",
            acao: "redistribuir",
            detalhes: { carga: m.carga_percentual, rotinas: rotinasDoRobo.length, metricas: m },
          });
        }

        // Falhas repetidas
        if (m.falhas_24h >= 3) {
          decisoesGeradas.push({
            origem: "live_engine",
            robo_id: m.robo_id,
            rotina_id: null,
            tipo: "falha",
            descricao: `[LIVE] Robô ${m.robo_nome || m.robo_id} com ${m.falhas_24h} falhas em 24h — ${m.falhas_24h >= 5 ? "pausando rotinas" : "repriorizando"}`,
            impacto: m.falhas_24h >= 5 ? "critical" : "high",
            acao: m.falhas_24h >= 5 ? "pause" : "repriorizar",
            detalhes: { falhas: m.falhas_24h, execucoes: m.execucoes_24h },
          });
        }

        // Rotinas atrasadas com carga baixa (oportunidade)
        if (rotinasAtrasadas.length > 0 && m.carga_percentual < 50) {
          decisoesGeradas.push({
            origem: "live_engine",
            robo_id: m.robo_id,
            rotina_id: null,
            tipo: "oportunidade",
            descricao: `[LIVE] Robô ${m.robo_nome || m.robo_id} com ${rotinasAtrasadas.length} rotinas atrasadas e carga ${m.carga_percentual}% — acelerando execução`,
            impacto: "medium",
            acao: "repriorizar",
            detalhes: { atrasadas: rotinasAtrasadas.length, carga: m.carga_percentual },
          });
        }
      }

      // 4. Identificar gargalos sistêmicos (rotinas críticas)
      const rotinasCriticas = todasRotinas.filter((r) => {
        if (!r.proxima_execucao || r.status === "paused" || r.status === "error") return false;
        const atrasoMs = Date.now() - new Date(r.proxima_execucao).getTime();
        return atrasoMs > 3600000;
      });

      for (const r of rotinasCriticas.slice(0, 10)) {
        decisoesGeradas.push({
          origem: "live_engine",
          robo_id: r.robo_id,
          rotina_id: r.id,
          tipo: "risco",
          descricao: `[LIVE] Rotina "${r.nome}" atrasada há mais de 1h — priorizando urgente`,
          impacto: "high",
          acao: "repriorizar",
          detalhes: { rotina: r.nome, id: r.id },
        });
      }

      // 5. Detectar robôs com risco alto
      const altoRisco = metricas.filter((m) => m.risco_score > 70);
      for (const m of altoRisco) {
        await this.registrarEvento(
          "analise",
          `Robô ${m.robo_nome || m.robo_id} em estado crítico (risco ${m.risco_score})`,
          m.robo_id,
          null,
          { risco_score: m.risco_score, metricas: m },
        );
        resultado.eventos++;
      }

      // 6. Aplicar decisões no banco
      for (const d of decisoesGeradas) {
        try {
          const deveExecutar = modo === "auto" || (modo === "semi_auto" && (d.impacto === "low" || d.impacto === "medium"));

          const { data: dec } = await supabase.from("diretor_virtual_decisoes_ia").insert({
            origem: d.origem,
            robo_id: d.robo_id,
            tipo: d.tipo,
            descricao: d.descricao,
            impacto: d.impacto,
            acao: d.acao,
            detalhes: d.detalhes || {},
            status: deveExecutar ? "executed" : "pending",
            executado: deveExecutar,
            executado_em: deveExecutar ? nowISO() : null,
          }).select().single();

          if (dec) {
            resultado.decisoesGeradas++;

            await this.registrarEvento(
              "decisao",
              d.descricao,
              d.robo_id,
              d.rotina_id,
              { decisao_id: dec.id, tipo: d.tipo, acao: d.acao, impacto: d.impacto },
            );
            resultado.eventos++;

            if (deveExecutar) {
              try {
                await this.executarAcao(d, d.detalhes);
                resultado.acoesExecutadas++;

                await this.registrarEvento(
                  "acao",
                  `Ação "${d.acao}" executada para ${d.robo_id ? "robô" : "sistema"}`,
                  d.robo_id,
                  d.rotina_id,
                  { decisao_id: dec.id, acao: d.acao },
                );
                resultado.eventos++;
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
                resultado.erros++;

                await this.registrarEvento(
                  "erro",
                  `Falha ao executar ação "${d.acao}": ${errMsg}`,
                  d.robo_id,
                  d.rotina_id,
                  { decisao_id: dec.id, erro: errMsg },
                );
                resultado.eventos++;
              }
            }
          }
        } catch {
          resultado.erros++;
        }
      }

      // 7. Salvar métricas
      for (const m of metricas) {
        try {
          await diretorVirtualService.salvarMetrica(m);
        } catch {
          resultado.erros++;
        }
      }

      await this.registrarEvento("analise", `Ciclo concluído: ${resultado.decisoesGeradas} decisões, ${resultado.acoesExecutadas} ações`);

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Erro desconhecido no ciclo";
      resultado.erros++;
      await this.registrarEvento("erro", `Falha no ciclo de análise: ${errMsg}`, null, null, { erro: errMsg });
    }

    resultado.duracaoMs = Date.now() - inicio;
    return resultado;
  },

  async executarAcao(decisao: DecisaoInternal, detalhes: Record<string, unknown>): Promise<void> {
    if (!decisao.robo_id && !decisao.rotina_id) return;

    switch (decisao.acao) {
      case "pause": {
        if (decisao.robo_id) {
          await supabase.from("rotinas_ia").update({
            status: "paused", ativo: false,
          }).eq("robo_id", decisao.robo_id).in("status", ["pending", "success", "error"]);
        } else if (decisao.rotina_id) {
          await supabase.from("rotinas_ia").update({
            status: "paused", ativo: false,
          }).eq("id", decisao.rotina_id);
        }
        break;
      }
      case "resume": {
        if (decisao.robo_id) {
          await supabase.from("rotinas_ia").update({
            status: "pending", ativo: true, proxima_execucao: nowISO(),
          }).eq("robo_id", decisao.robo_id).eq("status", "paused");
        } else if (decisao.rotina_id) {
          await supabase.from("rotinas_ia").update({
            status: "pending", ativo: true, proxima_execucao: nowISO(),
          }).eq("id", decisao.rotina_id).eq("status", "paused");
        }
        break;
      }
      case "repriorizar": {
        if (decisao.rotina_id) {
          await supabase.from("rotinas_ia").update({
            proxima_execucao: new Date(Date.now() + 5000).toISOString(),
          }).eq("id", decisao.rotina_id);
        } else if (decisao.robo_id) {
          await supabase.from("rotinas_ia").update({
            proxima_execucao: nowISO(),
          }).eq("robo_id", decisao.robo_id).in("status", ["pending", "success", "error"]);
        }
        break;
      }
      case "redistribuir": {
        if (decisao.robo_id) {
          const { data: rotinas } = await supabase
            .from("rotinas_ia").select("id, interval_seconds")
            .eq("robo_id", decisao.robo_id).eq("ativo", true);
          if (rotinas) {
            for (const r of rotinas) {
              const novoIntervalo = Math.max(30, (r.interval_seconds || 60) + 60);
              await supabase.from("rotinas_ia").update({ interval_seconds: novoIntervalo }).eq("id", r.id);
            }
          }
        }
        break;
      }
      case "escalar": {
        await supabase.from("automacoes_tarefas").insert({
          robo_id: decisao.robo_id,
          setor: "TI / Governança",
          tipo_tarefa: "escalar_falha_diretor_virtual",
          titulo: `[Diretor Virtual Live] Alerta automático`,
          descricao: detalhes.descricao ? String(detalhes.descricao) : `Sistema detectou condição crítica`,
          prioridade: "alta",
          status: "pendente",
          payload: detalhes,
        });
        break;
      }
    }
  },

  getTempoMaximoCiclo(): number {
    return TEMPO_MAXIMO_CICLO_MS;
  },
};

export default diretorVirtualLiveService;
