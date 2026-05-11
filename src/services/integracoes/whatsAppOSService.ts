export interface WhatsAppOSPayload {
  setor: "operacional";
  evento: "OS_CRIADA";
  telefoneCliente: string;
  dados: {
    origem: string;
    destino: string;
    cliente: string;
    numeroOS: string;
    status: string;
  };
}

export async function enviarWebhookWhatsAppOSCriada(
  telefoneCliente: string,
  dadosOS: {
    origem: string;
    destino: string;
    cliente: string;
    numeroOS: string;
  }
): Promise<{ sucesso: boolean; erro?: string }> {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_OS_WHATSAPP_URL;

  if (!webhookUrl) {
    console.log("[WHATSAPP OS] Webhook URL não configurado no .env (VITE_N8N_WEBHOOK_OS_WHATSAPP_URL)");
    return { sucesso: false, erro: "Webhook não configurado" };
  }

  console.log("[WHATSAPP OS] Webhook URL:", webhookUrl);

  const telefoneFormatado = telefoneCliente.replace(/\D/g, "");

  if (!telefoneFormatado) {
    console.log("[WHATSAPP OS] Telefone do cliente não informado");
    return { sucesso: false, erro: "Telefone não informado" };
  }

  const payload: WhatsAppOSPayload = {
    setor: "operacional",
    evento: "OS_CRIADA",
    telefoneCliente: `55${telefoneFormatado}`,
    dados: {
      origem: dadosOS.origem,
      destino: dadosOS.destino,
      cliente: dadosOS.cliente,
      numeroOS: dadosOS.numeroOS,
      status: "Criada"
    }
  };

  console.log("[WHATSAPP OS] Payload enviado", JSON.stringify(payload, null, 2));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`);
      console.error(`[WHATSAPP OS] Falha ao enviar, OS mantida salva: ${errorText}`);
      return { sucesso: false, erro: errorText };
    }

    console.log("[WHATSAPP OS] Enviado com sucesso");
    return { sucesso: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro de conexão";
    console.error(`[WHATSAPP OS] Falha ao enviar, OS mantida salva: ${msg}`);
    return { sucesso: false, erro: msg };
  }
}