import { supabase } from "@/lib/supabase";
import { actionEngineService } from "@/services/ia/actionEngineService";
import { centralIaService } from "@/services/centralIaService";

export type TipoRotina = "scheduled" | "interval" | "event" | "manual";
export type StatusRotina = "pending" | "running" | "success" | "error" | "paused";
export type StatusExecRotina = "running" | "success" | "error";

export interface RotinaIA {
  id: string;
  robo_id: string;
  nome: string;
  descricao: string | null;
  tipo: TipoRotina;
  cron_expression: string | null;
  interval_seconds: number | null;
  ativo: boolean;
  config: Record<string, unknown>;
  prioridade: string;
  aprovacao_necessaria: boolean;
  responsavel_id: string | null;
  ferramenta_id: string | null;
  dias_semana: number[] | null;
  ultima_execucao: string | null;
  proxima_execucao: string | null;
  status: StatusRotina;
  created_at: string;
  updated_at: string;
}

export interface RotinaExecucaoIA {
  id: string;
  rotina_id: string;
  robo_id: string;
  status: StatusExecRotina;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  logs: string | null;
  erro: string | null;
  started_at: string;
  finished_at: string | null;
}

type RoboContexto = {
  instrucoes: Record<string, unknown> | null;
  regras: Record<string, unknown>[];
  conhecimento: Record<string, unknown>[];
  arquivos: Record<string, unknown>[];
};

const TEMPO_LOCK_MS = 5 * 60 * 1000;
const rotinasEmExecucao = new Set<string>();

function nowISO(): string {
  return new Date().toISOString();
}

function addSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function carregarContextoRobo(roboId: string): Promise<RoboContexto> {
  const [instrucoesResult, regrasResult, conhecimentoResult, arquivosResult] = await Promise.all([
    supabase.from("automacoes_instrucoes").select("*").eq("robo_id", roboId).eq("ativo", true).limit(1).maybeSingle(),
    supabase.from("automacoes_regras_operacao").select("*").eq("robo_id", roboId),
    supabase.from("ia_conhecimento").select("*").eq("robo_id", roboId).eq("status", "ativo"),
    supabase.from("treinamento_arquivos_ia").select("*").eq("robo_id", roboId),
  ]);
  return {
    instrucoes: instrucoesResult.data || null,
    regras: (regrasResult.data || []) as Record<string, unknown>[],
    conhecimento: (conhecimentoResult.data || []) as Record<string, unknown>[],
    arquivos: (arquivosResult.data || []) as Record<string, unknown>[],
  };
}

function validarContexto(ctx: RoboContexto): string[] {
  const avisos: string[] = [];
  if (!ctx.instrucoes) avisos.push("Robô sem instruções ativas (F25C)");
  if (ctx.regras.length === 0) avisos.push("Robô sem regras operacionais (F25D)");
  if (ctx.conhecimento.length === 0) avisos.push("Robô sem base de conhecimento (F25FA.2)");
  return avisos;
}

export const rotinasMotorService = {
  async listarRotinas(roboId?: string): Promise<RotinaIA[]> {
    let query = supabase.from("rotinas_ia").select("*").order("created_at", { ascending: false });
    if (roboId) query = query.eq("robo_id", roboId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as RotinaIA[];
  },

  async listarRotinasAtivas(): Promise<RotinaIA[]> {
    const { data, error } = await supabase
      .from("rotinas_ia")
      .select("*")
      .eq("ativo", true)
      .in("status", ["pending", "success", "error"])
      .order("proxima_execucao", { ascending: true });
    if (error) throw error;
    return (data || []) as RotinaIA[];
  },

  async buscarRotinasPendentes(): Promise<RotinaIA[]> {
    const agora = nowISO();
    const { data, error } = await supabase
      .from("rotinas_ia")
      .select("*")
      .eq("ativo", true)
      .eq("aprovacao_necessaria", false)
      .in("status", ["pending", "success", "error"])
      .lte("proxima_execucao", agora)
      .order("prioridade", { ascending: false, nullsLast: true })
      .order("proxima_execucao", { ascending: true });
    if (error) throw error;
    const hoje = new Date().getDay();
    const rotinas = (data || []) as RotinaIA[];
    return rotinas.filter((r) => {
      if (!r.dias_semana || r.dias_semana.length === 0) return true;
      return r.dias_semana.includes(hoje);
    });
  },

  async criarRotina(rotina: {
    robo_id: string;
    nome: string;
    descricao?: string;
    tipo: TipoRotina;
    cron_expression?: string;
    interval_seconds?: number;
    config?: Record<string, unknown>;
    prioridade?: string;
    aprovacao_necessaria?: boolean;
    responsavel_id?: string;
    ferramenta_id?: string;
    dias_semana?: number[];
  }): Promise<RotinaIA | null> {
    const proximaExecucao = rotina.tipo === "interval" && rotina.interval_seconds
      ? addSeconds(rotina.interval_seconds)
      : rotina.tipo === "scheduled" && rotina.cron_expression
        ? nowISO()
        : null;

    const { data, error } = await supabase.from("rotinas_ia").insert({
      robo_id: rotina.robo_id,
      nome: rotina.nome,
      descricao: rotina.descricao || null,
      tipo: rotina.tipo,
      cron_expression: rotina.cron_expression || null,
      interval_seconds: rotina.interval_seconds || null,
      config: rotina.config || {},
      prioridade: rotina.prioridade || "normal",
      aprovacao_necessaria: rotina.aprovacao_necessaria || false,
      responsavel_id: rotina.responsavel_id || null,
      ferramenta_id: rotina.ferramenta_id || null,
      dias_semana: rotina.dias_semana || null,
      ativo: true,
      status: "pending",
      proxima_execucao: proximaExecucao,
    }).select().single();
    if (error) throw error;
    void centralIaService.registrarLog({
      robo_id: rotina.robo_id,
      acao: "rotina_criada",
      entrada: { rotina_nome: rotina.nome, tipo: rotina.tipo },
      saida: { rotina_id: (data as RotinaIA).id },
      status: "sucesso",
    });
    return data as RotinaIA;
  },

  async atualizarRotina(id: string, updates: Partial<RotinaIA>): Promise<RotinaIA | null> {
    const { data: antes } = await supabase.from("rotinas_ia").select("*").eq("id", id).single();
    const { data, error } = await supabase.from("rotinas_ia").update(updates).eq("id", id).select().single();
    if (error) throw error;
    const nova = data as RotinaIA;
    void centralIaService.registrarLog({
      robo_id: nova.robo_id,
      acao: "rotina_atualizada",
      entrada: { rotina_id: id, rotina_nome: nova.nome },
      saida: { atualizado: Object.keys(updates) },
      status: "sucesso",
    });
    return nova;
  },

  async toggleRotina(id: string, ativo: boolean): Promise<void> {
    const updates: Partial<RotinaIA> = { ativo, status: ativo ? "pending" : "paused" };
    if (ativo) updates.proxima_execucao = addSeconds(30);
    const { data: antes } = await supabase.from("rotinas_ia").select("*").eq("id", id).maybeSingle();
    await supabase.from("rotinas_ia").update(updates).eq("id", id);
    if (antes) {
      void centralIaService.registrarLog({
        robo_id: (antes as RotinaIA).robo_id,
        acao: ativo ? "rotina_ativada" : "rotina_desativada",
        entrada: { rotina_id: id, rotina_nome: (antes as RotinaIA).nome },
        saida: { ativo },
        status: "sucesso",
      });
    }
  },

  async deletarRotina(id: string): Promise<void> {
    const { data: antes } = await supabase.from("rotinas_ia").select("*").eq("id", id).maybeSingle();
    await supabase.from("rotinas_ia").delete().eq("id", id);
    if (antes) {
      void centralIaService.registrarLog({
        robo_id: (antes as RotinaIA).robo_id,
        acao: "rotina_excluida",
        entrada: { rotina_id: id, rotina_nome: (antes as RotinaIA).nome },
        saida: {},
        status: "sucesso",
      });
    }
  },

  async recuperarExecucoesTravadas(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc("recuperar_rotinas_travadas");
      if (error) {
        const { data: execsTravadas } = await supabase
          .from("rotinas_execucoes_ia")
          .select("id, rotina_id, started_at")
          .eq("status", "running")
          .lt("started_at", new Date(Date.now() - TEMPO_LOCK_MS).toISOString())
          .limit(20);
        if (!execsTravadas || execsTravadas.length === 0) return 0;
        for (const exec of execsTravadas) {
          await supabase.from("rotinas_execucoes_ia").update({
            status: "error",
            erro: "Timeout automático: execução travada",
            logs: `[${nowISO()}] TIMEOUT: execução travada desde ${exec.started_at}`,
            finished_at: nowISO(),
          }).eq("id", exec.id);
          await supabase.from("rotinas_ia").update({ status: "error" }).eq("id", exec.rotina_id);
        }
        return execsTravadas.length;
      }
      return (data as unknown[])?.length || 0;
    } catch {
      return 0;
    }
  },

  async executarRotina(rotinaId: string): Promise<RotinaExecucaoIA | null> {
    if (rotinasEmExecucao.has(rotinaId)) {
      throw new Error(`Rotina ${rotinaId} já está em execução`);
    }
    rotinasEmExecucao.add(rotinaId);

    try {
      const { data: rotina, error: rotinaError } = await supabase
        .from("rotinas_ia").select("*").eq("id", rotinaId).single();
      if (rotinaError || !rotina) throw new Error("Rotina não encontrada");

      const r = rotina as RotinaIA;
      const roboId = r.robo_id;

      const updateResult = await supabase.from("rotinas_ia").update({
        status: "running",
        ultima_execucao: nowISO(),
      }).eq("id", rotinaId).eq("status", r.status).select().single();

      if (!updateResult.data) {
        throw new Error("Falha ao obter lock da rotina (status mudou)");
      }

      const execucao = await this.registrarExecucao({
        rotina_id: rotinaId,
        robo_id: roboId,
        status: "running",
        input: { tipo: r.tipo, nome: r.nome },
      });

      const contexto = await carregarContextoRobo(roboId);
      const avisos = validarContexto(contexto);
      const logs: string[] = [];

      const ts = nowISO();
      logs.push(`[${ts}] Iniciando execução da rotina: ${r.nome}`);
      logs.push(`[${ts}] Contexto carregado: ${contexto.instrucoes ? "instruções OK" : "sem instruções"}`);
      logs.push(`[${ts}] Regras operacionais: ${contexto.regras.length} encontradas`);
      logs.push(`[${ts}] Base de conhecimento: ${contexto.conhecimento.length} itens`);
      logs.push(`[${ts}] Arquivos de treinamento: ${contexto.arquivos.length} arquivos`);

      for (const aviso of avisos) {
        logs.push(`[${nowISO()}] AVISO: ${aviso}`);
      }

      const config = (r.config || {}) as Record<string, unknown>;
      const ferramentaCodigo = config.ferramenta as string | undefined;
      let execucaoFerramentaId: string | null = null;

      if (ferramentaCodigo) {
        logs.push(`[${nowISO()}] Executando ferramenta: ${ferramentaCodigo}`);
        try {
          const ferramentas = await supabase
            .from("ia_ferramentas")
            .select("id")
            .eq("codigo_unico", ferramentaCodigo)
            .eq("ativo", true)
            .maybeSingle();
          const ferramenta = ferramentas.data as { id: string } | null;

          if (ferramenta) {
            const exec = await actionEngineService.solicitarAcao({
              roboId,
              ferramentaId: ferramenta.id,
              solicitacao: r.nome,
              contexto: { origem: "rotina", rotina_id: rotinaId, config },
            });
            execucaoFerramentaId = exec?.id || null;
            logs.push(`[${nowISO()}] Ferramenta ${ferramentaCodigo} executada: ${exec?.id || "sem ID"}`);
          } else {
            logs.push(`[${nowISO()}] AVISO: Ferramenta ${ferramentaCodigo} nao encontrada no catalogo`);
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logs.push(`[${nowISO()}] ERRO ao executar ferramenta ${ferramentaCodigo}: ${errMsg}`);
        }
      } else {
        logs.push(`[${nowISO()}] Nenhuma ferramenta configurada na rotina (apenas carga de contexto)`);
      }

      const output: Record<string, unknown> = {
        contexto_carregado: true,
        instrucoes: !!contexto.instrucoes,
        regras_count: contexto.regras.length,
        conhecimento_count: contexto.conhecimento.length,
        arquivos_count: contexto.arquivos.length,
        avisos,
        ferramenta_executada: ferramentaCodigo || null,
        execucao_ferramenta_id: execucaoFerramentaId,
        timestamp: nowISO(),
      };

      const statusFinal = execucaoFerramentaId ? "success" : "success";
      logs.push(`[${nowISO()}] Rotina executada com sucesso`);

      await supabase.from("rotinas_execucoes_ia").update({
        status: statusFinal,
        output,
        logs: logs.join("\n"),
        finished_at: nowISO(),
      }).eq("id", execucao.id);

      await supabase.from("rotinas_ia").update({ status: statusFinal }).eq("id", rotinaId);
      await this.atualizarProximaExecucao(rotinaId);

      return {
        ...execucao, status: statusFinal, output, logs: logs.join("\n"), finished_at: nowISO(),
      } as RotinaExecucaoIA;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      try {
        const execs = await supabase
          .from("rotinas_execucoes_ia")
          .select("id")
          .eq("rotina_id", rotinaId)
          .eq("status", "running")
          .order("started_at", { ascending: false })
          .limit(1);
        if (execs.data && execs.data.length > 0) {
          await this.registrarErro(execs.data[0].id, errMsg);
        }
        await supabase.from("rotinas_ia").update({ status: "error" }).eq("id", rotinaId);
        await this.atualizarProximaExecucao(rotinaId);
      } catch {
      }
      return null;
    } finally {
      rotinasEmExecucao.delete(rotinaId);
    }
  },

  async registrarExecucao(params: {
    rotina_id: string;
    robo_id: string;
    status: StatusExecRotina;
    input?: Record<string, unknown>;
  }): Promise<RotinaExecucaoIA> {
    const { data, error } = await supabase.from("rotinas_execucoes_ia").insert({
      rotina_id: params.rotina_id,
      robo_id: params.robo_id,
      status: params.status,
      input: params.input || {},
      logs: "",
      started_at: nowISO(),
    }).select().single();
    if (error) throw error;
    return data as RotinaExecucaoIA;
  },

  async atualizarProximaExecucao(rotinaId: string): Promise<void> {
    const { data: rotina } = await supabase.from("rotinas_ia").select("*").eq("id", rotinaId).single();
    if (!rotina) return;

    const r = rotina as RotinaIA;
    let proxima: string | null = null;

    if (r.tipo === "interval" && r.interval_seconds) {
      proxima = addSeconds(r.interval_seconds);
    } else if (r.tipo === "scheduled" && r.cron_expression) {
      proxima = addSeconds(3600);
    }

    await supabase.from("rotinas_ia").update({ proxima_execucao: proxima }).eq("id", rotinaId);
  },

  async registrarErro(execucaoId: string, erro: string): Promise<void> {
    await supabase.from("rotinas_execucoes_ia").update({
      status: "error",
      erro,
      logs: `[${nowISO()}] ERRO: ${erro}`,
      finished_at: nowISO(),
    }).eq("id", execucaoId);
  },

  async listarExecucoes(rotinaId: string, limite = 20): Promise<RotinaExecucaoIA[]> {
    const { data, error } = await supabase
      .from("rotinas_execucoes_ia")
      .select("*")
      .eq("rotina_id", rotinaId)
      .order("started_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return (data || []) as RotinaExecucaoIA[];
  },

  async listarFerramentasDisponiveis(): Promise<{ id: string; codigo_unico: string; nome: string; categoria: string }[]> {
    const { data } = await supabase.from("ia_ferramentas").select("id, codigo_unico, nome, categoria").eq("ativo", true).order("categoria").order("nome");
    return (data || []) as { id: string; codigo_unico: string; nome: string; categoria: string }[];
  },

  async listarRobosDisponiveis(): Promise<{ id: string; nome: string }[]> {
    const { data } = await supabase.from("automacoes_robos").select("id, nome").order("nome");
    return (data || []) as { id: string; nome: string }[];
  },

  async obterEstatisticas(roboId?: string): Promise<{
    total: number;
    ativas: number;
    executadasHoje: number;
    falhasHoje: number;
  }> {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeISO = hoje.toISOString();

    let queryRotinas = supabase.from("rotinas_ia").select("id, ativo", { count: "exact", head: false });
    if (roboId) queryRotinas = queryRotinas.eq("robo_id", roboId);
    const { data: rotinasData } = await queryRotinas;
    const total = (rotinasData || []).length;
    const ativas = (rotinasData || []).filter((r) => r.ativo).length;

    let queryExec = supabase
      .from("rotinas_execucoes_ia")
      .select("id, status", { count: "exact", head: false })
      .gte("started_at", hojeISO);
    if (roboId) queryExec = queryExec.eq("robo_id", roboId);
    const { data: execsHoje } = await queryExec;
    const executadasHoje = (execsHoje || []).length;
    const falhasHoje = (execsHoje || []).filter((e) => e.status === "error").length;

    return { total, ativas, executadasHoje, falhasHoje };
  },
};

export default rotinasMotorService;
