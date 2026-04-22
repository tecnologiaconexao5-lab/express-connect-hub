// src/services/automacao.ts
import { supabase } from "@/lib/supabase";
import type {
  AutomacaoEvento,
  AutomacaoConfig,
  AutomacaoLog,
  N8nWebhookPayload,
  EventoTipo,
  CanalEnvio,
} from "@/types/automacao";

export const EVENTO_LABELS: Record<EventoTipo, string> = {
  orcamento_criado: "Orçamento Criado",
  os_criada: "OS Criada",
  os_aceita: "OS Aceita pelo Prestador",
  os_iniciada: "OS Iniciada",
  os_saida_coleta: "Saída para Coleta",
  os_saida_entrega: "Saída para Entrega",
  os_chegada_destino: "Chegada no Destino",
  os_tentativa_entrega: "Tentativa de Entrega",
  os_reentrega: "Reentrega Solicitada",
  os_finalizada: "OS Finalizada",
  os_baixa_evidencia: "Baixa / Evidência Enviada",
  os_cancelada: "OS Cancelada",
};

export const COOLDOWN_MINUTOS: Partial<Record<EventoTipo, number>> = {
  os_iniciada: 5,
  os_chegada_destino: 30,
  os_tentativa_entrega: 60,
  os_reentrega: 30,
};

export const STATUS_CORES_EVENTO: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  enviado: "bg-blue-100 text-blue-800",
  lido: "bg-green-100 text-green-800",
  falha: "bg-red-100 text-red-800",
};

let _config: AutomacaoConfig | null = null;

export function getAutomacaoConfig(): AutomacaoConfig {
  if (_config) return _config;

  _config = {
    n8n_webhook_url: import.meta.env.VITE_N8N_WEBHOOK_URL || "",
    n8n_api_key: import.meta.env.VITE_N8N_API_KEY || "",
    groq_api_key: import.meta.env.VITE_GROQ_API_KEY || "",
    whatsapp_enabled: import.meta.env.VITE_WHATSAPP_ENABLED === "true",
    whatsapp_api_url: import.meta.env.VITE_WHATSAPP_API_URL || "",
    email_enabled: import.meta.env.VITE_EMAIL_ENABLED === "true",
    groq_enabled: import.meta.env.VITE_GROQ_ENABLED === "true",
    modo: import.meta.env.VITE_AUTOMACAO_MODO as "production" | "simulation" || "simulation",
    eventos_ativos: (import.meta.env.VITE_AUTOMACAO_EVENTOS_ATIVOS?.split(",") || []) as EventoTipo[],
  };

  return _config;
}

export async function eventoJaEnviadoRecentemente(
  osId: string,
  tipo: EventoTipo
): Promise<boolean> {
  const cooldownMin = COOLDOWN_MINUTOS[tipo] ?? 0;
  if (cooldownMin === 0) {
    try {
      const { data } = await supabase
        .from("automacao_logs")
        .select("id")
        .eq("os_id", osId)
        .eq("evento", tipo)
        .in("status", ["pendente", "enviado", "lido"])
        .maybeSingle();

      return !!data;
    } catch {
      return false;
    }
  }

  const limite = new Date(Date.now() - cooldownMin * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("automacao_logs")
    .select("id")
    .eq("os_id", osId)
    .eq("evento", tipo)
    .in("status", ["pendente", "enviado", "lido"])
    .gte("created_at", limite)
    .maybeSingle();

  return !!data;
}

export async function marcarEventoEnviado(
  osId: string,
  osNumero: string,
  tipo: EventoTipo,
  executionId: string
): Promise<void> {
  await logAutomacao({
    os_id: osId,
    os_numero: osNumero,
    evento: tipo,
    template_id: "",
    canal: "whatsapp",
    destinatario: "",
    corpo: `Evento ${tipo} pendente de envio`,
    status: "pendente",
    n8n_execution_id: executionId,
  });
}

export async function dispatchAutomacao(evento: AutomacaoEvento): Promise<{ success: boolean; id?: string; skipped?: boolean; error?: string }> {
  const config = getAutomacaoConfig();

  if (config.modo === "simulation") {
    console.log("[Automacao] Modo SIMULAÇÃO — Evento:", evento.tipo, "| OS:", evento.os_numero);
    return { success: true, id: "sim-" + Date.now() };
  }

  if (!config.n8n_webhook_url) {
    console.warn("[Automacao] Webhook n8n não configurado. Pulando.");
    return { success: false, error: "Webhook n8n não configurado" };
  }

  if (config.eventos_ativos.length > 0 && !config.eventos_ativos.includes(evento.tipo)) {
    console.log("[Automacao] Evento não ativo:", evento.tipo);
    return { success: false, error: "Evento não ativo" };
  }

  const duplicado = await eventoJaEnviadoRecentemente(evento.os_id, evento.tipo);
  if (duplicado) {
    console.log(`[Automacao] IDEMPOTÊNCIA: ${evento.tipo} já enviado para OS ${evento.os_numero}. Pulando.`);
    return { success: false, skipped: true, error: "Evento duplicado" };
  }

  const payload: N8nWebhookPayload = {
    evento,
    timestamp: new Date().toISOString(),
    origem: "express-connect-hub",
    version: "1.0.0",
  };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": config.n8n_api_key,
    };

    const response = await fetch(config.n8n_webhook_url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`n8n responded ${response.status}`);
    }

    const result = await response.json();
    const execId = result.executionId || result.id || `local-${Date.now()}`;

    await marcarEventoEnviado(evento.os_id, evento.os_numero, evento.tipo, execId);

    return { success: true, id: execId };
  } catch (err: any) {
    console.error("[Automacao] Erro ao disparar para n8n:", err);

    await logAutomacao({
      os_id: evento.os_id,
      os_numero: evento.os_numero,
      evento: evento.tipo,
      template_id: "",
      canal: "whatsapp",
      destinatario: evento.destinatario?.whatsapp || "",
      corpo: JSON.stringify(payload),
      status: "falha",
      error: err.message,
    });

    return { success: false, error: err.message };
  }
}

export async function logAutomacao(log: Omit<AutomacaoLog, "id" | "created_at">): Promise<void> {
  try {
    await supabase.from("automacao_logs").insert([{
      os_id: log.os_id,
      os_numero: log.os_numero,
      evento: log.evento,
      template_id: log.template_id,
      canal: log.canal,
      destinatario: log.destinatario,
      corpo: log.corpo,
      status: log.status,
      n8n_execution_id: log.n8n_execution_id,
      resposta_ia: log.resposta_ia,
      error: log.error,
    }]);
  } catch (e) {
    console.error("[Automacao] Erro ao salvar log:", e);
  }
}

export async function gerarTextoComGroq(
  prompt: string,
  contexto?: Record<string, any>
): Promise<string> {
  const config = getAutomacaoConfig();

  if (!config.groq_enabled || !config.groq_api_key) {
    return prompt;
  }

  try {
    const system = `Você é o Assistente Operacional da Conexão Express Hub. Sua função é gerar mensagens comerciais profissional e amigáveis para logística. Responda apenas com o texto da mensagem, sem prefixos, sem explicações. Seja direto, cordial e profissional.`;

    const userMsg = contexto
      ? `${prompt}\n\nContexto operacional:\n${JSON.stringify(contexto, null, 2)}`
      : prompt;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.groq_api_key}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || prompt;
  } catch (err) {
    console.warn("[Automacao] Groq indisponível, retornando prompt original:", err);
    return prompt;
  }
}

export function montarEventoOS(
  os: any,
  tipo: EventoTipo,
  extras?: Partial<AutomacaoEvento>
): AutomacaoEvento {
  const destinatario = os.whatsapp_destinatario
    ? {
        nome: os.destinatario_nome || "",
        whatsapp: os.whatsapp_destinatario,
        email: os.email_destinatario || "",
      }
    : undefined;

  const remetente = os.whatsapp_prestador
    ? {
        nome: os.prestador || "",
        whatsapp: os.whatsapp_prestador,
      }
    : undefined;

  return {
    tipo,
    timestamp: new Date().toISOString(),
    os_id: os.id,
    os_numero: os.numero,
    cliente: os.cliente,
    prestador: os.prestador,
    veiculo: os.veiculo_alocado,
    destinatario,
    remetente,
    status: os.status,
    url_rastreio: `${window.location.origin}/tracking?os=${os.numero}`,
    metadados: {
      data_programada: os.data_programada,
      previsao_inicio: os.previsao_inicio,
      carga: os.carga_tipo,
      volumes: os.volumes,
    },
    ...extras,
  };
}