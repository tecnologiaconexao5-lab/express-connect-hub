import { supabase } from "@/lib/supabase";
import { proxyIaClient } from "@/services/ia/proxyIaClient";

export interface Candidato {
  id: string;
  nome_completo: string;
  cpf?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  cidade?: string;
  regiao?: string;
  tipo_veiculo?: string;
  tipo_carroceria?: string;
  placa?: string;
  experiencia_anos?: number;
  como_conheceu?: string;
  mensagem_livre?: string;
  canal_captacao?: string;
  status: string;
  score_perfil: number;
  prioridade: number;
  ultima_interacao?: string;
  created_at: string;
}

export interface AnalisePerfilResult {
  success: boolean;
  data?: {
    score: number;
    recomendacao: "aprovar" | "revisar" | "rejeitar";
    analise: string;
    verificacoes: Record<string, boolean>;
    acoes_sugeridas: string[];
  };
  error?: string;
}

export interface SugestaoReserva {
  candidato: Candidato;
  score_adequacao: number;
  motivo: string;
  status: "aprovado" | "interessado" | "inativo";
}

const callClaudeAPI = async (system: string, userMessage: string): Promise<string> => {
  const prompt = `${system}\n\n${userMessage}`;
  const resultado = await proxyIaClient.executar({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    prompt,
    max_tokens: 1024,
  });

  if (!resultado.sucesso) {
    console.warn("proxy-ia indisponível:", resultado.erro);
    return `MOCK: ${userMessage.substring(0, 50)}...`;
  }

  return resultado.resposta;
};

export async function calcularScorePerfil(candidato: Partial<Candidato>): Promise<number> {
  return candidato.score_perfil || 50;
}

export async function analisarPerfilCandidato(
  candidato: Partial<Candidato>,
): Promise<AnalisePerfilResult> {
  const verificacoes: Record<string, boolean> = {};

  if (candidato.cpf) {
    verificacoes.cpf_valido = validarCPF(candidato.cpf);
  } else {
    verificacoes.cpf_valido = false;
  }

  if (candidato.placa) {
    verificacoes.placa_valida = true;
  } else {
    verificacoes.placa_valida = false;
  }

  const score = candidato.score_perfil || 50;

  const recomendacao: "aprovar" | "revisar" | "rejeitar" = "revisar";

  const analise = `${candidato.nome_completo} possui ${candidato.tipo_veiculo || "veículo não informado"} na região ${candidato.regiao || "não informada"}. ` +
    `Análise automatizada concluída. Encaminhando para avaliação humana.`;

  return {
    success: true,
    data: {
      score,
      recomendacao,
      analise,
      verificacoes,
      acoes_sugeridas: gerarAcoesSugeridas(recomendacao, verificacoes)
    }
  };
}

function validarCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i]) * (10 - i);
  }
  let digit1 = 11 - (sum % 11);
  if (digit1 > 9) digit1 = 0;
  if (parseInt(clean[9]) !== digit1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean[i]) * (11 - i);
  }
  let digit2 = 11 - (sum % 11);
  if (digit2 > 9) digit2 = 0;

  return parseInt(clean[10]) === digit2;
}

function gerarAcoesSugeridas(recomendacao: string, verificacoes: Record<string, boolean>): string[] {
  const acoes: string[] = [];

  if (!verificacoes.cpf_valido) acoes.push("Solicitar CPF válido");
  if (!verificacoes.placa_valida) acoes.push("Confirmar placa do veículo");
  acoes.push("Encaminhar para análise humana via Central IA");

  return acoes;
}

export async function buscarReservasParaOperacao(
  tipoVeiculo: string,
  regiao: string,
  limite: number = 3
): Promise<SugestaoReserva[]> {
  try {
    const { data: candidatos, error } = await supabase
      .from("recrutamento_candidatos")
      .select("*, nome as nome_completo, veiculo as tipo_veiculo, stage as status, score as score_perfil")
      .or(
        [
          "stage.eq.aprovado",
          "stage.eq.homologado_disponivel",
          "stage.eq.homologado_indisponivel",
          "stage.eq.interesse_confirmado",
          "stage.eq.em_triagem",
          "stage.eq.em_analise_perfil",
          "stage.eq.bloqueado",
          "stage.eq.reprovado",
        ].join(","),
      )
      .order("score", { ascending: false })
      .limit(20);

    if (error) throw error;

    const sugestoes: SugestaoReserva[] = [];

    const mapStageToStatus = (stage: string): "aprovado" | "interessado" | "inativo" => {
      if (["aprovado", "homologado_disponivel", "homologado_indisponivel", "ativo"].includes(stage)) {
        return "aprovado";
      }
      if (["interesse_confirmado", "pre_triagem", "em_triagem", "em_analise_perfil"].includes(stage)) {
        return "interessado";
      }
      return "inativo";
    };

    (candidatos || []).forEach(c => {
      const statusMapeado = mapStageToStatus(c.status || "");
      sugestoes.push({
        candidato: c as Candidato,
        score_adequacao: c.score_perfil || 0,
        motivo: `Candidato disponível para operação. Score base: ${c.score_perfil || 0}. Consultar Central IA para recomendação detalhada.`,
        status: statusMapeado
      });
    });

    return sugestoes
      .sort((a, b) => b.score_adequacao - a.score_adequacao)
      .slice(0, limite);
  } catch (error) {
    console.error("Erro ao buscar reservas:", error);
    return [];
  }
}

export async function identificarCandidatosEsquecidos(): Promise<{
  interessados_sem_contato: Candidato[];
  aprovados_sem_ativar: Candidato[];
  inativos_sem_operacao: Candidato[];
}> {
  const hoje = new Date();
  const DIAS_INTERESSADO = 15;
  const DIAS_APROVADO = 30;
  const DIAS_INATIVO = 60;

  try {
    const { data: candidatos } = await supabase
      .from("recrutamento_candidatos")
      .select("*, nome as nome_completo, veiculo as tipo_veiculo, stage as status, score as score_perfil")
      .or(
        [
          "stage.eq.interesse_confirmado",
          "stage.eq.em_triagem",
          "stage.eq.em_analise_perfil",
          "stage.eq.aprovado",
          "stage.eq.homologado_disponivel",
          "stage.eq.homologado_indisponivel",
          "stage.eq.bloqueado",
          "stage.eq.reprovado",
        ].join(","),
      );

    const interessados_sem_contato: Candidato[] = [];
    const aprovados_sem_ativar: Candidato[] = [];
    const inativos_sem_operacao: Candidato[] = [];

    (candidatos || []).forEach(c => {
      const ultimaInteracao = c.ultima_interacao ? new Date(c.ultima_interacao) : new Date(c.created_at);
      const diasSemContato = Math.floor((hoje.getTime() - ultimaInteracao.getTime()) / (1000 * 60 * 60 * 24));

      if (
        ["interesse_confirmado", "em_triagem", "em_analise_perfil"].includes(c.status) &&
        diasSemContato > DIAS_INTERESSADO
      ) {
        interessados_sem_contato.push(c as Candidato);
      } else if (
        ["aprovado", "homologado_disponivel", "homologado_indisponivel"].includes(c.status) &&
        diasSemContato > DIAS_APROVADO
      ) {
        aprovados_sem_ativar.push(c as Candidato);
      } else if (
        ["bloqueado", "reprovado", "processo_encerrado"].includes(c.status) &&
        diasSemContato > DIAS_INATIVO
      ) {
        inativos_sem_operacao.push(c as Candidato);
      }
    });

    return { interessados_sem_contato, aprovados_sem_ativar, inativos_sem_operacao };
  } catch (error) {
    console.error("Erro:", error);
    return { interessados_sem_contato: [], aprovados_sem_ativar: [], inativos_sem_operacao: [] };
  }
}

export async function gerarMensagemInteligente(
  candidato: Candidato,
  tipo: "interessado_sem_retorno" | "aprovado_sem_ativar" | "inativo_sem_operacao",
  dadosOperacao?: { tipoVeiculo?: string; regiao?: string; data?: string }
): Promise<string> {
  const systemPrompt = "Você é o assistente de recrutamento da Conexão Express. Seja amigável, profissional e direto.";

  let userMessage = "";

  switch (tipo) {
    case "interessado_sem_retorno":
      userMessage = `Gere uma mensagem para ${candidato.nome_completo}, candidato interessado há mais de 15 dias sem retorno. `
        + `Ele tem ${candidato.tipo_veiculo || "veículo não informado"} na região ${candidato.regiao || "não informada"}. `
        + `Mencione a demanda atual e peça para completar o cadastro.`;
      break;
    case "aprovado_sem_ativar":
      userMessage = `Gere uma mensagem para ${candidato.nome_completo}, candidato aprovado há mais de 30 dias mas ainda não ativado. `
        + `Há demanda esta semana: ${dadosOperacao?.tipoVeiculo || candidato.tipo_veiculo} em ${dadosOperacao?.regiao || candidato.regiao}. `
        + `Peça confirmação para ativação.`;
      break;
    case "inativo_sem_operacao":
      userMessage = `Gere uma mensagem para ${candidato.nome_completo}, prestador inativo há mais de 60 dias. `
        + `Há uma operação em ${dadosOperacao?.data || "breve"} em ${dadosOperacao?.regiao || candidato.regiao} `
        + `para ${dadosOperacao?.tipoVeiculo || candidato.tipo_veiculo}. Pergunte se está disponível.`;
      break;
  }

  try {
    const mensagem = await callClaudeAPI(systemPrompt, userMessage);
    return mensagem.startsWith("MOCK")
      ? `Olá ${candidato.nome_completo.split(" ")[0]}! Ainda temos interesse no seu perfil. `
        + `Temos operações com ${candidato.tipo_veiculo || "seu veículo"} na região ${candidato.regiao || "sua região"}. `
        + "Complete seu cadastro para trabalharmos juntos!"
      : mensagem;
  } catch {
    return `Olá ${candidato.nome_completo.split(" ")[0]}! Gostariamos de entrar em contato sobre oportunidades.`;
  }
}

export async function salvarInteracao(
  candidatoId: string,
  tipo: string,
  mensagem: string,
  resposta?: string
) {
  const { error } = await supabase.from("candidato_interacoes").insert([{
    candidato_id: candidatoId,
    tipo,
    canal: "sistema",
    mensagem,
    resposta
  }]);

  if (error) throw error;
}

export async function atualizarStatusCandidato(
  candidatoId: string,
  status: string,
  observacoes?: string
) {
  const { error } = await supabase
    .from("recrutamento_candidatos")
    .update({
      status,
      observacoes,
      ultima_interacao: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", candidatoId);

  if (error) throw error;
}

export async function moverCandidatoParaTriagem(candidatoId: string) {
  await atualizarStatusCandidato(candidatoId, "triagem", "Movido para triagem");
}

export async function aprovarParaDocumentacao(candidatoId: string) {
  await atualizarStatusCandidato(candidatoId, "documentacao", "Aprovado para envio de documentação");

  const { data: rcData } = await supabase.from("recrutamento_candidatos").select("tipo_veiculo, veiculo, regiao").eq("id", candidatoId).single();
  await supabase.from("reservas_banco").insert([{
    candidato_id: candidatoId,
    tipo_veiculo: rcData?.tipo_veiculo || rcData?.veiculo,
    regiao: rcData?.regiao,
    status: "disponivel"
  }]);
}

export async function reprovarCandidato(candidatoId: string, motivo: string) {
  await atualizarStatusCandidato(candidatoId, "reprovado", `Reprovado: ${motivo}`);
}

export async function ativarPrestador(candidatoId: string): Promise<string> {
  const { data: candidato, error: fetchError } = await supabase
    .from("recrutamento_candidatos")
    .select("*, nome as nome_completo, cpf, telefone, whatsapp, email, cidade, uf, regiao, tipo_veiculo, tipo_carroceria, placa, status, score as score_perfil, created_at")
    .eq("id", candidatoId)
    .single();

  if (fetchError || !candidato) throw new Error("Candidato não encontrado");

  const { ativarPrestador: ativar, checarDuplicidade } = await import("./recrutamentoIntegracao");

  const existente = await checarDuplicidade({
    id: candidato.id,
    nome_completo: candidato.nome_completo,
    cpf_cnpj: candidato.cpf,
    telefone: candidato.telefone,
    whatsapp: candidato.whatsapp,
    email: candidato.email,
    status: candidato.status,
    created_at: candidato.created_at,
    score_perfil: 0,
    prioridade: 0,
  });

  if (existente) {
    console.log(`[ativarPrestador] Candidato ${candidatoId} já existe como prestador ${existente.prestador.id}`);
    await supabase.from("recrutamento_candidatos").update({
      status: "ativo",
      prestador_id: existente.prestador.id,
      updated_at: new Date().toISOString()
    }).eq("id", candidatoId);
    return existente.prestador.id;
  }

  const resultado = await ativar({
    id: candidato.id,
    nome_completo: candidato.nome_completo,
    cpf_cnpj: candidato.cpf,
    telefone: candidato.telefone,
    whatsapp: candidato.whatsapp,
    email: candidato.email,
    cidade: candidato.cidade,
    uf: candidato.uf,
    regiao: candidato.regiao,
    tipo_veiculo: candidato.tipo_veiculo,
    tipo_carroceria: candidato.tipo_carroceria,
    placa: candidato.placa,
    status: candidato.status,
    created_at: candidato.created_at,
    score_perfil: 0,
    prioridade: 0,
  });

  if (!resultado.success) {
    throw new Error(resultado.mensagem);
  }

  return resultado.prestador_id;
}
