import { supabase } from "@/lib/supabase";

export interface IaSetor {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

export interface IaRegra {
  id?: string;
  setor_id: string;
  instrucoes_principais: string;
  o_que_pode_fazer: string;
  o_que_nao_pode_fazer: string;
  quando_chamar_humano: string;
}

export interface IaConhecimento {
  id: string;
  setor_id: string;
  titulo: string;
  conteudo: string;
  url_arquivo?: string;
  ativo: boolean;
  criado_em: string;
}

export interface IaLogDecisao {
  id: string;
  setor_id: string;
  entidade_id?: string;
  contexto: any;
  decisao: string;
  acao_executada: string;
  sucesso: boolean;
  detalhes_erro?: string;
  criado_em: string;
}

export const iaAutomacaoService = {
  // SETORES
  async listarSetores(): Promise<IaSetor[]> {
    const { data, error } = await supabase.from('ia_setores').select('*').order('nome');
    if (error) {
      console.error('Erro ao listar setores IA:', error);
      return [];
    }
    return data || [];
  },

  // REGRAS
  async carregarRegrasSetor(setorId: string): Promise<IaRegra | null> {
    const { data, error } = await supabase
      .from('ia_regras')
      .select('*')
      .eq('setor_id', setorId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 é "não encontrado", o que é OK
      console.error('Erro ao carregar regras:', error);
    }
    return data;
  },

  async salvarInstrucoes(regra: Partial<IaRegra>): Promise<boolean> {
    if (regra.id) {
      const { error } = await supabase.from('ia_regras').update(regra).eq('id', regra.id);
      return !error;
    } else {
      const { error } = await supabase.from('ia_regras').insert([regra]);
      return !error;
    }
  },

  // CONHECIMENTO
  async listarConhecimento(setorId: string): Promise<IaConhecimento[]> {
    const { data } = await supabase
      .from('ia_conhecimento')
      .select('*')
      .eq('setor_id', setorId)
      .order('criado_em', { ascending: false });
    return data || [];
  },

  async adicionarConhecimento(conhecimento: Omit<IaConhecimento, 'id' | 'criado_em'>): Promise<boolean> {
    const { error } = await supabase.from('ia_conhecimento').insert([conhecimento]);
    return !error;
  },

  // LOGS E DECISÕES
  async registrarDecisao(log: Omit<IaLogDecisao, 'id' | 'criado_em'>): Promise<boolean> {
    try {
      const { error } = await supabase.from('ia_decisoes_logs').insert([log]);
      if (error) console.error('Erro ao registrar decisão IA:', error);
      return !error;
    } catch (e) {
      return false;
    }
  },

  async listarLogsRecentes(setorId?: string): Promise<IaLogDecisao[]> {
    let query = supabase.from('ia_decisoes_logs').select('*').order('criado_em', { ascending: false }).limit(20);
    if (setorId) {
      query = query.eq('setor_id', setorId);
    }
    const { data } = await query;
    return data || [];
  },

  // FUNÇÕES CORE DE IA
  async identificarHumano(contexto: string, setorId: string): Promise<boolean> {
    // Aqui a IA analisaria o contexto contra as regras "quando_chamar_humano" do setor
    // Simulação temporária:
    const keywords = ['procon', 'processo', 'urgente', 'erro grave', 'humano', 'atendente', 'falar com pessoa'];
    return keywords.some(k => contexto.toLowerCase().includes(k));
  },

  async gerarRespostaSetor(contexto: any, setorId: string): Promise<string> {
    // 1. Carrega regras do setor
    const regras = await this.carregarRegrasSetor(setorId);
    
    // 2. Aqui você integraria com o Groq/Gemini usando `iaService.gerarRespostaIA`
    // passando o `regras.instrucoes_principais` no system prompt.
    
    // Simulação:
    console.log(`[IA Setor ${setorId}] Gerando resposta baseada nas regras:`, regras);
    return "Esta é uma resposta automatizada simulada da IA, respeitando as regras do setor.";
  },

  async criarTarefaAutomatica(setorId: string, nome: string, frequencia: string, prompt: string): Promise<boolean> {
    const { error } = await supabase.from('ia_tarefas_automaticas').insert([{
      setor_id: setorId,
      nome,
      frequencia,
      prompt_execucao: prompt
    }]);
    return !error;
  },

  async solicitarAprovacaoHumana(setorId: string, logId: string, motivo: string, contexto: any): Promise<boolean> {
    const { error } = await supabase.from('ia_aprovacoes_humanas').insert([{
      setor_id: setorId,
      log_decisao_id: logId,
      motivo_escalonamento: motivo,
      dados_contexto: contexto
    }]);
    return !error;
  }
};
