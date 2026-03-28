import { supabase } from "@/lib/supabase";

export interface ComunicacaoLote {
  id: string;
  titulo: string;
  tipo: string;
  conteudo: string;
  canal_whatsapp: boolean;
  canal_push: boolean;
  canal_interno: boolean;
  conteudo_whatsapp?: string;
  titulo_push?: string;
  corpo_push?: string;
  icone_push?: string;
  agendado_para?: string;
  enviado: boolean;
  data_envio?: string;
  recurrente: boolean;
  recurrencia_tipo?: string;
  filtros?: any;
  criado_por?: string;
  created_at: string;
}

export interface Destinatario {
  id: string;
  comunicacao_id: string;
  prestador_id?: string;
  candidato_id?: string;
  canal: string;
  status: string;
  enviado_em?: string;
  visualizado_em?: string;
  respondido_em?: string;
}

export interface Template {
  id: string;
  nome: string;
  tipo: string;
  categoria: string;
  conteudo: string;
  variaveis_suportadas: string[];
  titulo_push?: string;
  corpo_push?: string;
  ativo: boolean;
  uso_count: number;
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

export function processarVariaveis(conteudo: string, dados: Record<string, any>): string {
  let result = conteudo;
  
  const mappings: Record<string, string> = {
    "{{nome}}": dados.nome_completo || dados.nome || "",
    "{{primeiro_nome}}": dados.nome_completo?.split(" ")[0] || dados.nome?.split(" ")[0] || "",
    "{{tipo_veiculo}}": dados.tipo_veiculo || "",
    "{{regiao}}": dados.regiao || dados.regiao_principal || "",
    "{{valor_pendente}}": dados.valor_pendente || dados.valor_a_receber || "0",
    "{{qtd_os_semana}}": dados.qtd_os_semana || "0",
    "{{data_pagamento}}": dados.data_pagamento || "",
    "{{link_app}}": "https://conexaoexpress.app/download",
    "{{link_disponibilidade}}": "https://conexaoexpress.app/disponibilidade"
  };

  for (const [variavel, valor] of Object.entries(mappings)) {
    result = result.replace(new RegExp(variavel, 'g'), valor || "");
  }

  return result;
}

export async function buscarDestinatarios(filtros: any): Promise<any[]> {
  try {
    let query = supabase.from("prestadores").select("*");
    
    if (filtros.status?.length > 0) {
      query = query.in("status", filtros.status);
    }
    
    if (filtros.tipo_veiculo?.length > 0) {
      query = query.in("tipo_veiculo", filtros.tipo_veiculo);
    }
    
    if (filtros.regiao?.length > 0) {
      query = query.in("regiao_principal", filtros.regiao);
    }

    const { data: prestadores, error } = await query;
    if (error) throw error;

    return prestadores || [];
  } catch (error) {
    console.error("Erro ao buscar destinatários:", error);
    return [];
  }
}

export async function criarComunicacao(
  comunicacao: Partial<ComunicacaoLote>,
  filtros: any
): Promise<ComunicacaoLote> {
  const { data, error } = await supabase
    .from("comunicacoes_lote")
    .insert([{
      ...comunicacao,
      filtros
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function enviarComunicacao(comunicacaoId: string): Promise<void> {
  const { data: comunicacao } = await supabase
    .from("comunicacoes_lote")
    .select("*")
    .eq("id", comunicacaoId)
    .single();

  if (!comunicacao) throw new Error("Comunicação não encontrada");

  const destinatarios = await buscarDestinatarios(comunicacao.filtros);
  
  const inserts: any[] = [];
  
  for (const dest of destinatarios) {
    if (comunicacao.canal_whatsapp) {
      inserts.push({
        comunicacao_id: comunicacaoId,
        prestador_id: dest.id,
        canal: "whatsapp",
        status: "pendente"
      });
    }
    
    if (comunicacao.canal_push) {
      inserts.push({
        comunicacao_id: comunicacaoId,
        prestador_id: dest.id,
        canal: "push",
        status: "pendente"
      });
    }
    
    if (comunicacao.canal_interno) {
      inserts.push({
        comunicacao_id: comunicacaoId,
        prestador_id: dest.id,
        canal: "interno",
        status: "pendente"
      });
    }
  }

  if (inserts.length > 0) {
    await supabase.from("comunicacao_destinatarios").insert(inserts);
  }

  await supabase
    .from("comunicacoes_lote")
    .update({ 
      enviado: true, 
      data_envio: new Date().toISOString() 
    })
    .eq("id", comunicacaoId);
}

export async function gerarMensagemComIA(
  tipo: string,
  filtros: any,
  dadosExtra?: any
): Promise<string> {
  const systemPrompt = "Você é o assistente de comunicação da Conexão Express. Crie mensagens amigáveis, profissionais e diretas.";
  
  let contexto = "";
  
  switch (tipo) {
    case "rotas_disponiveis":
      contexto = `Crie uma mensagem para prestadores informandothat há ${dadosExtra?.qtd_os_semana || "várias"} operações disponíveis para ${filtros.tipo_veiculo || "veículo"} na região ${filtros.regiao || ""}. Use variáveis como {{nome}}, {{primeiro_nome}}, {{tipo_veiculo}}, {{regiao}}, {{qtd_os_semana}}, {{link_disponibilidade}}.`;
      break;
    case "avisos_operacionais":
      contexto = "Crie um aviso operacional curto e claro para prestadores.";
      break;
    case "informativo_financeiro":
      contexto = "Crie uma mensagem informativa sobre pagamento para prestadores.";
      break;
    case "documentacao_pendente":
      contexto = "Crie um lembrete amigável sobre documentos pendentes.";
      break;
    case "convocacao":
      contexto = "Crie uma convocação para prestadores participarem de operações.";
      break;
    case "pesquisa":
      contexto = "Crie uma mensagem breve convidando prestadores para uma pesquisa de satisfação.";
      break;
    case "comunicado_geral":
      contexto = "Crie um comunicado geral para prestadores.";
      break;
    case "comemorativo":
      contexto = "Crie uma mensagem comemorativa amigável.";
      break;
    default:
      contexto = "Crie uma mensagem para prestadores.";
  }

  try {
    const mensagem = await callClaudeAPI(systemPrompt, contexto);
    if (mensagem.startsWith("MOCK:")) {
      return `Olá {{primeiro_nome}}!Temos boas notícias para você. Há operações disponíveis na sua região. Acesse o app para mais detalhes: {{link_app}}`;
    }
    return mensagem;
  } catch {
    return `Olá {{primeiro_nome}}!{{mensagem}}`;
  }
}

export async function buscarAniversariantes(): Promise<any[]> {
  const hoje = new Date();
  const dia = hoje.getDate();
  const mes = hoje.getMonth() + 1;

  const { data: prestadores } = await supabase
    .from("prestadores")
    .select("id, nome_completo, tipo_parceiro, telefone, whatsapp, data_nascimento");

  const aniversariantes = (prestadores || []).filter(p => {
    if (!p.data_nascimento) return false;
    const data = new Date(p.data_nascimento);
    return data.getDate() === dia && data.getMonth() + 1 === mes;
  });

  return aniversariantes;
}

export async function buscarProximosAniversariantes(dias: number = 7): Promise<any[]> {
  const hoje = new Date();
  
  const { data: prestadores } = await supabase
    .from("prestadores")
    .select("id, nome_completo, tipo_parceiro, telefone, whatsapp, data_nascimento");

  const proximos: any[] = [];
  
  for (let i = 0; i < dias; i++) {
    const dataAlvo = new Date(hoje);
    dataAlvo.setDate(hoje.getDate() + i);
    
    const dia = dataAlvo.getDate();
    const mes = dataAlvo.getMonth() + 1;
    
    (prestadores || []).forEach(p => {
      if (!p.data_nascimento) return;
      const data = new Date(p.data_nascimento);
      if (data.getDate() === dia && data.getMonth() + 1 === mes) {
        proximos.push({ ...p, data_aniversario: dataAlvo.toISOString().split("T")[0] });
      }
    });
  }

  return proximos;
}

export async function enviarParabensAniversario(
  destinatarioId: string,
  tipo: "prestador" | "candidato",
  canal: string
): Promise<void> {
  const mensagem = `🎉 Feliz Aniversário, {{nome}}!
A toda equipe da Conexão Express deseja um
dia muito especial para você.
Obrigado por fazer parte da nossa família! 🚚❤️
— Equipe Conexão Express`;

  await supabase.from("aniversarios_log").insert([{
    prestador_id: tipo === "prestador" ? destinatarioId : null,
    candidato_id: tipo === "candidato" ? destinatarioId : null,
    data_aniversario: new Date(),
    canal,
    mensagem,
    status: "enviado"
  }]);
}

export async function salvarTemplate(template: Partial<Template>): Promise<Template> {
  const { data, error } = await supabase
    .from("comunicacao_templates")
    .insert([template])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function buscarTemplates(categoria?: string): Promise<Template[]> {
  let query = supabase.from("comunicacao_templates").select("*").eq("ativo", true);
  
  if (categoria) {
    query = query.eq("categoria", categoria);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function registrarRespostaMensagem(
  mensagemId: string,
  resposta: string
): Promise<void> {
  await supabase
    .from("inbox_mensagens")
    .update({ resposta, lida: true })
    .eq("id", mensagemId);

  await supabase
    .from("comunicacao_destinatarios")
    .update({ 
      status: "respondido", 
      respondido_em: new Date().toISOString(),
      resposta 
    })
    .eq("id", mensagemId);
}

export async function buscarConversas(): Promise<any[]> {
  const { data, error } = await supabase
    .from("inbox_mensagens")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function enviarMensagemInput(
  prestadorId: string,
  mensagem: string,
  canal: string
): Promise<void> {
  await supabase.from("inbox_mensagens").insert([{
    prestador_id: prestadorId,
    tipo: "mensagem",
    canal,
    direcao: "enviada",
    mensagem
  }]);
}
