// ═══════════════════════════════════════════════════════════════════════════════
// EFI-INT-04A.2 — efi-mtls-probe  (TEMPORARIO / DIAGNOSTICO / SOMENTE HOMOLOGACAO)
// ═══════════════════════════════════════════════════════════════════════════════
// OBJETIVO EXCLUSIVO: provar, no runtime HOSPEDADO, que conseguimos:
//   1) construir um HttpClient com certificado + chave (mTLS);
//   2) estabelecer handshake TLS/HTTPS contra o host HOMOLOGACAO da Efi.
//
// NUNCA faz: banco, RPC, Auth, Storage, financeiro, boleto, Pix, webhook, OAuth
//            Client Secret, consulta de listagem de cobrancas/Pix.
//
// BLINDAGEM (EFI-INT-04A.2):
//   - Guard de ambiente EXATO: EFI_ENVIRONMENT === "homologacao" (senao aborta).
//   - Allowlist FIXA de hosts HML (mesmo se EFI_API_BASE_URL_HML estiver errada).
//   - Metodos permitidos: GET e OPTIONS apenas.
//   - Token interno obrigatorio: EFI_PROBE_TOKEN (503 sem; 401 incorreto).
//   - Timeout curto; resposta sanitizada; nunca loga/retorna token/cert/chave.
//   - Zero supabase-js / SUPABASE_SERVICE_ROLE_KEY / DB / RPC / Auth / Storage.
// ═══════════════════════════════════════════════════════════════════════════════

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  EFI_ALLOWED_HOSTS,
  extractHostname,
  isAllowedHost,
  isAllowedMethod,
  isAuthorizedToken,
  isHomologacao,
} from "./guards.ts";

const DEFAULT_EFI_HML_HOST = "https://pix-h.api.efipay.com.br";
const PROBE_NEUTRAL_PATH = "/_efi_mtls_probe"; // caminho neutro (nao-financeiro)
const TIMEOUT_MS = 8000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-efi-probe-token, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function b64ToText(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const normalized = value.replace(/\s+/g, "");
    const bin = atob(normalized);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  // 0) Preflight CORS
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 1) Métodos permitidos: GET e OPTIONS apenas
  if (!isAllowedMethod(req.method)) {
    return json({ ok: false, error: "Metodo nao permitido." }, 405);
  }

  // 2) Token interno obrigatório (EFI_PROBE_TOKEN) — nunca retornado/logado
  const expectedToken = Deno.env.get("EFI_PROBE_TOKEN");
  if (!expectedToken) {
    return json({ ok: false, error: "Probe desabilitado: EFI_PROBE_TOKEN nao configurado." }, 503);
  }
  const providedToken = req.headers.get("x-efi-probe-token");
  if (!isAuthorizedToken(expectedToken, providedToken)) {
    return json({ ok: false, error: "Nao autorizado." }, 401);
  }

  // 3) Guard de ambiente EXATO — aborta ANTES de criar HttpClient/fetch
  const environment = Deno.env.get("EFI_ENVIRONMENT");
  if (!isHomologacao(environment)) {
    return json({
      ok: false,
      error: "Bloqueado: EFI_ENVIRONMENT deve ser exatamente 'homologacao'.",
      environment: environment ?? null,
    }, 503);
  }

  // 4) Allowlist FIXA de host HML — aborta ANTES de criar HttpClient/fetch
  const hostname = extractHostname(Deno.env.get("EFI_API_BASE_URL_HML"), DEFAULT_EFI_HML_HOST);
  if (!isAllowedHost(hostname)) {
    return json({
      ok: false,
      error: "Bloqueado: host fora da allowlist de homologacao da Efi.",
      hostname: hostname ?? null,
      allowed_hosts: EFI_ALLOWED_HOSTS,
    }, 403);
  }
  const baseUrl = `https://${hostname}`;

  const out: Record<string, unknown> = {
    probe: "efi-mtls-probe",
    scope: "HML diagnostic only",
    runtime: {
      deno: (globalThis as any).Deno?.version?.deno ?? null,
      v8: (globalThis as any).Deno?.version?.v8 ?? null,
      typescript: (globalThis as any).Deno?.version?.typescript ?? null,
    },
    createHttpClient_available: typeof (globalThis as any).Deno?.createHttpClient === "function",
    environment,
    efi_host: hostname,
    cert_present: false,
    key_present: false,
    http_client_created: false,
    tls_handshake: "NOT_RUN",
    http_reached: false,
    http_status: null,
    auth_api: "NOT_TESTED",
    error_class: null,
    error_message_sanitized: null,
  };

  const certPem = b64ToText(Deno.env.get("EFI_CERTIFICATE_HML"));
  const keyPem = b64ToText(Deno.env.get("EFI_PRIVATE_KEY_HML"));
  out.cert_present = !!certPem;
  out.key_present = !!keyPem;

  if (!certPem || !keyPem) {
    out.tls_handshake = "NOT_RUN";
    out.error_message_sanitized = "cert/key ausentes nos Secrets (apenas presenca verificada).";
    return json({ ok: true, result: out });
  }

  // 5) Handshake mTLS com caminho NEUTRO (sem dados financeiros)
  let client: any = null;
  try {
    if (!out.createHttpClient_available) {
      out.tls_handshake = "FAIL";
      out.error_class = "CREATE_HTTP_CLIENT_UNAVAILABLE";
      out.error_message_sanitized = "Deno.createHttpClient indisponivel neste runtime.";
      return json({ ok: true, result: out });
    }

    // Deno exige PEM: cert (X.509) + key (PKCS#8). Nomes: cert/key.
    client = (globalThis as any).Deno.createHttpClient({ cert: certPem, key: keyPem });
    out.http_client_created = true;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      let status = 0;
      let lastError: unknown = null;
      // Tenta raiz e, se falhar no nivel HTTP, um caminho neutro NAO-financeiro.
      for (const url of [baseUrl, baseUrl + PROBE_NEUTRAL_PATH]) {
        try {
          const resp = await fetch(url, { method: "GET", client, signal: controller.signal });
          status = resp.status;
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
        }
      }
      if (status === 0 && lastError) throw lastError;
      // Chegou aqui => TLS estabelecido e houve resposta HTTP.
      out.tls_handshake = "PASS";
      out.http_reached = true;
      out.http_status = status;
      // Sem OAuth/token => 401/403 e esperado e NAO e falha de mTLS.
      out.auth_api = "NOT_TESTED";
    } finally {
      clearTimeout(timer);
    }
  } catch (e: any) {
    out.tls_handshake = "FAIL";
    out.error_class = e?.name || "ERROR";
    out.error_message_sanitized = String(e?.message || "erro TLS").slice(0, 180);
  } finally {
    try { client?.close?.(); } catch { /* noop */ }
  }

  return json({ ok: true, result: out });
});
