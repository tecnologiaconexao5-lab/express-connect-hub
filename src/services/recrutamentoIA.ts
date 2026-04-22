import { supabase } from "@/lib/supabase";

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
  const apiKey = localStorage.getItem("anthropic_api_key");
  if (!apiKey) {
    return `MOCK: ${userMessage.substring(0, 50)}...`;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: userMessage }]
      })
    });

    const data = await response.json();
    return data.content[0].text;
  } catch (err) {
    console.error("Erro na API:", err);
    throw err;
  }
};

export async function calcularScorePerfil(candidato: Partial<Candidato>, demandaRegional?: any): Promise<number> {
  let score = 0;
  
  if (candidato.tipo_veiculo && demandaRegional?.tiposNecessarios?.includes(candidato.tipo_veiculo)) {
    score += 30;
  } else if (candidato.tipo_veiculo) {
    score += 15;
  }
  
  if (candidato.regiao && demandaRegional?.regioesAtivas?.includes(candidato.regiao)) {
    score += 25;
  } else if (candidato.regiao) {
    score += 10;
  }
  
  if (candidato.experiencia_anos) {
    if (candidato.experiencia_anos >= 5) score += 20;
    else if (candidato.experiencia_anos >= 3) score += 15;
    else if (candidato.experiencia_anos >= 1) score += 10;
    else score += 5;
  }
  
  score += Math.min((candidato.experiencia_anos || 0) * 2, 15);
  
  return Math.min(Math.round(score), 100);
}

export async function analisarPerfilCandidato(
  candidato: Partial<Candidato>,
  dadosDemanda?: any
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
  
  if (candidato.regiao && dadosDemanda?.regioesAtivas?.includes(candidato.regiao)) {
    verificacoes.regiao_com_demanda = true;
  } else {
    verificacoes.regiao_com_demanda = false;
  }
  
  if (candidato.tipo_veiculo && dadosDemanda?.tiposNecessarios?.includes(candidato.tipo_veiculo)) {
    verificacoes.veiculo_necessario = true;
  } else {
    verificacoes.veiculo_necessario = false;
  }

  const score = await calcularScorePerfil(candidato, dadosDemanda);
  
  let recomendacao: "aprovar" | "revisar" | "rejeitar" = "revisar";
  if (score >= 75 && verificacoes.cpf_valido && verificacoes.regiao_com_demanda) {
    recomendacao = "aprovar";
  } else if (score < 40 || !verificacoes.cpf_valido) {
    recomendacao = "rejeitar";
  }

  const analise = `${candidato.nome_completo} possui ${candidato.tipo_veiculo || "veículo não informado"} na região ${candidato.regiao || "não informada"}. ` +
    `Score: ${score}/100. Recomendação: ${recomendacao.toUpperCase()}.`;

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
  
  if (recomendacao === "aprovar") {
    acoes.push("Aprovar para documentação");
    acoes.push("Enviar link do aplicativo");
  } else if (recomendacao === "revisar") {
    if (!verificacoes.cpf_valido) acoes.push("Solicitar CPF válido");
    if (!verificacoes.placa_valida) acoes.push("Confirmar placa do veículo");
    acoes.push("Verificar disponibilidade regional");
  } else {
    acoes.push("Reprovar candidato");
    acoes.push("Enviar mensagem educada");
  }
  
  return acoes;
}

export async function buscarReservasParaOperacao(
  tipoVeiculo: string,
  regiao: string,
  limite: number = 3
): Promise<SugestaoReserva[]> {
  try {
    const { data: candidatos, error } = await supabase
      .from("candidatos")
      .select("*")
      .or(`status.eq.aprovado,status.eq.interessado,status.eq.inativo`)
      .order("score_perfil", { ascending: false })
      .limit(20);

    if (error) throw error;

    const sugestoes: SugestaoReserva[] = [];
    
    (candidatos || []).forEach(c => {
      let score = 0;
      
      if (c.tipo_veiculo === tipoVeiculo) score += 50;
      else if (c.tipo_veiculo) score += 20;
      
      if (c.regiao === regiao) score += 35;
      else if (c.regiao) score += 15;
      
      if (c.status === "aprovado") score += 15;
      else if (c.status === "interessado") score += 10;
      
      if (score >= 50) {
        sugestoes.push({
          candidato: c as Candidato,
          score_adequacao: score,
          motivo: `${c.tipo_veiculo === tipoVeiculo ? "Veículo compatível" : "Veículo similar"} na região ${c.regiao === regiao ? "exata" : "proxima"}`,
          status: c.status as "aprovado" | "interessado" | "inativo"
        });
      }
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
  
  try {
    const { data: candidatos } = await supabase
      .from("candidatos")
      .select("*")
      .or(`status.eq.interessado,status.eq.aprovado,status.eq.inativo`);

    const interessados_sem_contato: Candidato[] = [];
    const aprovados_sem_ativar: Candidato[] = [];
    const inativos_sem_operacao: Candidato[] = [];

    (candidatos || []).forEach(c => {
      const ultimaInteracao = c.ultima_interacao ? new Date(c.ultima_interacao) : new Date(c.created_at);
      const diasSemContato = Math.floor((hoje.getTime() - ultimaInteracao.getTime()) / (1000 * 60 * 60 * 24));

      if (c.status === "interessado" && diasSemContato > 15) {
        interessados_sem_contato.push(c as Candidato);
      } else if (c.status === "aprovado" && diasSemContato > 30) {
        aprovados_sem_ativar.push(c as Candidato);
      } else if (c.status === "inativo" && diasSemContato > 60) {
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
    .from("candidatos")
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
  
  await supabase.from("reservas_banco").insert([{
    candidato_id: candidatoId,
    tipo_veiculo: (await supabase.from("candidatos").select("tipo_veiculo").eq("id", candidatoId).single()).data?.tipo_veiculo,
    regiao: (await supabase.from("candidatos").select("regiao").eq("id", candidatoId).single()).data?.regiao,
    status: "disponivel"
  }]);
}

export async function reprovarCandidato(candidatoId: string, motivo: string) {
  await atualizarStatusCandidato(candidatoId, "reprovado", `Reprovado: ${motivo}`);
}

export async function ativarPrestador(candidatoId: string): Promise<string> {
  const { data: candidato, error: fetchError } = await supabase
    .from("candidatos")
    .select("*")
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
    await supabase.from("candidatos").update({
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
