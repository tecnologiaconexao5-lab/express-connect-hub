import { supabase } from "@/lib/supabase";

export type ModoOperacao = "manual" | "assistido" | "automatico_seguro";
export type StatusRobo = "ativo" | "inativo" | "pausado" | "erro";
export type StatusAprovacao = "pendente" | "aprovado" | "rejeitado" | "assumido";
export type StatusTarefaAuto = "pendente" | "em_execucao" | "aguardando_aprovacao" | "concluida" | "falhou" | "cancelada";
export type StatusAprovacaoAuto = "pendente" | "aprovado" | "rejeitado" | "editado";
export type TipoAprovacao =
  "proposta_comercial" | "contrato" | "desconto" | "alteracao_valor"
  | "cancelamento_operacao" | "troca_motorista" | "troca_prestador"
  | "resposta_reclamacao" | "resposta_ocorrencia_grave" | "emissao_fiscal"
  | "mensagem_cliente" | "mensagem_prestador" | "outro";
export type DestinatarioTipo = "cliente" | "prestador" | "candidato" | "admin" | "setor";
export type CanalMensagem = "whatsapp" | "email" | "sms" | "simulado";

// ==================== INTERFACES F21 (legado) ====================
export type NivelAutonomia = "manual" | "assistido" | "automatico_seguro";
export type ModoAtualRobo = "seguro" | "homologacao" | "producao_assistida" | "producao";

export interface AutomacaoRobo {
  id: string;
  nome: string;
  descricao: string | null;
  setor: string;
  icone: string;
  cor: string;
  modo: ModoOperacao;
  status: StatusRobo;
  acoes_permitidas: string[];
  acoes_bloqueadas: string[];
  precisa_aprovacao: string[];
  mensagem_fallback: string;
  ultima_execucao: string | null;
  total_execucoes: number;
  total_erros: number;
  config: Record<string, unknown>;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  // F25B: Novos campos
  canal_principal: string | null;
  nivel_autonomia: NivelAutonomia | null;
  responsavel_humano_id: string | null;
  modo_atual: ModoAtualRobo | null;
  setor_responsavel: string | null;
  permite_envio_externo: boolean | null;
  exige_aprovacao_humana: boolean | null;
  limite_mensagens_dia: number | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  tom_conversa: string | null;
  instrucoes_resumo: string | null;
}

export interface IaTarefa {
  id: string;
  setor_id: string;
  titulo: string;
  descricao: string | null;
  tipo_tarefa: string;
  status: string;
  prioridade: string | null;
  executar_em: string | null;
  executado_em: string | null;
  resultado: string | null;
  criado_em: string;
  atualizado_em: string;
  setor_nome?: string;
}

export interface IaAprovacao {
  id: string;
  setor_id: string;
  titulo: string;
  descricao: string | null;
  acao_sugerida: string | null;
  payload: Record<string, unknown> | null;
  status: StatusAprovacao;
  aprovado_por: string | null;
  aprovado_em: string | null;
  rejeitado_em: string | null;
  motivo_rejeicao: string | null;
  criado_em: string;
  atualizado_em: string;
  setor_nome?: string;
}

export interface IaLogDecisao {
  id: string;
  setor: string | null;
  origem: string | null;
  referencia_id: string | null;
  entrada_usuario: string | null;
  decisao: string;
  resposta_gerada: string | null;
  precisa_humano: boolean;
  motivo_humano: string | null;
  provider: string | null;
  raw_payload: Record<string, unknown> | null;
  criado_em: string;
  setor_nome?: string;
}

export interface IaSetor {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  modo_operacao: ModoOperacao | null;
  fallback_msg: string | null;
  criado_em: string;
}

// ==================== INTERFACES F22 (novo fluxo seguro) ====================
export interface AutoTarefa {
  id: string;
  robo_id: string | null;
  setor: string;
  tipo_tarefa: string;
  origem_tipo: string | null;
  origem_id: string | null;
  titulo: string;
  descricao: string | null;
  prioridade: "baixa" | "normal" | "alta" | "critica";
  status: StatusTarefaAuto;
  executar_em: string | null;
  tentativas: number;
  max_tentativas: number;
  payload: Record<string, unknown>;
  resultado: Record<string, unknown>;
  responsavel_humano_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface AutoAprovacao {
  id: string;
  tarefa_id: string | null;
  tipo_aprovacao: TipoAprovacao;
  conteudo_original: Record<string, unknown>;
  conteudo_sugerido: Record<string, unknown>;
  status: StatusAprovacaoAuto;
  aprovado_por: string | null;
  aprovado_em: string | null;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface AutoLog {
  id: string;
  robo_id: string | null;
  tarefa_id: string | null;
  acao: string;
  entrada: Record<string, unknown>;
  saida: Record<string, unknown>;
  status: "sucesso" | "erro" | "info" | "aviso";
  erro: string | null;
  criado_em: string;
}

export interface ComunicacaoMensagem {
  id: string;
  robo_id: string | null;
  tarefa_id: string | null;
  origem_tipo: string | null;
  origem_id: string | null;
  destinatario_tipo: DestinatarioTipo;
  destinatario_nome: string | null;
  canal: CanalMensagem;
  assunto: string | null;
  conteudo: string;
  status: "rascunho" | "simulado" | "enviado" | "erro";
  provider_message_id: string | null;
  modo_seguro: boolean;
  contexto: Record<string, unknown>;
  criado_em: string;
  atualizado_em: string;
}

// ==================== INTERFACES F25C ====================
export type StatusInstrucao = "rascunho" | "em_revisao" | "publicado" | "arquivado";
export type StatusConhecimento = "ativo" | "inativo" | "vencido" | "rascunho";

export interface AutomacaoInstrucao {
  id: string;
  robo_id: string;
  versao: number;
  objetivo: string | null;
  tom_de_conversa: string | null;
  regras_fixas: string | null;
  perguntas_obrigatorias: string | null;
  respostas_padrao: unknown[];
  limites_de_atuacao: string | null;
  quando_chamar_humano: string | null;
  proibicoes: string | null;
  exemplos_de_conversa: unknown[];
  instrucoes_completas: string | null;
  status: StatusInstrucao;
  ativo: boolean;
  criado_por: string | null;
  publicado_por: string | null;
  publicado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface IaConhecimento {
  id: string;
  setor_id: string | null;
  robo_id: string | null;
  categoria: string | null;
  titulo: string;
  conteudo: string;
  setor: string | null;
  tags: string[];
  status: StatusConhecimento;
  arquivo_url: string | null;
  validade_inicio: string | null;
  validade_fim: string | null;
  criado_por: string | null;
  atualizado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type StatusRegraOperacao = "ativo" | "inativo" | "rascunho" | "vencido";

export interface AutomacaoRegraOperacao {
  id: string;
  robo_id: string;
  cliente_id: string | null;
  nome_operacao: string;
  setor: string;
  tipo_veiculo: string | null;
  capacidade: string | null;
  local_carregamento: string | null;
  cidade_operacao: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  dias_operacao: string | null;
  valor_operacao: number | null;
  modelo_pagamento: string | null;
  km_incluso: number | null;
  valor_km_excedente: number | null;
  documentos_obrigatorios: string[];
  exige_treinamento: boolean;
  criterios_aprovacao: string | null;
  criterios_reprovacao: string | null;
  mensagem_inicial: string | null;
  status: StatusRegraOperacao;
  validade_inicio: string | null;
  validade_fim: string | null;
  criado_por: string | null;
  atualizado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface PromptOperacionalRobo {
  robo: AutomacaoRobo | null;
  instrucaoAtiva: AutomacaoInstrucao | null;
  conhecimento: IaConhecimento[];
  regrasOperacao: AutomacaoRegraOperacao[];
  promptFinal: string;
  alertasSeguranca: string[];
}

// ==================== F25E: GATILHOS E ALERTAS ====================
export type NivelRisco = "baixo" | "medio" | "alto" | "critico";
export type TipoAcaoGatilho = "criar_tarefa" | "criar_aprovacao" | "criar_alerta" | "acionar_humano" | "executar_robo_simulado" | "notificar_setor";

export interface AutomacaoGatilho {
  id: string;
  robo_id: string;
  nome: string;
  setor: string;
  evento: string;
  descricao: string | null;
  cliente_id: string | null;
  operacao_id: string | null;
  regiao: string | null;
  prioridade: string;
  status_anterior: string | null;
  status_novo: string | null;
  condicao_json: Record<string, unknown>;
  tipo_acao: TipoAcaoGatilho;
  criar_tarefa: boolean;
  criar_aprovacao: boolean;
  criar_alerta: boolean;
  acionar_humano: boolean;
  executar_robo_simulado: boolean;
  exige_aprovacao_humana: boolean;
  permite_execucao_automatica: boolean;
  nivel_risco: NivelRisco;
  limite_execucoes: number;
  ativo: boolean;
  horario_inicio: string | null;
  horario_fim: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface AutomacaoGatilhoExecucao {
  id: string;
  gatilho_id: string;
  robo_id: string | null;
  evento: string;
  tipo_acao: string;
  payload: Record<string, unknown>;
  resultado: Record<string, unknown>;
  status: string;
  erro: string | null;
  executado_em: string;
}

function cleanText(text: string): string {
  return text
    .replace(/sou\s+um\s+robô/gi, "sou um assistente")
    .replace(/sou\s+uma\s+IA/gi, "sou um assistente digital")
    .replace(/sou\s+ia/gi, "sou um assistente digital")
    .replace(/sou\s+atendente\s+humano/gi, "faço parte da equipe");
}

type SimularMensagemParams = {
  roboId?: string;
  setor: string;
  origemTipo: string;
  origemId: string;
  destinatarioTipo: DestinatarioTipo;
  destinatarioNome?: string;
  canal: CanalMensagem;
  contexto?: Record<string, unknown>;
  objetivo: string;
};

const ASSINATURAS: Record<string, string> = {
  Comercial: "Comercial Conexão Express",
  Operacional: "Operação Conexão Express",
  Recrutamento: "Recrutamento Conexão Express",
  Financeiro: "Financeiro Conexão Express",
  Fiscal: "Fiscal Conexão Express",
  Monitoramento: "Monitoramento Conexão Express",
  Cliente: "Atendimento Conexão Express",
  Prestador: "Suporte ao Prestador",
  "Prestador/Motorista": "Suporte ao Prestador",
};

export const centralIaService = {
  // ==================== F25B: CONFIGURAÇÃO DE ROBÔS ====================
  async salvarConfigRobo(id: string, config: Partial<AutomacaoRobo>): Promise<void> {
    const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
    const configFields = [
      "canal_principal", "nivel_autonomia", "responsavel_humano_id",
      "modo_atual", "setor_responsavel", "permite_envio_externo",
      "exige_aprovacao_humana", "limite_mensagens_dia", "horario_inicio",
      "horario_fim", "tom_conversa", "instrucoes_resumo",
    ];
    for (const field of configFields) {
      if (field in config) {
        updates[field] = (config as Record<string, unknown>)[field];
      }
    }
    if (Object.keys(updates).length > 1) {
      await supabase.from("automacoes_robos").update(updates).eq("id", id);
    }
  },

  // ==================== F25B: VALIDAÇÃO DE SEGURANÇA POR ROBÔ ====================
  async validarSegurancaRobo(roboId: string): Promise<{
    podeEnviar: boolean;
    motivo?: string;
    robo?: AutomacaoRobo;
  }> {
    const { data } = await supabase
      .from("automacoes_robos")
      .select("*")
      .eq("id", roboId)
      .single();
    const robo = data as AutomacaoRobo | null;
    if (!robo) return { podeEnviar: false, motivo: "Robô não encontrado" };

    if (!robo.permite_envio_externo) {
      return { podeEnviar: false, motivo: "Robô não permite envio externo", robo };
    }
    if (robo.exige_aprovacao_humana) {
      return { podeEnviar: false, motivo: "Robô exige aprovação humana", robo };
    }
    if (robo.modo_atual === "seguro") {
      return { podeEnviar: false, motivo: "Robô em modo seguro — apenas simulação", robo };
    }
    if (robo.modo_atual === "homologacao") {
      return { podeEnviar: true, motivo: "Robô em homologação — usar whatsappHomologService", robo };
    }
    if (robo.modo_atual === "producao_assistida") {
      return { podeEnviar: false, motivo: "Produção assistida ainda não ativada", robo };
    }
    return { podeEnviar: true, robo };
  },

  // ==================== ROBÔS (F21) ====================
  async listarRobos(): Promise<AutomacaoRobo[]> {
    const { data } = await supabase
      .from("automacoes_robos")
      .select("*")
      .order("setor")
      .order("nome");
    return (data as AutomacaoRobo[]) || [];
  },

  async salvarRobo(robo: Partial<AutomacaoRobo>): Promise<void> {
    if (robo.id) {
      await supabase
        .from("automacoes_robos")
        .update({ ...robo, atualizado_em: new Date().toISOString() })
        .eq("id", robo.id);
    } else {
      await supabase.from("automacoes_robos").insert(robo);
    }
  },

  async atualizarModoRobo(id: string, modo: ModoOperacao): Promise<void> {
    await supabase
      .from("automacoes_robos")
      .update({ modo, atualizado_em: new Date().toISOString() })
      .eq("id", id);
  },

  async atualizarStatusRobo(id: string, status: StatusRobo): Promise<void> {
    await supabase
      .from("automacoes_robos")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("id", id);
  },

  // ==================== TAREFAS IA (F21 - legado) ====================
  async listarTarefasIa(): Promise<IaTarefa[]> {
    const { data } = await supabase
      .from("ia_tarefas_automaticas")
      .select("*, ia_setores!inner(nome)")
      .order("criado_em", { ascending: false });
    return ((data as unknown[]) || []).map((t: Record<string, unknown>) => ({
      ...t,
      setor_nome: (t as { ia_setores?: { nome: string } }).ia_setores?.nome,
    })) as IaTarefa[];
  },

  async alternarTarefaIa(id: string, status: string): Promise<void> {
    await supabase
      .from("ia_tarefas_automaticas")
      .update({ status })
      .eq("id", id);
  },

  // ==================== APROVAÇÕES IA (F21 - legado) ====================
  async listarAprovacoesIa(status?: StatusAprovacao): Promise<IaAprovacao[]> {
    let query = supabase
      .from("ia_aprovacoes_humanas")
      .select("*, ia_setores!left(nome)")
      .order("criado_em", { ascending: false });
    if (status) {
      query = query.eq("status", status);
    }
    const { data } = await query;
    return ((data as unknown[]) || []).map((a: Record<string, unknown>) => ({
      ...a,
      setor_nome: (a as { ia_setores?: { nome: string } }).ia_setores?.nome,
    })) as IaAprovacao[];
  },

  async aprovarAprovacaoIa(id: string): Promise<void> {
    await supabase
      .from("ia_aprovacoes_humanas")
      .update({ status: "aprovado", aprovado_em: new Date().toISOString() })
      .eq("id", id);
  },

  async rejeitarAprovacaoIa(id: string): Promise<void> {
    await supabase
      .from("ia_aprovacoes_humanas")
      .update({ status: "rejeitado", rejeitado_em: new Date().toISOString() })
      .eq("id", id);
  },

  // ==================== LOGS IA (F21 - legado) ====================
  async listarLogsIa(setor?: string, limit = 50): Promise<IaLogDecisao[]> {
    let query = supabase
      .from("ia_decisoes_logs")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(limit);
    if (setor) {
      query = query.eq("setor", setor);
    }
    const { data } = await query;
    return (data as IaLogDecisao[]) || [];
  },

  // ==================== SETORES ====================
  async listarSetores(): Promise<IaSetor[]> {
    const { data } = await supabase
      .from("ia_setores")
      .select("*")
      .order("nome");
    return (data as IaSetor[]) || [];
  },

  async atualizarModoSetor(id: string, modo: ModoOperacao): Promise<void> {
    await supabase
      .from("ia_setores")
      .update({ modo_operacao: modo })
      .eq("id", id);
  },

  async atualizarFallbackSetor(id: string, msg: string): Promise<void> {
    await supabase
      .from("ia_setores")
      .update({ fallback_msg: msg })
      .eq("id", id);
  },

  // ==================== F22: AUTOMAÇÕES TAREFAS ====================
  async listarTarefas(params?: {
    setor?: string;
    status?: StatusTarefaAuto;
    prioridade?: string;
  }): Promise<AutoTarefa[]> {
    let query = supabase
      .from("automacoes_tarefas")
      .select("*, automacoes_robos!left(nome)")
      .order("criado_em", { ascending: false });
    if (params?.setor) query = query.eq("setor", params.setor);
    if (params?.status) query = query.eq("status", params.status);
    if (params?.prioridade) query = query.eq("prioridade", params.prioridade);
    const { data } = await query;
    return ((data as Record<string, unknown>[]) || []).map((t) => ({
      ...t,
      robo_nome: (t as { automacoes_robos?: { nome: string } }).automacoes_robos?.nome,
    })) as AutoTarefa[];
  },

  async criarTarefa(tarefa: Partial<AutoTarefa>): Promise<AutoTarefa | null> {
    const { data } = await supabase
      .from("automacoes_tarefas")
      .insert({
        robo_id: tarefa.robo_id,
        setor: tarefa.setor || "Geral",
        tipo_tarefa: tarefa.tipo_tarefa || "geral",
        origem_tipo: tarefa.origem_tipo,
        origem_id: tarefa.origem_id,
        titulo: tarefa.titulo || "Nova tarefa",
        descricao: tarefa.descricao,
        prioridade: tarefa.prioridade || "normal",
        status: tarefa.status || "pendente",
        payload: tarefa.payload || {},
        resultado: {},
        max_tentativas: tarefa.max_tentativas || 3,
      })
      .select()
      .single();
    if (data) {
      await centralIaService.registrarLog({
        acao: "tarefa_criada",
        entrada: { tarefa_id: data.id, titulo: data.titulo },
        status: "info",
      });
    }
    return data as AutoTarefa | null;
  },

  async atualizarStatusTarefa(id: string, status: StatusTarefaAuto, resultado?: Record<string, unknown>): Promise<void> {
    const updates: Record<string, unknown> = { status, atualizado_em: new Date().toISOString() };
    if (resultado) updates.resultado = resultado;
    await supabase.from("automacoes_tarefas").update(updates).eq("id", id);
  },

  async cancelarTarefa(id: string): Promise<void> {
    await supabase
      .from("automacoes_tarefas")
      .update({ status: "cancelada", atualizado_em: new Date().toISOString() })
      .eq("id", id);
    await centralIaService.registrarLog({
      acao: "tarefa_cancelada",
      entrada: { tarefa_id: id },
      status: "info",
    });
  },

  async reenfileirarTarefa(id: string): Promise<void> {
    await supabase
      .from("automacoes_tarefas")
      .update({
        status: "pendente",
        tentativas: 0,
        executar_em: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", id);
    await centralIaService.registrarLog({
      acao: "tarefa_reenfileirada",
      entrada: { tarefa_id: id },
      status: "info",
    });
  },

  async incrementarTentativa(id: string): Promise<void> {
    const { data } = await supabase
      .from("automacoes_tarefas")
      .select("tentativas, max_tentativas")
      .eq("id", id)
      .single();
    if (data) {
      const t = data as { tentativas: number; max_tentativas: number };
      if (t.tentativas >= t.max_tentativas) {
        await supabase
          .from("automacoes_tarefas")
          .update({ status: "falhou", atualizado_em: new Date().toISOString() })
          .eq("id", id);
      } else {
        await supabase
          .from("automacoes_tarefas")
          .update({ tentativas: t.tentativas + 1, atualizado_em: new Date().toISOString() })
          .eq("id", id);
      }
    }
  },

  // ==================== F22: AUTOMAÇÕES APROVAÇÕES ====================
  async listarAprovacoes(params?: {
    status?: StatusAprovacaoAuto;
    tipo_aprovacao?: TipoAprovacao;
  }): Promise<AutoAprovacao[]> {
    let query = supabase
      .from("automacoes_aprovacoes")
      .select("*, automacoes_tarefas!left(titulo)")
      .order("criado_em", { ascending: false });
    if (params?.status) query = query.eq("status", params.status);
    if (params?.tipo_aprovacao) query = query.eq("tipo_aprovacao", params.tipo_aprovacao);
    const { data } = await query;
    return ((data as Record<string, unknown>[]) || []).map((a) => ({
      ...a,
      tarefa_titulo: (a as { automacoes_tarefas?: { titulo: string } }).automacoes_tarefas?.titulo,
    })) as AutoAprovacao[];
  },

  async criarAprovacao(aprovacao: Partial<AutoAprovacao> & { tarefa_id: string }): Promise<AutoAprovacao | null> {
    const { data } = await supabase
      .from("automacoes_aprovacoes")
      .insert({
        tarefa_id: aprovacao.tarefa_id,
        tipo_aprovacao: aprovacao.tipo_aprovacao || "outro",
        conteudo_original: aprovacao.conteudo_original || {},
        conteudo_sugerido: aprovacao.conteudo_sugerido || {},
        status: "pendente",
      })
      .select()
      .single();
    if (data) {
      await supabase
        .from("automacoes_tarefas")
        .update({ status: "aguardando_aprovacao" })
        .eq("id", aprovacao.tarefa_id);
      await centralIaService.registrarLog({
        acao: "aprovacao_criada",
        entrada: { aprovacao_id: data.id, tarefa_id: aprovacao.tarefa_id },
        status: "info",
      });
    }
    return data as AutoAprovacao | null;
  },

  async aprovarAprovacao(id: string, aprovado_por?: string): Promise<void> {
    await supabase
      .from("automacoes_aprovacoes")
      .update({ status: "aprovado", aprovado_por: aprovado_por || null, aprovado_em: new Date().toISOString() })
      .eq("id", id);
    const { data: ap } = await supabase
      .from("automacoes_aprovacoes")
      .select("tarefa_id")
      .eq("id", id)
      .single();
    if (ap?.tarefa_id) {
      await supabase
        .from("automacoes_tarefas")
        .update({ status: "concluida", resultado: { aprovado: true, aprovado_em: new Date().toISOString() } })
        .eq("id", ap.tarefa_id);
    }
    await centralIaService.registrarLog({
      acao: "aprovacao_aprovada",
      entrada: { aprovacao_id: id },
      status: "sucesso",
    });
  },

  async rejeitarAprovacao(id: string, observacao?: string): Promise<void> {
    await supabase
      .from("automacoes_aprovacoes")
      .update({ status: "rejeitado", observacao: observacao || null })
      .eq("id", id);
    const { data: ap } = await supabase
      .from("automacoes_aprovacoes")
      .select("tarefa_id")
      .eq("id", id)
      .single();
    if (ap?.tarefa_id) {
      await supabase
        .from("automacoes_tarefas")
        .update({ status: "cancelada", resultado: { aprovado: false, observacao } })
        .eq("id", ap.tarefa_id);
    }
    await centralIaService.registrarLog({
      acao: "aprovacao_rejeitada",
      entrada: { aprovacao_id: id, observacao },
      status: "aviso",
    });
  },

  async editarAprovacao(id: string, conteudoEditado: Record<string, unknown>, aprovado_por?: string): Promise<void> {
    const { data: ap } = await supabase
      .from("automacoes_aprovacoes")
      .select("conteudo_original, conteudo_sugerido")
      .eq("id", id)
      .single();
    await supabase
      .from("automacoes_aprovacoes")
      .update({
        status: "editado",
        conteudo_original: (ap as { conteudo_original: Record<string, unknown> })?.conteudo_original || {},
        conteudo_sugerido: conteudoEditado,
        aprovado_por: aprovado_por || null,
        aprovado_em: new Date().toISOString(),
      })
      .eq("id", id);
    if ((ap as { tarefa_id?: string })?.tarefa_id) {
      await supabase
        .from("automacoes_tarefas")
        .update({ status: "concluida", resultado: { editado: true, conteudo: conteudoEditado } })
        .eq("id", (ap as { tarefa_id: string }).tarefa_id);
    }
    await centralIaService.registrarLog({
      acao: "aprovacao_editada",
      entrada: { aprovacao_id: id, conteudo_editado: conteudoEditado },
      status: "sucesso",
    });
  },

  // ==================== F22: AUTOMAÇÕES LOGS ====================
  async listarLogs(params?: {
    robo_id?: string;
    tarefa_id?: string;
    acao?: string;
    status?: string;
  }): Promise<AutoLog[]> {
    let query = supabase
      .from("automacoes_logs")
      .select("*")
      .order("criado_em", { ascending: false });
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.tarefa_id) query = query.eq("tarefa_id", params.tarefa_id);
    if (params?.acao) query = query.eq("acao", params.acao);
    if (params?.status) query = query.eq("status", params.status);
    const { data } = await query;
    return (data as AutoLog[]) || [];
  },

  async registrarLog(log: {
    robo_id?: string;
    tarefa_id?: string;
    acao: string;
    entrada?: Record<string, unknown>;
    saida?: Record<string, unknown>;
    status?: "sucesso" | "erro" | "info" | "aviso";
    erro?: string;
  }): Promise<void> {
    await supabase.from("automacoes_logs").insert({
      robo_id: log.robo_id || null,
      tarefa_id: log.tarefa_id || null,
      acao: log.acao,
      entrada: log.entrada || {},
      saida: log.saida || {},
      status: log.status || "info",
      erro: log.erro || null,
    });
  },

  // ==================== F22: SIMULADOR DRY-RUN ====================
  async simularMensagemRobo(params: SimularMensagemParams): Promise<{
    tarefa: AutoTarefa | null;
    aprovacao: AutoAprovacao | null;
    mensagem: ComunicacaoMensagem | null;
  }> {
    const fallbackMsg = "Vou direcionar para o respons\u00e1vel pelo setor e j\u00e1 retorno com uma posi\u00e7\u00e3o.";
    const assinatura = ASSINATURAS[params.setor] || "Conex\u00e3o Express";
    const conteudoGerado = cleanText(
      `${params.objetivo}\n\nAtenciosamente,\n${assinatura}`
    );

    const tarefa = await centralIaService.criarTarefa({
      robo_id: params.roboId || null,
      setor: params.setor,
      tipo_tarefa: "mensagem",
      origem_tipo: params.origemTipo,
      origem_id: params.origemId,
      titulo: `Mensagem para ${params.destinatarioTipo}: ${params.objetivo.slice(0, 60)}`,
      descricao: params.objetivo,
      prioridade: "normal",
      status: "pendente",
      payload: {
        destinatario_tipo: params.destinatarioTipo,
        destinatario_nome: params.destinatarioNome,
        canal: params.canal,
        conteudo_gerado: conteudoGerado,
        contexto: params.contexto || {},
      },
    });

    if (!tarefa) return { tarefa: null, aprovacao: null, mensagem: null };

    const aprovacao = await centralIaService.criarAprovacao({
      tarefa_id: tarefa.id,
      tipo_aprovacao: params.destinatarioTipo === "cliente" ? "mensagem_cliente"
        : params.destinatarioTipo === "prestador" ? "mensagem_prestador"
        : "outro",
      conteudo_original: { objetivo: params.objetivo },
      conteudo_sugerido: {
        destinatario: params.destinatarioNome || params.destinatarioTipo,
        canal: params.canal,
        mensagem: conteudoGerado,
        assinatura,
      },
    });

    await centralIaService.registrarLog({
      robo_id: params.roboId,
      tarefa_id: tarefa.id,
      acao: "mensagem_simulada",
      entrada: {
        objetivo: params.objetivo,
        destinatario_tipo: params.destinatarioTipo,
        canal: params.canal,
      },
      saida: {
        tarefa_id: tarefa.id,
        aprovacao_id: aprovacao?.id,
        mensagem_gerada: conteudoGerado,
      },
      status: "info",
    });

    const { data: msg } = await supabase
      .from("comunicacoes_mensagens")
      .insert({
        robo_id: params.roboId || null,
        tarefa_id: tarefa.id,
        origem_tipo: params.origemTipo,
        origem_id: params.origemId,
        destinatario_tipo: params.destinatarioTipo,
        destinatario_nome: params.destinatarioNome || null,
        canal: params.canal,
        assunto: `Mensagem simulada - ${params.objetivo.slice(0, 60)}`,
        conteudo: conteudoGerado,
        status: "simulado",
        modo_seguro: true,
        contexto: {
          fallback: fallbackMsg,
          objetivo: params.objetivo,
          assinatura,
        },
      })
      .select()
      .single();

    return {
      tarefa,
      aprovacao,
      mensagem: msg as ComunicacaoMensagem | null,
    };
  },

  // ==================== F22: COMUNICAÇÕES ====================
  async listarMensagens(params?: {
    status?: string;
    canal?: string;
    destinatario_tipo?: string;
  }): Promise<ComunicacaoMensagem[]> {
    let query = supabase
      .from("comunicacoes_mensagens")
      .select("*")
      .order("criado_em", { ascending: false });
    if (params?.status) query = query.eq("status", params.status);
    if (params?.canal) query = query.eq("canal", params.canal);
    if (params?.destinatario_tipo) query = query.eq("destinatario_tipo", params.destinatario_tipo);
    const { data } = await query;
    return (data as ComunicacaoMensagem[]) || [];
  },

  // ==================== F25C: INSTRUÇÕES VERSIONADAS ====================
  async listarInstrucoesRobo(roboId: string): Promise<AutomacaoInstrucao[]> {
    const { data } = await supabase
      .from("automacoes_instrucoes")
      .select("*")
      .eq("robo_id", roboId)
      .order("versao", { ascending: false });
    return (data as AutomacaoInstrucao[]) || [];
  },

  async obterInstrucaoAtiva(roboId: string): Promise<AutomacaoInstrucao | null> {
    const { data } = await supabase
      .from("automacoes_instrucoes")
      .select("*")
      .eq("robo_id", roboId)
      .eq("ativo", true)
      .eq("status", "publicado")
      .single();
    return (data as AutomacaoInstrucao) || null;
  },

  async criarInstrucaoRobo(payload: {
    robo_id: string;
    objetivo?: string;
    tom_de_conversa?: string;
    regras_fixas?: string;
    perguntas_obrigatorias?: string;
    respostas_padrao?: unknown[];
    limites_de_atuacao?: string;
    quando_chamar_humano?: string;
    proibicoes?: string;
    exemplos_de_conversa?: unknown[];
    instrucoes_completas?: string;
  }): Promise<AutomacaoInstrucao | null> {
    const { data: existentes } = await supabase
      .from("automacoes_instrucoes")
      .select("versao")
      .eq("robo_id", payload.robo_id)
      .order("versao", { ascending: false })
      .limit(1);
    const proximaVersao = (existentes && existentes.length > 0 ? existentes[0].versao : 0) + 1;

    const { data } = await supabase
      .from("automacoes_instrucoes")
      .insert({
        ...payload,
        versao: proximaVersao,
        status: "rascunho",
        ativo: false,
      })
      .select()
      .single();

    await centralIaService.registrarLog({
      robo_id: payload.robo_id,
      tarefa_id: null,
      acao: "instrucao_criada",
      entrada: { versao: proximaVersao },
      saida: { instrucao_id: data?.id },
      status: "info",
    });

    return (data as AutomacaoInstrucao) || null;
  },

  async salvarRascunhoInstrucao(id: string, payload: Partial<AutomacaoInstrucao>): Promise<void> {
    const { data: antes } = await supabase
      .from("automacoes_instrucoes")
      .select("robo_id, versao")
      .eq("id", id)
      .single();

    await supabase
      .from("automacoes_instrucoes")
      .update({ ...payload, atualizado_em: new Date().toISOString() })
      .eq("id", id);

    await centralIaService.registrarLog({
      robo_id: antes?.robo_id || null,
      tarefa_id: null,
      acao: "instrucao_editada",
      entrada: { instrucao_id: id, versao: antes?.versao },
      saida: payload,
      status: "info",
    });
  },

  async validarInstrucaoSeguranca(instrucao: Partial<AutomacaoInstrucao>): Promise<{
    valida: boolean;
    motivos: string[];
  }> {
    const motivos: string[] = [];
    const textoCompleto = [
      instrucao.objetivo,
      instrucao.regras_fixas,
      instrucao.instrucoes_completas,
      instrucao.limites_de_atuacao,
    ].filter(Boolean).join(" ").toLowerCase();

    if (/sou\s+robô/.test(textoCompleto)) {
      motivos.push("Instrução contém 'sou robô' — proibido.");
    }
    if (/sou\s+ia/.test(textoCompleto) || /sou\s+inteligência\s+artificial/.test(textoCompleto)) {
      motivos.push("Instrução contém 'sou IA' — proibido.");
    }
    if (/(prometer|garantir|assegurar)\s+(preço|valor|taxa)/i.test(textoCompleto) &&
        !/(mediante\s+aprovação|após\s+aprovação|sob\s+aprovação)/i.test(textoCompleto)) {
      motivos.push("Instrução permite prometer preço final sem aprovação humana.");
    }
    if (/(aprovar|aceitar|contratar)\s+(motorista|candidato|prestador)/i.test(textoCompleto) &&
        !/(mediante\s+aprovação|após\s+aprovação)/i.test(textoCompleto)) {
      motivos.push("Instrução permite aprovar motorista/candidato sem humano.");
    }
    if (/(enviar|disparar|remeter)\s+(mensagem|whatsapp|email)\s+(sem|independente)\s+(aprovação|revisão)/i.test(textoCompleto)) {
      motivos.push("Instrução permite envio externo sem aprovação.");
    }

    return { valida: motivos.length === 0, motivos };
  },

  async enviarInstrucaoParaRevisao(id: string): Promise<void> {
    const { data: instrucao } = await supabase
      .from("automacoes_instrucoes")
      .select("robo_id, versao")
      .eq("id", id)
      .single();

    await supabase
      .from("automacoes_instrucoes")
      .update({ status: "em_revisao", atualizado_em: new Date().toISOString() })
      .eq("id", id);

    await centralIaService.registrarLog({
      robo_id: instrucao?.robo_id || null,
      tarefa_id: null,
      acao: "instrucao_enviada_revisao",
      entrada: { instrucao_id: id, versao: instrucao?.versao },
      saida: {},
      status: "info",
    });
  },

  async publicarInstrucao(id: string, usuarioId?: string): Promise<{
    sucesso: boolean;
    motivos?: string[];
  }> {
    const { data: instrucao } = await supabase
      .from("automacoes_instrucoes")
      .select("*")
      .eq("id", id)
      .single();

    if (!instrucao) return { sucesso: false, motivos: ["Instrução não encontrada"] };

    // Validações de segurança
    if (!instrucao.quando_chamar_humano || instrucao.quando_chamar_humano.trim() === "") {
      return { sucesso: false, motivos: ["'Quando chamar humano' é obrigatório."] };
    }
    if (!instrucao.proibicoes || instrucao.proibicoes.trim() === "") {
      return { sucesso: false, motivos: ["'Proibições' é obrigatório."] };
    }
    const seguranca = await centralIaService.validarInstrucaoSeguranca(instrucao);
    if (!seguranca.valida) {
      await centralIaService.registrarLog({
        robo_id: instrucao.robo_id,
        tarefa_id: null,
        acao: "publicacao_bloqueada",
        entrada: { instrucao_id: id, motivos: seguranca.motivos },
        saida: {},
        status: "aviso",
      });
      return { sucesso: false, motivos: seguranca.motivos };
    }

    // Desativar versões anteriores
    await supabase
      .from("automacoes_instrucoes")
      .update({ ativo: false })
      .eq("robo_id", instrucao.robo_id)
      .neq("id", id);

    // Publicar
    await supabase
      .from("automacoes_instrucoes")
      .update({
        status: "publicado",
        ativo: true,
        publicado_por: usuarioId || null,
        publicado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", id);

    await centralIaService.registrarLog({
      robo_id: instrucao.robo_id,
      tarefa_id: null,
      acao: "instrucao_publicada",
      entrada: { instrucao_id: id, versao: instrucao.versao },
      saida: {},
      status: "sucesso",
    });

    return { sucesso: true };
  },

  async arquivarInstrucao(id: string): Promise<void> {
    const { data: instrucao } = await supabase
      .from("automacoes_instrucoes")
      .select("robo_id, versao, ativo")
      .eq("id", id)
      .single();

    await supabase
      .from("automacoes_instrucoes")
      .update({
        status: "arquivado",
        ativo: false,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", id);

    await centralIaService.registrarLog({
      robo_id: instrucao?.robo_id || null,
      tarefa_id: null,
      acao: "instrucao_arquivada",
      entrada: { instrucao_id: id, versao: instrucao?.versao },
      saida: {},
      status: "info",
    });
  },

  async duplicarInstrucaoComoNovaVersao(roboId: string, instrucaoId: string): Promise<AutomacaoInstrucao | null> {
    const { data: original } = await supabase
      .from("automacoes_instrucoes")
      .select("*")
      .eq("id", instrucaoId)
      .single();

    if (!original) return null;

    const { data: existentes } = await supabase
      .from("automacoes_instrucoes")
      .select("versao")
      .eq("robo_id", roboId)
      .order("versao", { ascending: false })
      .limit(1);
    const proximaVersao = (existentes && existentes.length > 0 ? existentes[0].versao : 0) + 1;

    const { data: nova } = await supabase
      .from("automacoes_instrucoes")
      .insert({
        robo_id: roboId,
        versao: proximaVersao,
        objetivo: original.objetivo,
        tom_de_conversa: original.tom_de_conversa,
        regras_fixas: original.regras_fixas,
        perguntas_obrigatorias: original.perguntas_obrigatorias,
        respostas_padrao: original.respostas_padrao,
        limites_de_atuacao: original.limites_de_atuacao,
        quando_chamar_humano: original.quando_chamar_humano,
        proibicoes: original.proibicoes,
        exemplos_de_conversa: original.exemplos_de_conversa,
        instrucoes_completas: original.instrucoes_completas,
        status: "rascunho",
        ativo: false,
      })
      .select()
      .single();

    await centralIaService.registrarLog({
      robo_id: roboId,
      tarefa_id: null,
      acao: "instrucao_duplicada",
      entrada: { instrucao_origem: instrucaoId, versao_origem: original.versao },
      saida: { instrucao_nova: nova?.id, versao_nova: proximaVersao },
      status: "info",
    });

    return (nova as AutomacaoInstrucao) || null;
  },

  // ==================== F25C: BASE DE CONHECIMENTO ====================
  async listarConhecimentoRobo(roboId: string): Promise<IaConhecimento[]> {
    const { data } = await supabase
      .from("ia_conhecimento")
      .select("*")
      .or(`robo_id.eq.${roboId},robo_id.is.null`)
      .order("criado_em", { ascending: false });
    return (data as IaConhecimento[]) || [];
  },

  async criarConhecimento(payload: {
    robo_id?: string;
    setor_id?: string;
    categoria?: string;
    titulo: string;
    conteudo: string;
    setor?: string;
    tags?: string[];
    status?: string;
    validade_inicio?: string;
    validade_fim?: string;
  }): Promise<IaConhecimento | null> {
    const { data } = await supabase
      .from("ia_conhecimento")
      .insert({
        ...payload,
        tags: payload.tags || [],
        status: payload.status || "ativo",
      })
      .select()
      .single();

    await centralIaService.registrarLog({
      robo_id: payload.robo_id || null,
      tarefa_id: null,
      acao: "conhecimento_criado",
      entrada: { titulo: payload.titulo, categoria: payload.categoria },
      saida: { conhecimento_id: data?.id },
      status: "info",
    });

    return (data as IaConhecimento) || null;
  },

  async atualizarConhecimento(id: string, payload: Partial<IaConhecimento>): Promise<void> {
    const { data: antes } = await supabase
      .from("ia_conhecimento")
      .select("robo_id, titulo")
      .eq("id", id)
      .single();

    await supabase
      .from("ia_conhecimento")
      .update({ ...payload, atualizado_em: new Date().toISOString() })
      .eq("id", id);

    await centralIaService.registrarLog({
      robo_id: antes?.robo_id || null,
      tarefa_id: null,
      acao: "conhecimento_editado",
      entrada: { conhecimento_id: id, titulo_original: antes?.titulo },
      saida: payload,
      status: "info",
    });
  },

  async arquivarConhecimento(id: string): Promise<void> {
    const { data: item } = await supabase
      .from("ia_conhecimento")
      .select("robo_id, titulo")
      .eq("id", id)
      .single();

    await supabase
      .from("ia_conhecimento")
      .update({ status: "inativo", atualizado_em: new Date().toISOString() })
      .eq("id", id);

    await centralIaService.registrarLog({
      robo_id: item?.robo_id || null,
      tarefa_id: null,
      acao: "conhecimento_arquivado",
      entrada: { conhecimento_id: id, titulo: item?.titulo },
      saida: {},
      status: "info",
    });
  },

  async buscarConhecimentoPorTags(roboId: string, tags: string[]): Promise<IaConhecimento[]> {
    const { data } = await supabase
      .from("ia_conhecimento")
      .select("*")
      .or(`robo_id.eq.${roboId},robo_id.is.null`)
      .overlaps("tags", tags)
      .order("criado_em", { ascending: false });
    return (data as IaConhecimento[]) || [];
  },

  async buscarConhecimentoValido(roboId: string): Promise<IaConhecimento[]> {
    const hoje = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("ia_conhecimento")
      .select("*")
      .or(`robo_id.eq.${roboId},robo_id.is.null`)
      .eq("status", "ativo")
      .or(`validade_inicio.is.null,validade_inicio.lte.${hoje}`)
      .or(`validade_fim.is.null,validade_fim.gte.${hoje}`)
      .order("criado_em", { ascending: false });
    return (data as IaConhecimento[]) || [];
  },

  // ==================== F25D: REGRAS OPERACIONAIS ====================
  async listarRegrasOperacao(params?: {
    robo_id?: string;
    setor?: string;
    status?: StatusRegraOperacao;
  }): Promise<AutomacaoRegraOperacao[]> {
    let query = supabase
      .from("automacoes_regras_operacao")
      .select("*")
      .order("criado_em", { ascending: false });
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.setor) query = query.eq("setor", params.setor);
    if (params?.status) query = query.eq("status", params.status);
    const { data } = await query;
    return (data as AutomacaoRegraOperacao[]) || [];
  },

  async criarRegraOperacao(payload: {
    robo_id: string;
    cliente_id?: string;
    nome_operacao: string;
    setor: string;
    tipo_veiculo?: string;
    capacidade?: string;
    local_carregamento?: string;
    cidade_operacao?: string;
    horario_inicio?: string;
    horario_fim?: string;
    dias_operacao?: string;
    valor_operacao?: number;
    modelo_pagamento?: string;
    km_incluso?: number;
    valor_km_excedente?: number;
    documentos_obrigatorios?: string[];
    exige_treinamento?: boolean;
    criterios_aprovacao?: string;
    criterios_reprovacao?: string;
    mensagem_inicial?: string;
    status?: string;
    validade_inicio?: string;
    validade_fim?: string;
  }): Promise<AutomacaoRegraOperacao | null> {
    const { data } = await supabase
      .from("automacoes_regras_operacao")
      .insert({
        ...payload,
        documentos_obrigatorios: payload.documentos_obrigatorios || [],
        status: payload.status || "ativo",
      })
      .select()
      .single();

    await centralIaService.registrarLog({
      robo_id: payload.robo_id,
      tarefa_id: null,
      acao: "regra_operacao_criada",
      entrada: { nome_operacao: payload.nome_operacao, setor: payload.setor },
      saida: { regra_id: data?.id },
      status: "info",
    });

    return (data as AutomacaoRegraOperacao) || null;
  },

  async atualizarRegraOperacao(id: string, payload: Partial<AutomacaoRegraOperacao>): Promise<void> {
    const { data: antes } = await supabase
      .from("automacoes_regras_operacao")
      .select("robo_id, nome_operacao")
      .eq("id", id)
      .single();

    await supabase
      .from("automacoes_regras_operacao")
      .update({ ...payload, atualizado_em: new Date().toISOString() })
      .eq("id", id);

    await centralIaService.registrarLog({
      robo_id: antes?.robo_id || null,
      tarefa_id: null,
      acao: "regra_operacao_editada",
      entrada: { regra_id: id, nome_operacao: antes?.nome_operacao },
      saida: payload,
      status: "info",
    });
  },

  async desativarRegraOperacao(id: string): Promise<void> {
    const { data: item } = await supabase
      .from("automacoes_regras_operacao")
      .select("robo_id, nome_operacao")
      .eq("id", id)
      .single();

    await supabase
      .from("automacoes_regras_operacao")
      .update({ status: "inativo", atualizado_em: new Date().toISOString() })
      .eq("id", id);

    await centralIaService.registrarLog({
      robo_id: item?.robo_id || null,
      tarefa_id: null,
      acao: "regra_operacao_desativada",
      entrada: { regra_id: id, nome_operacao: item?.nome_operacao },
      saida: {},
      status: "info",
    });
  },

  async buscarRegrasOperacaoValidas(roboId: string): Promise<AutomacaoRegraOperacao[]> {
    const hoje = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("automacoes_regras_operacao")
      .select("*")
      .eq("robo_id", roboId)
      .eq("status", "ativo")
      .or(`validade_inicio.is.null,validade_inicio.lte.${hoje}`)
      .or(`validade_fim.is.null,validade_fim.gte.${hoje}`)
      .order("criado_em", { ascending: false });
    return (data as AutomacaoRegraOperacao[]) || [];
  },

  // ==================== F25E: GATILHOS E ALERTAS ====================
  async listarGatilhos(params?: {
    robo_id?: string;
    setor?: string;
    evento?: string;
    prioridade?: string;
    ativo?: boolean;
  }): Promise<AutomacaoGatilho[]> {
    let query = supabase
      .from("automacoes_gatilhos")
      .select("*")
      .order("criado_em", { ascending: false });
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.setor) query = query.eq("setor", params.setor);
    if (params?.evento) query = query.eq("evento", params.evento);
    if (params?.prioridade) query = query.eq("prioridade", params.prioridade);
    if (params?.ativo !== undefined) query = query.eq("ativo", params.ativo);
    const { data } = await query;
    return (data as AutomacaoGatilho[]) || [];
  },

  async criarGatilho(payload: {
    robo_id: string;
    nome: string;
    setor: string;
    evento: string;
    descricao?: string;
    prioridade?: string;
    tipo_acao?: string;
    nivel_risco?: string;
    exige_aprovacao_humana?: boolean;
    permite_execucao_automatica?: boolean;
  }): Promise<AutomacaoGatilho | null> {
    const { data } = await supabase
      .from("automacoes_gatilhos")
      .insert({
        robo_id: payload.robo_id,
        nome: payload.nome || "Novo gatilho",
        setor: payload.setor,
        evento: payload.evento,
        descricao: payload.descricao || null,
        prioridade: payload.prioridade || "normal",
        tipo_acao: payload.tipo_acao || "criar_tarefa",
        nivel_risco: payload.nivel_risco || "medio",
        exige_aprovacao_humana: payload.exige_aprovacao_humana ?? true,
        permite_execucao_automatica: payload.permite_execucao_automatica ?? false,
        criar_tarefa: (payload.tipo_acao || "criar_tarefa") === "criar_tarefa",
        ativo: true,
      })
      .select()
      .single();

    await centralIaService.registrarLog({
      robo_id: payload.robo_id,
      tarefa_id: null,
      acao: "gatilho_criado",
      entrada: { nome: payload.nome, evento: payload.evento },
      saida: { gatilho_id: data?.id },
      status: "info",
    });

    return (data as AutomacaoGatilho) || null;
  },

  async atualizarGatilho(id: string, payload: Partial<AutomacaoGatilho>): Promise<void> {
    const { data: antes } = await supabase
      .from("automacoes_gatilhos")
      .select("robo_id, nome")
      .eq("id", id)
      .single();

    await supabase
      .from("automacoes_gatilhos")
      .update({ ...payload, atualizado_em: new Date().toISOString() })
      .eq("id", id);

    await centralIaService.registrarLog({
      robo_id: antes?.robo_id || null,
      tarefa_id: null,
      acao: "gatilho_editado",
      entrada: { gatilho_id: id, nome: antes?.nome },
      saida: payload,
      status: "info",
    });
  },

  async toggleGatilho(id: string, ativo: boolean): Promise<void> {
    const { data: gatilho } = await supabase
      .from("automacoes_gatilhos")
      .select("robo_id, nome")
      .eq("id", id)
      .single();

    await supabase
      .from("automacoes_gatilhos")
      .update({ ativo, atualizado_em: new Date().toISOString() })
      .eq("id", id);

    await centralIaService.registrarLog({
      robo_id: gatilho?.robo_id || null,
      tarefa_id: null,
      acao: ativo ? "gatilho_ativado" : "gatilho_desativado",
      entrada: { gatilho_id: id, nome: gatilho?.nome },
      saida: { ativo },
      status: "info",
    });
  },

  async buscarGatilhosAtivos(roboId: string, evento: string): Promise<AutomacaoGatilho[]> {
    const { data } = await supabase
      .from("automacoes_gatilhos")
      .select("*")
      .eq("robo_id", roboId)
      .eq("evento", evento)
      .eq("ativo", true)
      .order("prioridade", { ascending: true });
    return (data as AutomacaoGatilho[]) || [];
  },

  async executarGatilho(gatilhoId: string, payloadEvento: Record<string, unknown>): Promise<{
    executado: boolean;
    acao?: string;
    tarefa_id?: string;
    aprovacao_id?: string;
    erro?: string;
  }> {
    const { data: gatilho } = await supabase
      .from("automacoes_gatilhos")
      .select("*")
      .eq("id", gatilhoId)
      .single();

    if (!gatilho) return { executado: false, erro: "Gatilho não encontrado" };
    if (!gatilho.ativo) return { executado: false, erro: "Gatilho inativo" };

    const g = gatilho as AutomacaoGatilho;
    const resultado: Record<string, unknown> = {};
    let tarefaId: string | undefined;
    let aprovacaoId: string | undefined;

    // Executar ação conforme tipo
    if (g.tipo_acao === "criar_tarefa" || g.criar_tarefa) {
      const tarefa = await centralIaService.criarTarefa({
        robo_id: g.robo_id,
        setor: g.setor,
        tipo_tarefa: "gatilho",
        titulo: `[${g.nome}] ${payloadEvento.mensagem || g.descricao || "Evento automático"}`,
        descricao: JSON.stringify(payloadEvento),
        prioridade: g.prioridade as "baixa" | "normal" | "alta" | "critica",
        payload: { gatilho_id: g.id, evento: g.evento, ...payloadEvento },
      });
      if (tarefa) {
        tarefaId = tarefa.id;
        resultado.tarefa_id = tarefa.id;
        resultado.tarefa_titulo = tarefa.titulo;
      }
    }

    if (g.tipo_acao === "criar_aprovacao" || g.criar_aprovacao) {
      if (tarefaId) {
        const aprovacao = await centralIaService.criarAprovacao({
          tarefa_id: tarefaId,
          tipo_aprovacao: "outro",
          conteudo_original: payloadEvento,
          conteudo_sugerido: resultado,
        });
        if (aprovacao) {
          aprovacaoId = aprovacao.id;
          resultado.aprovacao_id = aprovacao.id;
        }
      }
    }

    // Registrar execução
    const { data: exec } = await supabase
      .from("automacoes_gatilhos_execucao")
      .insert({
        gatilho_id: g.id,
        robo_id: g.robo_id,
        evento: g.evento,
        tipo_acao: g.tipo_acao,
        payload: payloadEvento,
        resultado,
        status: "processado",
      })
      .select()
      .single();

    await centralIaService.registrarLog({
      robo_id: g.robo_id,
      tarefa_id: tarefaId || null,
      acao: "gatilho_executado",
      entrada: { gatilho_id: g.id, nome: g.nome, evento: g.evento, payload: payloadEvento },
      saida: { resultado, execucao_id: exec?.id },
      status: "sucesso",
    });

    return {
      executado: true,
      acao: g.tipo_acao,
      tarefa_id: tarefaId,
      aprovacao_id: aprovacaoId,
    };
  },

  async simularDisparoGatilho(gatilhoId: string): Promise<{
    gatilho: AutomacaoGatilho | null;
    resultado: string;
  }> {
    const { data: gatilho } = await supabase
      .from("automacoes_gatilhos")
      .select("*")
      .eq("id", gatilhoId)
      .single();

    if (!gatilho) return { gatilho: null, resultado: "Gatilho não encontrado" };
    const g = gatilho as AutomacaoGatilho;

    if (!g.ativo) return { gatilho: g, resultado: "Gatilho inativo — simulação não executada" };

    const payloadSimulado: Record<string, unknown> = {
      evento: g.evento,
      mensagem: `Simulação de disparo para evento "${g.evento}" no robô ${g.robo_id}`,
      tipo_acao: g.tipo_acao,
      nivel_risco: g.nivel_risco,
      simulado: true,
    };

    const execucao = await centralIaService.executarGatilho(gatilhoId, payloadSimulado);

    return {
      gatilho: g,
      resultado: JSON.stringify({
        status: execucao.executado ? "executado" : "falhou",
        acao: execucao.acao,
        tarefa_id: execucao.tarefa_id,
        erro: execucao.erro,
        payload_simulado: payloadSimulado,
      }, null, 2),
    };
  },

  // ==================== F25C: AUDITORIA ====================
  async registrarLogInstrucao(params: {
    robo_id: string | null;
    instrucao_id: string;
    acao: string;
    detalhes?: Record<string, unknown>;
  }): Promise<void> {
    await centralIaService.registrarLog({
      robo_id: params.robo_id,
      tarefa_id: null,
      acao: params.acao,
      entrada: { instrucao_id: params.instrucao_id, ...params.detalhes },
      saida: {},
      status: "info",
    });
  },

  async registrarLogConhecimento(params: {
    robo_id: string | null;
    conhecimento_id: string;
    acao: string;
    detalhes?: Record<string, unknown>;
  }): Promise<void> {
    await centralIaService.registrarLog({
      robo_id: params.robo_id,
      tarefa_id: null,
      acao: params.acao,
      entrada: { conhecimento_id: params.conhecimento_id, ...params.detalhes },
      saida: {},
      status: "info",
    });
  },

  // ==================== F25C: PROMPT OPERACIONAL DO ROBÔ ====================
  async montarPromptOperacionalRobo(roboId: string): Promise<PromptOperacionalRobo> {
    const alertasSeguranca: string[] = [];

    // 1. Dados do robô
    const { data: robo } = await supabase
      .from("automacoes_robos")
      .select("*")
      .eq("id", roboId)
      .single();
    const roboData = robo as AutomacaoRobo | null;

    if (!roboData) {
      return {
        robo: null,
        instrucaoAtiva: null,
        conhecimento: [],
        promptFinal: "Robô não encontrado.",
        alertasSeguranca: ["Robô não encontrado"],
      };
    }

    // 2. Instrução ativa
    const instrucaoAtiva = await centralIaService.obterInstrucaoAtiva(roboId);

    // 3. Base de conhecimento válida
    const conhecimento = await centralIaService.buscarConhecimentoValido(roboId);

    // 4. Regras da operação ativas
    const regrasOperacao = await centralIaService.buscarRegrasOperacaoValidas(roboId);

    // 5. Montagem do prompt final
    const partes: string[] = [];

    // Identidade do robô
    partes.push(`=== IDENTIDADE DO ROBÔ ===`);
    partes.push(`Nome: ${roboData.nome}`);
    partes.push(`Setor: ${roboData.setor}`);
    partes.push(`Modo atual: ${roboData.modo_atual || "seguro"}`);
    partes.push(`Nível de autonomia: ${roboData.nivel_autonomia || "manual"}`);
    partes.push(`Permite envio externo: ${roboData.permite_envio_externo ? "Sim" : "Não"}`);
    partes.push(`Exige aprovação humana: ${roboData.exige_aprovacao_humana ? "Sim" : "Não"}`);
    partes.push(`Fallback: ${roboData.mensagem_fallback}`);
    partes.push("");

    // Instrução ativa
    if (instrucaoAtiva) {
      partes.push(`=== INSTRUÇÃO ATIVA (v${instrucaoAtiva.versao}) ===`);
      partes.push(`Objetivo: ${instrucaoAtiva.objetivo || "Não definido"}`);
      partes.push(`Tom de conversa: ${instrucaoAtiva.tom_de_conversa || "Não definido"}`);
      if (instrucaoAtiva.regras_fixas) {
        partes.push(`Regras fixas:\n${instrucaoAtiva.regras_fixas}`);
      }
      if (instrucaoAtiva.perguntas_obrigatorias) {
        partes.push(`Perguntas obrigatórias:\n${instrucaoAtiva.perguntas_obrigatorias}`);
      }
      if (instrucaoAtiva.respostas_padrao && instrucaoAtiva.respostas_padrao.length > 0) {
        partes.push(`Respostas padrão: ${JSON.stringify(instrucaoAtiva.respostas_padrao)}`);
      }
      if (instrucaoAtiva.limites_de_atuacao) {
        partes.push(`Limites de atuação:\n${instrucaoAtiva.limites_de_atuacao}`);
      }
      if (instrucaoAtiva.quando_chamar_humano) {
        partes.push(`Quando chamar humano:\n${instrucaoAtiva.quando_chamar_humano}`);
      } else {
        alertasSeguranca.push("Instrução ativa não define 'quando chamar humano'.");
      }
      if (instrucaoAtiva.proibicoes) {
        partes.push(`Proibições:\n${instrucaoAtiva.proibicoes}`);
      } else {
        alertasSeguranca.push("Instrução ativa não define 'proibições'.");
      }
      if (instrucaoAtiva.exemplos_de_conversa && instrucaoAtiva.exemplos_de_conversa.length > 0) {
        partes.push(`Exemplos de conversa: ${JSON.stringify(instrucaoAtiva.exemplos_de_conversa)}`);
      }
      if (instrucaoAtiva.instrucoes_completas) {
        partes.push(`Instruções completas:\n${instrucaoAtiva.instrucoes_completas}`);
      }
      partes.push("");
    } else {
      partes.push("=== INSTRUÇÃO ATIVA ===\nNenhuma instrução publicada para este robô.");
      alertasSeguranca.push("Nenhuma instrução ativa publicada.");
    }

    // Base de conhecimento
    if (conhecimento.length > 0) {
      partes.push(`=== BASE DE CONHECIMENTO (${conhecimento.length} itens) ===`);
      for (const item of conhecimento) {
        partes.push(`[${item.categoria || "Geral"}] ${item.titulo}`);
        partes.push(`Tags: ${item.tags?.join(", ") || "nenhuma"}`);
        partes.push(`Conteúdo: ${item.conteudo.slice(0, 500)}`);
        partes.push("---");
      }
      partes.push("");
    }

    // Regras de operação
    if (regrasOperacao.length > 0) {
      partes.push(`=== REGRAS DA OPERAÇÃO (${regrasOperacao.length} regras ativas) ===`);
      for (const regra of regrasOperacao) {
        partes.push(`--- ${regra.nome_operacao} ---`);
        if (regra.tipo_veiculo) partes.push(`Tipo de veículo: ${regra.tipo_veiculo}`);
        if (regra.capacidade) partes.push(`Capacidade: ${regra.capacidade}`);
        if (regra.local_carregamento) partes.push(`Local de carregamento: ${regra.local_carregamento}`);
        if (regra.cidade_operacao) partes.push(`Cidade de operação: ${regra.cidade_operacao}`);
        if (regra.horario_inicio) partes.push(`Horário início: ${regra.horario_inicio}`);
        if (regra.horario_fim) partes.push(`Horário fim: ${regra.horario_fim}`);
        if (regra.dias_operacao) partes.push(`Dias de operação: ${regra.dias_operacao}`);
        if (regra.valor_operacao) partes.push(`Valor da operação: R$ ${Number(regra.valor_operacao).toFixed(2)}`);
        if (regra.modelo_pagamento) partes.push(`Modelo de pagamento: ${regra.modelo_pagamento}`);
        if (regra.km_incluso) partes.push(`Km incluso: ${regra.km_incluso}`);
        if (regra.valor_km_excedente) partes.push(`Valor km excedente: R$ ${Number(regra.valor_km_excedente).toFixed(2)}`);
        if (regra.documentos_obrigatorios && regra.documentos_obrigatorios.length > 0) {
          partes.push(`Documentos obrigatórios: ${regra.documentos_obrigatorios.join(", ")}`);
        }
        if (regra.exige_treinamento) partes.push(`Exige treinamento: Sim`);
        if (regra.criterios_aprovacao) partes.push(`Critérios de aprovação:\n${regra.criterios_aprovacao}`);
        if (regra.criterios_reprovacao) partes.push(`Critérios de reprovação:\n${regra.criterios_reprovacao}`);
        if (regra.mensagem_inicial) partes.push(`Mensagem inicial: "${regra.mensagem_inicial}"`);
        partes.push("---");
      }
      partes.push("");
    }

    // Regras de segurança fixas (sempre incluídas)
    partes.push(`=== REGRAS DE SEGURANÇA FIXAS ===`);
    partes.push(`- Não diga que é um robô.`);
    partes.push(`- Não diga que é uma IA ou inteligência artificial.`);
    partes.push(`- Não finja ser uma pessoa física específica.`);
    partes.push(`- Nunca prometa preço final sem aprovação humana.`);
    partes.push(`- Nunca aprove um candidato/prestador sem supervisão humana.`);
    partes.push(`- Nunca altere uma operação sozinho.`);
    partes.push(`- Nunca negocie financeiro sozinho.`);
    partes.push(`- Quando houver dúvida, use a mensagem de fallback: "${roboData.mensagem_fallback}"`);
    partes.push(`- Se o robô não estiver autorizado a responder, direcione para o setor responsável.`);

    await centralIaService.registrarLog({
      robo_id: roboId,
      tarefa_id: null,
      acao: "prompt_montado",
      entrada: { instrucao_versao: instrucaoAtiva?.versao, conhecimento_count: conhecimento.length, regras_count: regrasOperacao.length },
      saida: { alertas: alertasSeguranca },
      status: alertasSeguranca.length > 0 ? "aviso" : "info",
    });

    return {
      robo: roboData,
      instrucaoAtiva,
      conhecimento,
      regrasOperacao,
      promptFinal: partes.join("\n"),
      alertasSeguranca,
    };
  },
};
