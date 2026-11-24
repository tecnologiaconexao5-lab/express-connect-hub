// ===================================================================
// _shared/nfseEmail.ts
//
// Envio de e-mail da NFS-e (XML oficial + DANFSe PDF) ao tomador.
//
// Provedores suportados (backend / Secrets do Supabase), nesta ordem:
//   1. RESEND_API_KEY  (+ RESEND_FROM / FISCAL_EMAIL_FROM)  -> API Resend
//   2. FISCAL_EMAIL_WEBHOOK | N8N_WEBHOOK_ZOHO_EMAIL        -> webhook n8n
//      (mesmo mecanismo ja usado por `fiscal-email-documentos` / Zoho)
//
// Sem credencial configurada: devolve configurado=false e a lista EXATA de
// secrets a cadastrar (nunca falha silenciosamente).
// ===================================================================

export interface AnexoEmailNfse {
  nome: string;
  content_type: string;
  /** Conteudo do arquivo (baixado do Storage) para anexos via base64. */
  bytes: Uint8Array;
  /** URL assinada (10 min) para o webhook/n8n baixar e anexar. */
  signed_url?: string | null;
}

export interface EnvioEmailNfse {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  anexos: AnexoEmailNfse[];
  meta?: Record<string, unknown>;
}

export interface ResultadoEmailNfse {
  ok: boolean;
  configurado: boolean;
  provider: "resend" | "webhook" | null;
  messageId: string | null;
  erro: string | null;
  secretsFaltando: string[];
}

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  const bloco = 0x8000;
  for (let i = 0; i < bytes.length; i += bloco) {
    bin += String.fromCharCode(...bytes.subarray(i, i + bloco));
  }
  return btoa(bin);
}

function resumoSeguro(erro: unknown): string {
  const bruto = erro instanceof Error
    ? `${erro.name}: ${erro.message}`
    : String(erro);
  return bruto.replace(/\s+/g, " ").slice(0, 300);
}

export interface DeteccaoProvedorEmail {
  provider: "resend" | "webhook" | null;
  secretsFaltando: string[];
}

/** Detecta o provedor de e-mail configurado no backend. */
export function provedorEmailConfigurado(): DeteccaoProvedorEmail {
  const resend = Deno.env.get("RESEND_API_KEY")?.trim();
  const webhook = Deno.env.get("FISCAL_EMAIL_WEBHOOK")?.trim() ||
    Deno.env.get("N8N_WEBHOOK_ZOHO_EMAIL")?.trim();

  if (resend) return { provider: "resend", secretsFaltando: [] };
  if (webhook) return { provider: "webhook", secretsFaltando: [] };

  return {
    provider: null,
    secretsFaltando: [
      "RESEND_API_KEY (e RESEND_FROM ou FISCAL_EMAIL_FROM)",
      "ou FISCAL_EMAIL_WEBHOOK / N8N_WEBHOOK_ZOHO_EMAIL",
    ],
  };
}

async function enviarViaResend(
  envio: EnvioEmailNfse,
  apiKey: string,
): Promise<ResultadoEmailNfse> {
  const from = Deno.env.get("RESEND_FROM")?.trim() ||
    Deno.env.get("FISCAL_EMAIL_FROM")?.trim() ||
    "Conexao Express <fiscal@conexaoexpress.com.br>";

  const attachments = envio.anexos.map(function(anexo) {
    return {
      filename: anexo.nome,
      content: bytesParaBase64(anexo.bytes),
    };
  });

  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, 15000);
  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: envio.to,
        ...(envio.cc && envio.cc.length ? { cc: envio.cc } : {}),
        subject: envio.subject,
        html: envio.html,
        text: envio.text,
        ...(attachments.length ? { attachments } : {}),
      }),
      signal: controller.signal,
    });

    const corpo = await resposta.text();
    if (!resposta.ok) {
      return {
        ok: false,
        configurado: true,
        provider: "resend",
        messageId: null,
        erro: `Resend HTTP ${resposta.status}: ${corpo.slice(0, 300)}`,
        secretsFaltando: [],
      };
    }

    let messageId: string | null = null;
    try {
      const json = JSON.parse(corpo) as Record<string, unknown>;
      messageId = typeof json["id"] === "string" ? json["id"] : null;
    } catch {
      messageId = null;
    }

    return {
      ok: true,
      configurado: true,
      provider: "resend",
      messageId,
      erro: null,
      secretsFaltando: [],
    };
  } catch (erro) {
    return {
      ok: false,
      configurado: true,
      provider: "resend",
      messageId: null,
      erro: `Falha ao enviar via Resend: ${resumoSeguro(erro)}`,
      secretsFaltando: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

async function enviarViaWebhook(
  envio: EnvioEmailNfse,
  webhookUrl: string,
): Promise<ResultadoEmailNfse> {
  const anexos = envio.anexos.map(function(anexo) {
    return {
      nome_arquivo: anexo.nome,
      content_type: anexo.content_type,
      signed_url: anexo.signed_url || null,
      // Fallback base64 quando nao houver signed_url.
      content_base64: anexo.signed_url ? null : bytesParaBase64(anexo.bytes),
      expires_in: 600,
    };
  });

  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, 15000);
  try {
    const resposta = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: envio.to,
        cc: envio.cc || [],
        subject: envio.subject,
        body: envio.text,
        html: envio.html,
        modulo: "fiscal",
        tipo: "nfse",
        anexos,
        meta: envio.meta || {},
        instrucao:
          "Anexe os arquivos ao e-mail do destinatario. NAO encaminhe as URLs.",
      }),
      signal: controller.signal,
    });

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(function() { return ""; });
      return {
        ok: false,
        configurado: true,
        provider: "webhook",
        messageId: null,
        erro: `Webhook HTTP ${resposta.status}: ${corpo.slice(0, 300)}`,
        secretsFaltando: [],
      };
    }

    let messageId: string | null = null;
    try {
      const json = JSON.parse(await resposta.text()) as Record<string, unknown>;
      messageId = typeof json["id"] === "string"
        ? json["id"]
        : typeof json["messageId"] === "string"
        ? json["messageId"]
        : null;
    } catch {
      messageId = null;
    }

    return {
      ok: true,
      configurado: true,
      provider: "webhook",
      messageId,
      erro: null,
      secretsFaltando: [],
    };
  } catch (erro) {
    return {
      ok: false,
      configurado: true,
      provider: "webhook",
      messageId: null,
      erro: `Falha ao chamar o webhook de e-mail: ${resumoSeguro(erro)}`,
      secretsFaltando: [],
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Envia o e-mail da NFS-e usando o provedor configurado no backend. */
export async function enviarEmailNfse(
  envio: EnvioEmailNfse,
): Promise<ResultadoEmailNfse> {
  const deteccao = provedorEmailConfigurado();
  if (!deteccao.provider) {
    return {
      ok: false,
      configurado: false,
      provider: null,
      messageId: null,
      erro:
        "Envio de e-mail nao configurado no backend (nenhum provedor nos Secrets).",
      secretsFaltando: deteccao.secretsFaltando,
    };
  }

  if (deteccao.provider === "resend") {
    return await enviarViaResend(
      envio,
      Deno.env.get("RESEND_API_KEY")!.trim(),
    );
  }

  const webhook = Deno.env.get("FISCAL_EMAIL_WEBHOOK")?.trim() ||
    Deno.env.get("N8N_WEBHOOK_ZOHO_EMAIL")!.trim();
  return await enviarViaWebhook(envio, webhook);
}
