import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { governancaService } from "@/services/ia/governancaService";
import { identidadeService } from "@/services/ia/identidadeService";
import { cognitivoPlannerService } from "@/services/ia/cognitivoPlannerService";
import { externalIntegrationEngine } from "@/services/ia/externalIntegrationEngine";
import { performanceEngineService } from "@/services/ia/performanceEngineService";
import { memoriaService } from "@/services/ia/memoriaService";
import { diretorVirtualService } from "@/services/ia/diretorVirtualService";
import { comunicacaoEntreRobosService } from "@/services/ia/comunicacaoEntreRobosService";
import { workforceOrchestratorService } from "@/services/ia/workforceOrchestratorService";
import type { TipoEntidade } from "@/services/ia/memoriaService";

export type TipoFluxo = "comercial" | "financeiro" | "operacional" | "rh" | "marketing";
export type StatusFluxoExecucao = "pendente" | "em_andamento" | "concluido" | "falhou" | "bloqueado" | "cancelado";

export interface IaFluxoEmpresa {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: TipoFluxo;
  codigo: string;
  versao: number;
  ativo: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IaFluxoEtapa {
  id: string;
  fluxo_id: string;
  ordem: number;
  nome: string;
  descricao: string | null;
  origem_robo_id: string | null;
  destino_robo_id: string | null;
  setor_origem: string | null;
  setor_destino: string | null;
  acao_codigo: string | null;
  acao_payload: Record<string, unknown>;
  condicoes: Record<string, unknown>;
  timeout_segundos: number;
  created_at: string;
  updated_at: string;
}

export interface IaFluxoExecucaoLog {
  id: string;
  fluxo_id: string | null;
  fluxo_codigo: string;
  fluxo_nome: string;
  etapa_id: string | null;
  etapa_ordem: number;
  etapa_nome: string;
  robo_origem_id: string | null;
  robo_destino_id: string | null;
  fluxo_execucao_id: string;
  status: StatusFluxoExecucao;
  pipeline: Record<string, unknown>;
  decisao_f34a: string | null;
  risco_calculado: number;
  aprovado_f35: boolean | null;
  identidade_f36: string | null;
  resultado_f37: Record<string, unknown>;
  impacto_f38: Record<string, unknown>;
  memoria_f33: Record<string, unknown>;
  decisao_f27: Record<string, unknown>;
  erro: string | null;
  inicio_execucao: string;
  fim_execucao: string | null;
  duracao_ms: number;
  created_at: string;
}

export interface ResultadoEtapa {
  status: "concluido" | "falhou" | "bloqueado";
  pipeline: Record<string, unknown>;
  risco_calculado: number;
  aprovado_f35: boolean;
  decisao_f34a: string;
  identidade_f36: string;
  resultado_f37: Record<string, unknown>;
  impacto_f38: Record<string, unknown>;
  memoria_f33: Record<string, unknown>;
  decisao_f27: Record<string, unknown>;
  erro?: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function calcularRiscoPorValor(valor?: number): number {
  if (!valor || valor <= 0) return 10;
  if (valor > 50000) return 90;
  if (valor > 10000) return 70;
  if (valor > 5000) return 50;
  if (valor > 1000) return 30;
  return 15;
}

export const enterpriseOrchestratorService = {

  // ==================== LISTAR FLUXOS ====================
  async listarFluxos(filtros?: { tipo?: TipoFluxo; ativo?: boolean }): Promise<IaFluxoEmpresa[]> {
    let query = supabase.from("ia_fluxos_empresa").select("*").order("tipo").order("nome");
    if (filtros?.tipo) query = query.eq("tipo", filtros.tipo);
    if (filtros?.ativo !== undefined) query = query.eq("ativo", filtros.ativo);
    const { data } = await query;
    return (data || []) as IaFluxoEmpresa[];
  },

  async obterFluxoCompleto(fluxoId: string): Promise<{
    fluxo: IaFluxoEmpresa | null;
    etapas: IaFluxoEtapa[];
  }> {
    const [fluxo, etapas] = await Promise.all([
      supabase.from("ia_fluxos_empresa").select("*").eq("id", fluxoId).maybeSingle(),
      supabase.from("ia_fluxos_etapas").select("*").eq("fluxo_id", fluxoId).order("ordem"),
    ]);
    return {
      fluxo: (fluxo.data || null) as IaFluxoEmpresa | null,
      etapas: (etapas.data || []) as IaFluxoEtapa[],
    };
  },

  async obterFluxoPorCodigo(codigo: string): Promise<{
    fluxo: IaFluxoEmpresa | null;
    etapas: IaFluxoEtapa[];
  }> {
    const { data: fluxo } = await supabase.from("ia_fluxos_empresa").select("*").eq("codigo", codigo).maybeSingle();
    if (!fluxo) return { fluxo: null, etapas: [] };
    return this.obterFluxoCompleto(fluxo.id);
  },

  // ==================== ETAPAS ====================
  async criarEtapa(dados: {
    fluxo_id: string;
    ordem: number;
    nome: string;
    descricao?: string;
    setor_origem?: string;
    setor_destino?: string;
    acao_codigo?: string;
    acao_payload?: Record<string, unknown>;
    condicoes?: Record<string, unknown>;
    timeout_segundos?: number;
  }): Promise<IaFluxoEtapa | null> {
    const { data } = await supabase.from("ia_fluxos_etapas").insert({
      fluxo_id: dados.fluxo_id,
      ordem: dados.ordem,
      nome: dados.nome,
      descricao: dados.descricao || null,
      setor_origem: dados.setor_origem || null,
      setor_destino: dados.setor_destino || null,
      acao_codigo: dados.acao_codigo || null,
      acao_payload: dados.acao_payload || {},
      condicoes: dados.condicoes || {},
      timeout_segundos: dados.timeout_segundos || 300,
    }).select().single();
    return data as IaFluxoEtapa | null;
  },

  // ==================== EXECUÇÃO PRINCIPAL (FASE 2) ====================

  async executarFluxoEmpresa(
    fluxoId: string,
    contextoInicial: Record<string, unknown> = {},
  ): Promise<{
    sucesso: boolean;
    fluxo_execucao_id: string;
    total_etapas: number;
    concluidas: number;
    logs: IaFluxoExecucaoLog[];
    erro?: string;
  }> {
    const { fluxo, etapas } = await this.obterFluxoCompleto(fluxoId);

    if (!fluxo) {
      return { sucesso: false, fluxo_execucao_id: "", total_etapas: 0, concluidas: 0, logs: [], erro: "Fluxo não encontrado" };
    }

    if (!fluxo.ativo) {
      return { sucesso: false, fluxo_execucao_id: "", total_etapas: 0, concluidas: 0, logs: [], erro: "Fluxo inativo" };
    }

    if (etapas.length === 0) {
      return { sucesso: false, fluxo_execucao_id: "", total_etapas: 0, concluidas: 0, logs: [], erro: "Fluxo sem etapas" };
    }

    const fluxoExecucaoId = uuid();
    const pipelineContext: Record<string, unknown> = { ...contextoInicial, fluxo_execucao_id: fluxoExecucaoId };
    const logs: IaFluxoExecucaoLog[] = [];
    let concluidas = 0;
    let fluxoBloqueado = false;

    for (const etapa of etapas) {
      if (fluxoBloqueado) break;

      const resultado = await this.executarEtapaPipeline(etapa, fluxo, fluxoExecucaoId, pipelineContext);
      logs.push(resultado);

      if (resultado.status === "bloqueado") {
        fluxoBloqueado = true;
        break;
      }

      if (resultado.status === "concluido") {
        concluidas++;
        pipelineContext[`etapa_${etapa.ordem}_resultado`] = resultado;
      }

      // FASE 8: Notifica Diretor Virtual sobre o progresso
      if (resultado.status === "falhou") {
        try {
          await diretorVirtualService.registrarDecisao({
            origem: "enterprise_orchestrator",
            robo_id: etapa.destino_robo_id || undefined,
            tipo: "falha",
            descricao: `Etapa ${etapa.ordem} - ${etapa.nome} falhou no fluxo ${fluxo.codigo}: ${resultado.erro || "sem detalhes"}`,
            impacto: "high",
            acao: "repriorizar",
            detalhes: { fluxo_id: fluxoId, fluxo_codigo: fluxo.codigo, etapa_ordem: etapa.ordem, erro: resultado.erro },
          });
        } catch { /* DV indisponivel */ }
      }
    }

    // Diretor Virtual analisa gargalos após fluxo
    try {
      const metricas = await diretorVirtualService.coletarMetricasSistema();
      const gargalos = metricas.filter(m => m.carga_percentual > 80);
      if (gargalos.length > 0) {
        for (const g of gargalos) {
          void diretorVirtualService.registrarDecisao({
            origem: "enterprise_orchestrator",
            robo_id: g.robo_id,
            tipo: "overload",
            descricao: `[Pós-fluxo ${fluxo.codigo}] Robô ${g.robo_nome || g.robo_id} com carga de ${g.carga_percentual}%`,
            impacto: g.carga_percentual > 90 ? "critical" : "high",
            acao: "redistribuir",
            detalhes: { fluxo_codigo: fluxo.codigo, carga: g.carga_percentual },
          });
        }
      }
    } catch { /* DV indisponivel */ }

    // Auditoria final
    void centralIaService.registrarLog({
      acao: "fluxo_empresa_executado",
      entrada: { fluxo_codigo: fluxo.codigo, total_etapas: etapas.length, concluidas },
      saida: { fluxo_execucao_id: fluxoExecucaoId, status: fluxoBloqueado ? "bloqueado" : concluidas === etapas.length ? "concluido" : "parcial" },
      status: fluxoBloqueado ? "erro" : concluidas === etapas.length ? "sucesso" : "aviso",
    });

    return {
      sucesso: concluidas === etapas.length,
      fluxo_execucao_id: fluxoExecucaoId,
      total_etapas: etapas.length,
      concluidas,
      logs,
    };
  },

  // ==================== PIPELINE POR ETAPA (FASE 2) ====================

  async executarEtapaPipeline(
    etapa: IaFluxoEtapa,
    fluxo: IaFluxoEmpresa,
    fluxoExecucaoId: string,
    contextoGlobal: Record<string, unknown>,
  ): Promise<IaFluxoExecucaoLog> {
    const inicio = Date.now();
    const pipeline: Record<string, unknown> = {};
    const roboDestino = etapa.destino_robo_id || "";
    const riscoPadrao = (fluxo.config?.risco_padrao as string) || "medio";

    const logBase = {
      fluxo_id: fluxo.id,
      fluxo_codigo: fluxo.codigo,
      fluxo_nome: fluxo.nome,
      etapa_id: etapa.id,
      etapa_ordem: etapa.ordem,
      etapa_nome: etapa.nome,
      robo_origem_id: etapa.origem_robo_id,
      robo_destino_id: etapa.destino_robo_id,
      fluxo_execucao_id: fluxoExecucaoId,
    };

    try {
      // ========== 1. GOVERNANÇA (F35) ==========
      let aprovadoF35 = true;
      let riscoCalculado = 0;
      let decisaoF34a = "";
      let identidadeF36 = "";
      let resultadoF37: Record<string, unknown> = {};
      let impactoF38: Record<string, unknown> = {};
      let memoriaF33: Record<string, unknown> = {};
      let decisaoF27: Record<string, unknown> = {};

      if (roboDestino) {
        const valorAcao = (etapa.acao_payload?.valor_financeiro as number) || (contextoGlobal.valor as number) || 0;

        // F35
        try {
          const avaliacao = await governancaService.avaliarAcao({
            roboId: roboDestino,
            acaoTipo: `${etapa.acao_codigo || etapa.setor_destino || "etapa"}_${etapa.ordem}`,
            valor: valorAcao,
            contexto: { ...contextoGlobal, fluxo_codigo: fluxo.codigo, etapa_ordem: etapa.ordem },
          });
          pipeline.f35_avaliacao = avaliacao;
          aprovadoF35 = avaliacao.permitido;

          if (!avaliacao.permitido && !avaliacao.precisa_aprovacao) {
            throw new Error(`BLOQUEADO_POR_GOVERNANCA: ${avaliacao.motivo}`);
          }

          if (avaliacao.precisa_aprovacao && avaliacao.aprovacao_fila_id) {
            pipeline.f35_aprovacao_pendente = true;
            pipeline.f35_aprovacao_id = avaliacao.aprovacao_fila_id;
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.message.startsWith("BLOQUEADO_POR_GOVERNANCA")) {
            const duracao = Date.now() - inicio;
            const log: IaFluxoExecucaoLog = {
              ...logBase as IaFluxoExecucaoLog,
              id: uuid(),
              status: "bloqueado",
              pipeline: { ...pipeline, f35_erro: err.message },
              decisao_f34a: null,
              risco_calculado: calcularRiscoPorValor(valorAcao),
              aprovado_f35: false,
              identidade_f36: null,
              resultado_f37: {},
              impacto_f38: {},
              memoria_f33: {},
              decisao_f27: {},
              erro: err.message,
              inicio_execucao: new Date(inicio).toISOString(),
              fim_execucao: nowISO(),
              duracao_ms: duracao,
              created_at: nowISO(),
            };
            await supabase.from("ia_fluxos_execucao_log").insert(log);
            return log;
          }
          pipeline.f35_erro = err instanceof Error ? err.message : "Erro F35";
        }

        // F36
        try {
          const identidade = await identidadeService.obterIdentidade(roboDestino);
          if (identidade) {
            identidadeF36 = `perfil=${identidade.perfil}, status=${identidade.status}, timezone=${identidade.timezone}`;
            pipeline.f36_identidade = { id: identidade.id, perfil: identidade.perfil, status: identidade.status };

            if (identidade.status === "bloqueada" || identidade.status === "inativa") {
              throw new Error(`BLOQUEADO_POR_IDENTIDADE: Robô ${identidade.nome_operacional} está ${identidade.status}`);
            }
          } else {
            identidadeF36 = "nao_configurada";
            pipeline.f36_identidade = { status: "nao_configurada" };
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.message.startsWith("BLOQUEADO_POR_IDENTIDADE")) {
            const duracao = Date.now() - inicio;
            const log: IaFluxoExecucaoLog = {
              ...logBase as IaFluxoExecucaoLog,
              id: uuid(),
              status: "bloqueado",
              pipeline,
              decisao_f34a: null,
              risco_calculado: calcularRiscoPorValor(valorAcao),
              aprovado_f35,
              identidade_f36: err.message,
              resultado_f37: {},
              impacto_f38: {},
              memoria_f33: {},
              decisao_f27: {},
              erro: err.message,
              inicio_execucao: new Date(inicio).toISOString(),
              fim_execucao: nowISO(),
              duracao_ms: Date.now() - inicio,
              created_at: nowISO(),
            };
            await supabase.from("ia_fluxos_execucao_log").insert(log);
            return log;
          }
          pipeline.f36_erro = err instanceof Error ? err.message : "Erro F36";
        }

        // F34A
        try {
          const planejamento = await cognitivoPlannerService.planejar({
            roboId: roboDestino,
            objetivo: `Executar etapa "${etapa.nome}" do fluxo ${fluxo.codigo}: ${etapa.descricao || ""}`,
            entidadeTipo: (contextoGlobal.entidade_tipo as TipoEntidade) || "cliente",
            entidadeId: (contextoGlobal.entidade_id as string) || "sistema",
          });
          pipeline.f34a_planejamento = planejamento;
          if (planejamento.sucesso && planejamento.plano) {
            decisaoF34a = `Plano: ${planejamento.plano.etapas.length} etapa(s), risco=${planejamento.plano.etapas[0]?.risco || riscoPadrao}, origem=${planejamento.origem}`;
            pipeline.f34a_decisao = { plano_etapas: planejamento.plano.etapas.length, risco: planejamento.plano.etapas[0]?.risco, origem: planejamento.origem };
          } else {
            decisaoF34a = `Indisponível: ${planejamento.erro || "sem plano"}`;
            pipeline.f34a_decisao = { erro: planejamento.erro, origem: planejamento.origem };
          }
        } catch (err: unknown) {
          decisaoF34a = `Erro: ${err instanceof Error ? err.message : "indisponível"}`;
          pipeline.f34a_erro = err instanceof Error ? err.message : "Erro F34A";
        }

        // F37
        try {
          const acao = etapa.acao_codigo || `${etapa.setor_destino || "operacao"}`;
          const [canalDetectado, acaoDetectada] = acao.includes("_")
            ? [acao.split("_")[0].toLowerCase(), acao.split("_").slice(1).join("_")]
            : ["api_externa", acao.toLowerCase()];

          const canaisValidos = ["whatsapp", "email", "zoho_mail", "crm", "leads", "google_ads", "meta_ads", "api_externa", "webhook"] as const;
          const canal = canaisValidos.includes(canalDetectado as typeof canaisValidos[number])
            ? (canalDetectado as typeof canaisValidos[number])
            : "api_externa";

          const resultadoIntegracao = await externalIntegrationEngine.executarIntegracao({
            roboId: roboDestino,
            intencao: {
              canal,
              acao: acaoDetectada,
              payload: { ...etapa.acao_payload, ...contextoGlobal, fluxo: fluxo.codigo, etapa: etapa.nome } as Record<string, unknown>,
              entidade_tipo: contextoGlobal.entidade_tipo as string || "cliente",
              entidade_id: contextoGlobal.entidade_id as string || "sistema",
            },
          });

          resultadoF37 = {
            sucesso: resultadoIntegracao.sucesso,
            status: resultadoIntegracao.status,
            canal: resultadoIntegracao.canal,
            acao: resultadoIntegracao.acao,
            payload_mockado: resultadoIntegracao.payload_mockado,
            log_id: resultadoIntegracao.log_id,
          };
          pipeline.f37_integracao = resultadoIntegracao;
        } catch (err: unknown) {
          resultadoF37 = { sucesso: false, status: "erro", erro: err instanceof Error ? err.message : "Erro F37" };
          pipeline.f37_erro = err instanceof Error ? err.message : "Erro F37";
        }

        // F38
        try {
          const valorKPI = resultadoF37.sucesso ? 100 : 0;
          const kpis = await performanceEngineService.listarKpis(roboDestino);
          if (kpis.length > 0) {
            for (const kpi of kpis.slice(0, 2)) {
              const novoValor = Math.min(100, Math.max(0, kpi.valor_atual + (resultadoF37.sucesso ? 5 : -10)));
              await performanceEngineService.atualizarKpi(kpi.id, { valor_atual: novoValor });
            }
            impactoF38 = { status: resultadoF37.sucesso ? "positivo" : "negativo", kpis_atualizados: Math.min(2, kpis.length) };
          } else {
            impactoF38 = { status: "sem_kpis" };
          }
          pipeline.f38_performance = impactoF38;
        } catch (err: unknown) {
          impactoF38 = { status: "erro", erro: err instanceof Error ? err.message : "Erro F38" };
          pipeline.f38_erro = err instanceof Error ? err.message : "Erro F38";
        }

        // F33
        try {
          const eventoMemoria = await memoriaService.registrarEvento({
            robo_id: roboDestino,
            entidade_tipo: (contextoGlobal.entidade_tipo as TipoEntidade) || "cliente",
            entidade_id: (contextoGlobal.entidade_id as string) || "sistema",
            tipo_evento: resultadoF37.sucesso ? "contratacao" : "cancelamento",
            titulo: `[Fluxo ${fluxo.codigo}] Etapa ${etapa.ordem}: ${etapa.nome}`,
            descricao: `Status: ${resultadoF37.sucesso ? "Concluído" : "Falhou"}. Ação: ${etapa.acao_codigo || "N/A"}. Canal: ${resultadoF37.canal || "N/A"}.`,
            metadata: { fluxo_codigo: fluxo.codigo, fluxo_execucao_id: fluxoExecucaoId, etapa_ordem: etapa.ordem, resultado_integracao: resultadoF37 },
            escopo: "compartilhada",
          });
          memoriaF33 = { evento_id: eventoMemoria?.id, registrado: !!eventoMemoria };
          pipeline.f33_memoria = memoriaF33;
        } catch (err: unknown) {
          memoriaF33 = { erro: err instanceof Error ? err.message : "Erro F33" };
          pipeline.f33_erro = err instanceof Error ? err.message : "Erro F33";
        }

        // Risco calculado
        riscoCalculado = calcularRiscoPorValor(valorAcao);
        if (decisaoF34a.includes("risco=alto")) riscoCalculado = Math.max(riscoCalculado, 60);
        if (decisaoF34a.includes("risco=critico")) riscoCalculado = Math.max(riscoCalculado, 85);
      } else {
        // Etapa sem robô destino — apenas log
        pipeline.sem_robo_destino = true;
      }

      // F27: Diretor Virtual analisa gargalos pós-etapa
      try {
        const metricas = await diretorVirtualService.coletarMetricasSistema();
        const gargalosEncontrados = metricas.filter(m => m.carga_percentual > 80 || m.falhas_24h >= 3);
        if (gargalosEncontrados.length > 0) {
          decisaoF27 = {
            gargalos: gargalosEncontrados.map(g => ({
              robo_id: g.robo_id,
              carga: g.carga_percentual,
              falhas: g.falhas_24h,
            })),
            total_gargalos: gargalosEncontrados.length,
          };
          pipeline.f27_gargalos = decisaoF27;
        }
      } catch { /* DV indisponivel */ }

      const duracao = Date.now() - inicio;
      const statusFinal: "concluido" | "falhou" = resultadoF37.sucesso !== false ? "concluido" : "falhou";

      const log: IaFluxoExecucaoLog = {
        ...logBase as IaFluxoExecucaoLog,
        id: uuid(),
        status: statusFinal,
        pipeline,
        decisao_f34a: decisaoF34a || null,
        risco_calculado: riscoCalculado,
        aprovado_f35: aprovadoF35,
        identidade_f36: identidadeF36 || null,
        resultado_f37: resultadoF37,
        impacto_f38: impactoF38,
        memoria_f33: memoriaF33,
        decisao_f27: decisaoF27,
        erro: null,
        inicio_execucao: new Date(inicio).toISOString(),
        fim_execucao: nowISO(),
        duracao_ms: duracao,
        created_at: nowISO(),
      };

      await supabase.from("ia_fluxos_execucao_log").insert(log);

      // Comunicação entre robôs (F28) quando há transição de setor
      if (etapa.origem_robo_id && etapa.destino_robo_id && etapa.origem_robo_id !== etapa.destino_robo_id) {
        try {
          const origemNome = etapa.setor_origem || "setor_anterior";
          const destinoNome = etapa.setor_destino || "setor_proximo";
          await comunicacaoEntreRobosService.enviarMensagem(
            etapa.origem_robo_id,
            etapa.destino_robo_id,
            statusFinal === "concluido" ? "delegacao" : "alerta",
            `[Fluxo ${fluxo.codigo}] Etapa ${etapa.ordem}: ${etapa.nome}`,
            `Transição de ${origemNome} para ${destinoNome}. Status: ${statusFinal}.`,
            { fluxo_codigo: fluxo.codigo, fluxo_execucao_id: fluxoExecucaoId, etapa_ordem: etapa.ordem, status: statusFinal },
            statusFinal === "concluido" ? "medium" : "high",
          );
        } catch { /* comunicacao indisponivel */ }
      }

      return log;

    } catch (err: unknown) {
      const duracao = Date.now() - inicio;
      const erroMsg = err instanceof Error ? err.message : "Erro desconhecido na pipeline";

      const log: IaFluxoExecucaoLog = {
        ...logBase as IaFluxoExecucaoLog,
        id: uuid(),
        status: "falhou",
        pipeline,
        decisao_f34a: null,
        risco_calculado: 0,
        aprovado_f35: null,
        identidade_f36: null,
        resultado_f37: {},
        impacto_f38: {},
        memoria_f33: {},
        decisao_f27: {},
        erro: erroMsg,
        inicio_execucao: new Date(inicio).toISOString(),
        fim_execucao: nowISO(),
        duracao_ms: duracao,
        created_at: nowISO(),
      };

      await supabase.from("ia_fluxos_execucao_log").insert(log);
      return log;
    }
  },

  // ==================== HISTÓRICO E ESTATÍSTICAS ====================

  async listarExecucoes(filtros?: {
    fluxo_id?: string;
    fluxo_codigo?: string;
    status?: StatusFluxoExecucao;
    limite?: number;
  }): Promise<IaFluxoExecucaoLog[]> {
    let query = supabase.from("ia_fluxos_execucao_log").select("*").order("created_at", { ascending: false });
    if (filtros?.fluxo_id) query = query.eq("fluxo_id", filtros.fluxo_id);
    if (filtros?.fluxo_codigo) query = query.eq("fluxo_codigo", filtros.fluxo_codigo);
    if (filtros?.status) query = query.eq("status", filtros.status);
    if (filtros?.limite) query = query.limit(filtros.limite);
    const { data } = await query;
    return (data || []) as IaFluxoExecucaoLog[];
  },

  async obterExecucaoFluxo(fluxoExecucaoId: string): Promise<IaFluxoExecucaoLog[]> {
    const { data } = await supabase
      .from("ia_fluxos_execucao_log")
      .select("*")
      .eq("fluxo_execucao_id", fluxoExecucaoId)
      .order("etapa_ordem");
    return (data || []) as IaFluxoExecucaoLog[];
  },

  async obterEstatisticas(): Promise<{
    total_execucoes: number;
    concluidas: number;
    falhas: number;
    bloqueadas: number;
    em_andamento: number;
    tempo_medio_ms: number;
    por_tipo: Record<string, number>;
  }> {
    const { data } = await supabase.from("ia_fluxos_execucao_log").select("status, fluxo_codigo, duracao_ms");
    const logs = (data || []) as { status: string; fluxo_codigo: string; duracao_ms: number }[];

    const porStatus: Record<string, number> = {};
    const porTipo: Record<string, number> = {};
    let totalDuracao = 0;
    let totalComDuracao = 0;

    for (const l of logs) {
      porStatus[l.status] = (porStatus[l.status] || 0) + 1;
      porTipo[l.fluxo_codigo] = (porTipo[l.fluxo_codigo] || 0) + 1;
      if (l.duracao_ms > 0) {
        totalDuracao += l.duracao_ms;
        totalComDuracao++;
      }
    }

    return {
      total_execucoes: logs.length,
      concluidas: porStatus["concluido"] || 0,
      falhas: porStatus["falhou"] || 0,
      bloqueadas: porStatus["bloqueado"] || 0,
      em_andamento: porStatus["em_andamento"] || 0,
      tempo_medio_ms: totalComDuracao > 0 ? Math.round(totalDuracao / totalComDuracao) : 0,
      por_tipo: porTipo,
    };
  },
};

export default enterpriseOrchestratorService;
