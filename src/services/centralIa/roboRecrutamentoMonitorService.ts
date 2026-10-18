import { supabase } from "@/lib/supabase";
import type { AutoLog } from "@/services/centralIaService";

export interface MonitorResumo {
  total_execucoes: number;
  total_candidatos_processados: number;
  total_tarefas_criadas: number;
  total_aprovacoes_pendentes: number;
  total_aprovacoes_aprovadas: number;
  total_aprovacoes_rejeitadas: number;
  total_comunicacoes_simuladas: number;
  total_erros: number;
}

export interface ExecucaoResumo {
  id: string;
  execucao_id: string | null;
  data: string;
  candidato_nome: string;
  candidato_id: string;
  status: string;
  recomendacao: string | null;
  tarefa_id: string | null;
  aprovacao_id: string | null;
  qtd_logs: number;
}

export interface DetalhesExecucao {
  execucao_id: string | null;
  logs: AutoLog[];
  tarefa: Record<string, unknown> | null;
  aprovacao: Record<string, unknown> | null;
  mensagem: Record<string, unknown> | null;
  candidato: Record<string, unknown> | null;
  contexto: {
    instrucao_versao: number | null;
    instrucao_nome: string | null;
    conhecimentos_count: number;
    conhecimentos_nomes: string[];
    regras_count: number;
    regras_descricoes: string[];
    gatilhos_count: number;
    gatilhos_nomes: string[];
  };
}

export interface FiltrosMonitor {
  periodoInicio?: string;
  periodoFim?: string;
  status?: string;
  candidato?: string;
  temErro?: boolean;
}

async function obterRoboRecrutamentoId(): Promise<string | null> {
  const { data } = await supabase
    .from("automacoes_robos")
    .select("id")
    .eq("setor", "Recrutamento")
    .eq("ativo", true)
    .limit(1)
    .single();
  return data?.id || null;
}

export const roboRecrutamentoMonitorService = {
  async obterResumo(): Promise<MonitorResumo> {
    const roboId = await obterRoboRecrutamentoId();

    if (!roboId) {
      return {
        total_execucoes: 0, total_candidatos_processados: 0,
        total_tarefas_criadas: 0, total_aprovacoes_pendentes: 0,
        total_aprovacoes_aprovadas: 0, total_aprovacoes_rejeitadas: 0,
        total_comunicacoes_simuladas: 0, total_erros: 0,
      };
    }

    const { count: total_execucoes } = await supabase
      .from("automacoes_logs")
      .select("id", { count: "exact", head: true })
      .eq("robo_id", roboId)
      .in("acao", ["candidato_detectado", "processamento_finalizado"]);

    const { count: total_candidatos_processados } = await supabase
      .from("automacoes_logs")
      .select("id", { count: "exact", head: true })
      .eq("robo_id", roboId)
      .eq("acao", "processamento_finalizado");

    const { count: total_erros } = await supabase
      .from("automacoes_logs")
      .select("id", { count: "exact", head: true })
      .eq("robo_id", roboId)
      .eq("status", "erro");

    const { count: total_tarefas_criadas } = await supabase
      .from("automacoes_tarefas")
      .select("id", { count: "exact", head: true })
      .eq("robo_id", roboId);

    const { count: total_aprovacoes_pendentes } = await supabase
      .from("automacoes_aprovacoes")
      .select("id, automacoes_tarefas!inner(robo_id)", { count: "exact", head: true })
      .eq("automacoes_tarefas.robo_id", roboId)
      .eq("status", "pendente");

    const { count: total_aprovacoes_aprovadas } = await supabase
      .from("automacoes_aprovacoes")
      .select("id, automacoes_tarefas!inner(robo_id)", { count: "exact", head: true })
      .eq("automacoes_tarefas.robo_id", roboId)
      .eq("status", "aprovado");

    const { count: total_aprovacoes_rejeitadas } = await supabase
      .from("automacoes_aprovacoes")
      .select("id, automacoes_tarefas!inner(robo_id)", { count: "exact", head: true })
      .eq("automacoes_tarefas.robo_id", roboId)
      .eq("status", "rejeitado");

    const { count: total_comunicacoes_simuladas } = await supabase
      .from("comunicacoes_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("robo_id", roboId)
      .eq("status", "simulado");

    return {
      total_execucoes: total_execucoes || 0,
      total_candidatos_processados: total_candidatos_processados || 0,
      total_tarefas_criadas: total_tarefas_criadas || 0,
      total_aprovacoes_pendentes: total_aprovacoes_pendentes || 0,
      total_aprovacoes_aprovadas: total_aprovacoes_aprovadas || 0,
      total_aprovacoes_rejeitadas: total_aprovacoes_rejeitadas || 0,
      total_comunicacoes_simuladas: total_comunicacoes_simuladas || 0,
      total_erros: total_erros || 0,
    };
  },

  async listarExecucoes(filtros?: FiltrosMonitor): Promise<ExecucaoResumo[]> {
    const roboId = await obterRoboRecrutamentoId();
    if (!roboId) return [];

    let query = supabase
      .from("automacoes_logs")
      .select(`
        id,
        criado_em,
        acao,
        status,
        entrada,
        saida,
        tarefa_id
      `)
      .eq("robo_id", roboId)
      .in("acao", ["candidato_detectado", "processamento_finalizado"])
      .order("criado_em", { ascending: false })
      .limit(100);

    if (filtros?.periodoInicio) {
      query = query.gte("criado_em", filtros.periodoInicio);
    }
    if (filtros?.periodoFim) {
      query = query.lte("criado_em", filtros.periodoFim);
    }
    if (filtros?.status) {
      query = query.eq("status", filtros.status);
    }

    const { data: logs } = await query;
    if (!logs || logs.length === 0) return [];

    const logsProcessamento = logs.filter(l => l.acao === "processamento_finalizado");
    const logsDetectado = logs.filter(l => l.acao === "candidato_detectado");

    const candidatoIds = new Set<string>();
    logsDetectado.forEach(l => {
      const entrada = l.entrada as Record<string, unknown> | undefined;
      if (entrada?.candidato_id) candidatoIds.add(String(entrada.candidato_id));
    });

    let candidatos: Record<string, unknown>[] = [];
    if (candidatoIds.size > 0) {
      const { data: cData } = await supabase
        .from("recrutamento_candidatos")
        .select("id, nome as nome_completo, created_at")
        .in("id", Array.from(candidatoIds));
      candidatos = cData || [];
    }
    const candidatoMap = new Map(candidatos.map(c => [c.id, c]));

    const tarefaIds = logsProcessamento
      .map(l => l.tarefa_id)
      .filter(Boolean) as string[];

    let tarefas: Record<string, unknown>[] = [];
    if (tarefaIds.length > 0) {
      const { data: tData } = await supabase
        .from("automacoes_tarefas")
        .select("id, status, prioridade")
        .in("id", tarefaIds);
      tarefas = tData || [];
    }
    const tarefaMap = new Map(tarefas.map(t => [t.id, t]));

    const saidasProcessamento = logsProcessamento.map(l => ({
      log: l,
      saida: l.saida as Record<string, unknown> | undefined,
      entrada: l.entrada as Record<string, unknown> | undefined,
      tarefa: tarefaMap.get(l.tarefa_id || ""),
    }));

    const execucoes: ExecucaoResumo[] = [];
    const vistos = new Set<string>();

    for (const item of saidasProcessamento) {
      const candidatoId = String(item.entrada?.candidato_id || "");
      if (vistos.has(candidatoId)) continue;
      vistos.add(candidatoId);

      const candidato = candidatoMap.get(candidatoId);
      const recomendacao = item.saida?.recomendacao as string | null || item.entrada?.recomendacao as string | null;

      const execucao_id = (item.entrada?.execucao_id as string) || null;

      execucoes.push({
        id: item.log.id,
        execucao_id,
        data: item.log.criado_em,
        candidato_nome: candidato?.nome_completo as string || "Desconhecido",
        candidato_id: candidatoId,
        status: item.log.status,
        recomendacao,
        tarefa_id: item.log.tarefa_id,
        aprovacao_id: null,
        qtd_logs: 1,
      });
    }

    return execucoes;
  },

  async obterDetalhesExecucao(candidatoId: string): Promise<DetalhesExecucao> {
    const roboId = await obterRoboRecrutamentoId();

    let logList: AutoLog[] = [];
    if (roboId) {
      const { data: logs } = await supabase
        .from("automacoes_logs")
        .select("*")
        .eq("robo_id", roboId)
        .contains("entrada", { candidato_id: candidatoId })
        .order("criado_em", { ascending: true });
      logList = (logs as AutoLog[]) || [];
    }

    const logTarefa = logList.find(l => l.tarefa_id && l.acao === "tarefa_criada");
    let tarefa: Record<string, unknown> | null = null;
    if (logTarefa?.tarefa_id) {
      const { data: t } = await supabase
        .from("automacoes_tarefas")
        .select("*")
        .eq("id", logTarefa.tarefa_id)
        .single();
      tarefa = t as Record<string, unknown> | null;
    }

    let aprovacao: Record<string, unknown> | null = null;
    if (tarefa?.id) {
      const { data: a } = await supabase
        .from("automacoes_aprovacoes")
        .select("*, automacoes_tarefas!inner(titulo)")
        .eq("tarefa_id", tarefa.id)
        .maybeSingle();
      aprovacao = a as Record<string, unknown> | null;
    }

    let mensagem: Record<string, unknown> | null = null;
    if (tarefa?.id) {
      const { data: m } = await supabase
        .from("comunicacoes_mensagens")
        .select("*")
        .eq("tarefa_id", tarefa.id)
        .maybeSingle();
      mensagem = m as Record<string, unknown> | null;
    }

    let candidato: Record<string, unknown> | null = null;
    const { data: c } = await supabase
      .from("recrutamento_candidatos")
      .select("id, nome as nome_completo, cpf, telefone, email, veiculo as tipo_veiculo, regiao, cidade, stage as status, created_at")
      .eq("id", candidatoId)
      .maybeSingle();
    candidato = c as Record<string, unknown> | null;

    const logContexto = logList.find(l => l.acao === "contexto_montado");
    const entradaContexto = logContexto?.entrada as Record<string, unknown> | undefined;

    const logDetectado = logList.find(l => l.acao === "candidato_detectado");
    const entradaDetectado = logDetectado?.entrada as Record<string, unknown> | undefined;

    const execucao_id = (entradaDetectado?.execucao_id as string) ||
                        (entradaContexto?.execucao_id as string) || null;

    return {
      execucao_id,
      logs: logList,
      tarefa,
      aprovacao,
      mensagem,
      candidato,
      contexto: {
        instrucao_versao: (entradaContexto?.instrucao_versao as number) || null,
        instrucao_nome: (entradaContexto?.instrucao_nome as string) || null,
        conhecimentos_count: (entradaContexto?.conhecimentos_count as number) || 0,
        conhecimentos_nomes: (entradaContexto?.conhecimentos_nomes as string[]) || [],
        regras_count: (entradaContexto?.regras_count as number) || 0,
        regras_descricoes: (entradaContexto?.regras_descricoes as string[]) || [],
        gatilhos_count: (entradaContexto?.gatilhos_count as number) || 0,
        gatilhos_nomes: (entradaContexto?.gatilhos_nomes as string[]) || [],
      },
    };
  },

  async listarLogsExecucao(candidatoId: string): Promise<AutoLog[]> {
    const roboId = await obterRoboRecrutamentoId();
    if (!roboId) return [];

    const { data } = await supabase
      .from("automacoes_logs")
      .select("*")
      .eq("robo_id", roboId)
      .contains("entrada", { candidato_id: candidatoId })
      .order("criado_em", { ascending: true });

    return (data as AutoLog[]) || [];
  },
};
