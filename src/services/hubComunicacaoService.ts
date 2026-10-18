import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";

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
  
  // F25B: Envio direto bloqueado. Toda mensagem deve passar pelo gateway seguro.
  const telefoneMascarado = (conversa.telefone || "").replace(/(\d{2})\d{4,}(\d{2})/, "$1****$2");
  const emailMascarado = (conversa.email || "").replace(/(.{2}).*(@.*)/, "$1***$2");

  // 1. Criar tarefa de bloqueio
  const tarefa = await centralIaService.criarTarefa({
    setor: "Central IA",
    tipo_tarefa: "bloqueio_envio_direto",
    titulo: `Envio direto bloqueado - Hub ${conversa.canal}`,
    descricao: `Tentativa de envio direto bloqueada. ${conversa.canal === "whatsapp" ? `Tel: ${telefoneMascarado}` : `Email: ${emailMascarado}`}`,
    prioridade: "normal",
    status: "aguardando_aprovacao",
    payload: {
      origem: "hubComunicacaoService",
      conversa_id: conversa.id,
      canal: conversa.canal,
      contato_mascarado: conversa.canal === "whatsapp" ? telefoneMascarado : emailMascarado,
      mensagem_resumida: mensagem.slice(0, 100),
    },
  });

  // 2. Criar aprovação humana
  if (tarefa) {
    await centralIaService.criarAprovacao({
      tarefa_id: tarefa.id,
      tipo_aprovacao: conversa.canal === "whatsapp" ? "mensagem_cliente" : "outro",
      conteudo_original: {
        canal: conversa.canal,
        contato: conversa.canal === "whatsapp" ? telefoneMascarado : emailMascarado,
        mensagem,
      },
      conteudo_sugerido: {
        canal: conversa.canal,
        contato: conversa.canal === "whatsapp" ? telefoneMascarado : emailMascarado,
        mensagem,
      },
    });
  }

  // 3. Registrar mensagem como bloqueada
  await supabase.from("comunicacoes_mensagens").insert({
    tarefa_id: tarefa?.id || null,
    origem_tipo: "hub_comunicacao",
    origem_id: conversa.id,
    destinatario_tipo: "setor",
    destinatario_nome: conversa.nome_contato || null,
    canal: conversa.canal === "whatsapp" ? "whatsapp" : "simulado",
    assunto: opcoes?.assunto || "Envio direto bloqueado",
    conteudo: mensagem,
    status: "bloqueado",
    modo_seguro: true,
    provider_message_id: null,
    motivo_bloqueio: "Envio direto bloqueado pelo gateway F25B",
    contexto: {
      conversa_id: conversa.id,
      contato_mascarado: conversa.canal === "whatsapp" ? telefoneMascarado : emailMascarado,
    },
  });

  // 4. Registrar log
  await centralIaService.registrarLog({
    acao: "envio_direto_bloqueado",
    entrada: {
      canal: conversa.canal,
      conversa_id: conversa.id,
      contato: conversa.canal === "whatsapp" ? telefoneMascarado : emailMascarado,
    },
    saida: { tarefa_id: tarefa?.id, status: "bloqueado" },
    status: "aviso",
    erro: "Envio direto bloqueado. A mensagem foi enviada para aprovação na Central IA.",
  });

  // 5. Atualizar status no CRM para não travar a tela
  await supabase.from("crm_mensagens").insert([{
    conversa_id: conversa.id,
    lead_id: conversa.lead_id || opcoes?.leadId,
    cliente_id: conversa.cliente_id,
    canal: conversa.canal,
    direction: "outbound",
    destinatario: conversa.canal === "whatsapp" ? conversa.telefone : conversa.email,
    mensagem,
    status: "bloqueado",
    erro: "Envio direto bloqueado. A mensagem foi enviada para aprovação na Central IA.",
  }]).select().single();

  await supabase.from("crm_conversas").update({
    ultima_mensagem: mensagem,
    ultimo_evento_em: new Date().toISOString()
  }).eq("id", conversa.id);

  return {
    success: false,
    erro: "Envio direto bloqueado. A mensagem foi enviada para aprovação na Central IA.",
  };
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
