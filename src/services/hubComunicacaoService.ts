import { supabase } from "@/lib/supabase";
import { enviarMensagemTexto } from "./evolutionApiService";
import { enviarFollowUp } from "./zohoEmailService";

export interface HubConversa {
  id: string;
  cliente_id?: string;
  lead_id?: string;
  canal: "whatsapp" | "email";
  telefone?: string;
  email?: string;
  nome_contato?: string;
  setor?: string;
  status: "aberta" | "aguardando" | "resolvida" | "arquivada";
  ultima_mensagem?: string;
  ultimo_evento_em?: string;
  metadata?: Record<string, any>;
}

export interface HubMensagem {
  id: string;
  conversa_id: string;
  lead_id?: string;
  cliente_id?: string;
  canal: "whatsapp" | "email";
  tipo: string;
  direction: "inbound" | "outbound";
  remetente?: string;
  destinatario?: string;
  mensagem: string;
  status: "pendente" | "enviado" | "entregue" | "lido" | "erro";
  erro?: string;
  created_at: string;
}

export async function buscarConversas(filtroCanal?: string): Promise<HubConversa[]> {
  let query = supabase
    .from("crm_conversas")
    .select("*")
    .order("ultimo_evento_em", { ascending: false, nullsFirst: false });

  if (filtroCanal && filtroCanal !== "todos") {
    query = query.eq("canal", filtroCanal);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Erro ao buscar conversas:", error);
    return [];
  }
  return data as HubConversa[];
}

export async function buscarMensagens(conversaId: string): Promise<HubMensagem[]> {
  const { data, error } = await supabase
    .from("crm_mensagens")
    .select("*")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar mensagens:", error);
    return [];
  }
  return data as HubMensagem[];
}

export async function enviarMensagem(
  conversa: HubConversa,
  mensagem: string,
  opcoes?: { leadId?: string; empresa?: string; assunto?: string; templateKey?: string }
): Promise<{ success: boolean; erro?: string }> {
  
  // 1. Criar a mensagem pendente no Supabase
  const { data: msgData, error: msgError } = await supabase
    .from("crm_mensagens")
    .insert([{
      conversa_id: conversa.id,
      lead_id: conversa.lead_id || opcoes?.leadId,
      cliente_id: conversa.cliente_id,
      canal: conversa.canal,
      direction: "outbound",
      destinatario: conversa.canal === "whatsapp" ? conversa.telefone : conversa.email,
      mensagem,
      status: "pendente"
    }])
    .select()
    .single();

  if (msgError || !msgData) {
    return { success: false, erro: "Erro ao salvar mensagem local" };
  }

  let enviou = false;
  let erroEnvio = "";

  // 2. Tentar enviar via provedor
  if (conversa.canal === "whatsapp") {
    const serverUrl = localStorage.getItem("evo_server_url") || import.meta.env.VITE_EVOLUTION_SERVER_URL || "http://127.0.0.1:8080";
    const apiKey = localStorage.getItem("evo_api_key") || import.meta.env.VITE_EVOLUTION_API_KEY || "";
    const instancia = localStorage.getItem("evo_instancia") || import.meta.env.VITE_EVOLUTION_INSTANCE || "recrutamento-conexao-express";
    
    if (!apiKey) {
      erroEnvio = "API Key do Evolution não configurada.";
    } else if (!conversa.telefone) {
      erroEnvio = "Conversa sem telefone configurado.";
    } else {
      const res = await enviarMensagemTexto(instancia, serverUrl, apiKey, conversa.telefone, mensagem);
      if (res.ok) enviou = true;
      else erroEnvio = res.error || "Erro Evolution";
    }
  } else if (conversa.canal === "email") {
    if (!conversa.email) {
      erroEnvio = "Conversa sem email configurado.";
    } else {
      const payload = {
        leadId: conversa.lead_id || opcoes?.leadId || "",
        leadEmpresa: opcoes?.empresa || conversa.nome_contato || "Empresa",
        to: conversa.email,
        subject: opcoes?.assunto || "Contato Conexão Express",
        message: mensagem,
        tipo: (opcoes?.templateKey as any) || "primeiro_contato",
        canal: "email" as const
      };
      const res = await enviarFollowUp(payload);
      // enviarFollowUp returns success=false if webhook not set, but pendente=true
      if (res.success) {
        enviou = true;
      } else if (res.pendente) {
        enviou = false;
        erroEnvio = "Webhook não configurado. Salvo como pendente.";
      } else {
        erroEnvio = res.erro || "Erro Zoho/n8n";
      }
    }
  }

  // 3. Atualizar status da mensagem e conversa
  const newStatus = enviou ? "enviado" : (erroEnvio.includes("pendente") ? "pendente" : "erro");
  
  await supabase.from("crm_mensagens").update({
    status: newStatus,
    erro: erroEnvio || null
  }).eq("id", msgData.id);

  await supabase.from("crm_conversas").update({
    ultima_mensagem: mensagem,
    ultimo_evento_em: new Date().toISOString()
  }).eq("id", conversa.id);

  if (enviou) return { success: true };
  return { success: erroEnvio.includes("pendente"), erro: erroEnvio };
}

export async function criarConversa(
  canal: "whatsapp" | "email",
  contato: string, // telefone ou email
  nome: string,
  leadId?: string,
  clienteId?: string
): Promise<HubConversa | null> {
  // Verificar se já existe conversa
  const query = supabase.from("crm_conversas").select("*").eq("canal", canal);
  
  if (canal === "whatsapp") {
    query.eq("telefone", contato);
  } else {
    query.eq("email", contato);
  }

  const { data: existente } = await query.single();
  if (existente) return existente as HubConversa;

  // Criar nova
  const { data, error } = await supabase.from("crm_conversas").insert([{
    canal,
    telefone: canal === "whatsapp" ? contato : null,
    email: canal === "email" ? contato : null,
    nome_contato: nome,
    lead_id: leadId,
    cliente_id: clienteId,
    status: "aberta",
    ultimo_evento_em: new Date().toISOString()
  }]).select().single();

  if (error) {
    console.error("Erro ao criar conversa:", error);
    return null;
  }
  return data as HubConversa;
}

export async function processIncomingMessage(payload: any) {
  // Exemplo de como essa função vai processar os webhooks
  // payload pode vir do n8n (Email) ou Evolution (WhatsApp)
  
  try {
    const canal = payload.canal || (payload.number ? "whatsapp" : "email");
    const contato = canal === "whatsapp" ? payload.number : payload.from;
    const mensagem = payload.text || payload.message || "";
    const nome = payload.pushName || payload.fromName || contato;

    if (!contato || !mensagem) {
       console.error("Payload inválido:", payload);
       return { success: false, erro: "Payload inválido" };
    }

    // 1. Procurar ou criar a conversa
    let conversa = await criarConversa(canal, contato, nome);
    if (!conversa) return { success: false, erro: "Falha ao obter conversa" };

    // 2. Salvar mensagem inbound
    await supabase.from("crm_mensagens").insert([{
      conversa_id: conversa.id,
      lead_id: conversa.lead_id,
      cliente_id: conversa.cliente_id,
      canal: canal,
      direction: "inbound",
      remetente: contato,
      mensagem: mensagem,
      status: "entregue",
      metadata: payload
    }]);

    // 3. Atualizar conversa (status e última mensagem)
    await supabase.from("crm_conversas").update({
      ultima_mensagem: mensagem,
      ultimo_evento_em: new Date().toISOString(),
      status: "aberta" // Se estava resolvida/arquivada, volta a ficar aberta
    }).eq("id", conversa.id);

    // 4. Log do recebimento
    await supabase.from("integracoes_logs").insert([{
      integracao: canal === "whatsapp" ? "evolution_api" : "n8n_zoho",
      evento: "MESSAGE_RECEIVED",
      status: "success",
      payload: payload
    }]);

    return { success: true, conversa };

  } catch (err: any) {
    console.error("Erro processIncomingMessage:", err);
    await supabase.from("integracoes_logs").insert([{
      integracao: "webhook_receptor",
      evento: "MESSAGE_RECEIVED",
      status: "error",
      payload: payload,
      erro: err.message
    }]);
    return { success: false, erro: err.message };
  }
}
