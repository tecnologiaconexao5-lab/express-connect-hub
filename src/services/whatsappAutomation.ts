export interface EnviarWhatsAppParams {
  telefone?: string;
  mensagem: string;
}

const TELEFONE_FALLBACK = "5511912133010";

const getWebhookUrl = (): string => {
  return (
    import.meta.env.VITE_N8N_WEBHOOK_OS_WHATSAPP_URL ||
    import.meta.env.VITE_N8N_WEBHOOK_URL ||
    ""
  );
};

export async function enviarWhatsAppAutomatico({
  telefone,
  mensagem,
}: EnviarWhatsAppParams): Promise<{ sucesso: boolean; erro?: string }> {
  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) {
    console.warn(
      "[WhatsAppAutomation] URL do webhook não configurada (VITE_N8N_WEBHOOK_URL)"
    );
    return { sucesso: false, erro: "Webhook URL não configurada" };
  }

  const telefoneFormatado = (telefone || TELEFONE_FALLBACK).replace(/\D/g, "");

  if (!telefoneFormatado) {
    console.warn("[WhatsAppAutomation] Telefone inválido ou vazio");
    return { sucesso: false, erro: "Telefone inválido" };
  }

  const payload = {
    telefone: telefoneFormatado,
    mensagem,
  };

  console.log("[WhatsAppAutomation] Enviando:", JSON.stringify(payload));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`);
      console.warn(
        `[WhatsAppAutomation] Webhook falhou (OS mantida): ${errorText}`
      );
      return { sucesso: false, erro: errorText };
    }

    console.log("[WhatsAppAutomation] Mensagem enviada com sucesso");
    return { sucesso: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro de conexão";
    console.warn(`[WhatsAppAutomation] Erro (OS mantida): ${msg}`);
    return { sucesso: false, erro: msg };
  }
}
