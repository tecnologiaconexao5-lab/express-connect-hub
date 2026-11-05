// ============================================================
// Edge Function: ofertas-publicas
// ADM-APP-02B.2 — entrada pública de ofertas (motoboys/motoristas/veículos)
//
// Fluxo: navegador → esta Edge → RPC f_registrar_oferta_publica (service_role)
// → recrutamento_ofertas.
//
// Segurança:
//  - CORS restrito por env OFERTAS_PUBLICAS_ALLOWED_ORIGINS.
//  - Tenant vem exclusivamente de OFERTAS_PUBLICAS_TENANT_ID (server-side).
//  - service_role só existe no runtime da Edge; nunca é devolvido ao cliente.
//  - Captcha opcional/obrigatório por env; sem segredo, NÃO simula proteção.
//  - Rate limit é aplicado dentro da RPC, por tenant + IP hash.
//  - Logs sem CPF, telefone, e-mail, endereço ou conteúdo pessoal.
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validarPayloadOferta } from "./validation.ts";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_CAPTCHA_TOKEN = 4096;
const MAX_IDEMPOTENCY_KEY = 120;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_ID_SENTINELA = "00000000-0000-0000-0000-000000000001";

type JsonRecord = Record<string, unknown>;

interface CaptchaResult {
  ok: boolean;
  status: "ok" | "disabled" | "invalid" | "config_missing";
}

function allowedOrigins(): string[] {
  const raw = Deno.env.get("OFERTAS_PUBLICAS_ALLOWED_ORIGINS") ??
    "http://localhost:8800,http://127.0.0.1:8800";
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, apikey, x-client-info, Content-Type, x-captcha-token, x-idempotency-key",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(
  status: number,
  body: JsonRecord,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

function originPermitido(req: Request): { origin: string | null; ok: boolean } {
  const origin = req.headers.get("origin");
  if (!origin) return { origin: null, ok: true };
  const permitidos = allowedOrigins();
  return { origin, ok: permitidos.includes("*") || permitidos.includes(origin) };
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

async function sha256Hex(value: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${value}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readJsonBody(req: Request): Promise<JsonRecord> {
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "payload_muito_grande");
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new HttpError(413, "payload_muito_grande");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, "payload_invalido");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(400, "payload_invalido");
  }
  return parsed as JsonRecord;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function obterTokenCaptcha(req: Request, body: JsonRecord): string | null {
  const header = req.headers.get("x-captcha-token");
  const bodyToken = typeof body.captcha_token === "string" ? body.captcha_token : "";
  const token = (header || bodyToken || "").trim();
  if (!token) return null;
  if (token.length > MAX_CAPTCHA_TOKEN) return null;
  return token;
}

function obterIdempotencyKey(req: Request, body: JsonRecord): string | null {
  const header = req.headers.get("x-idempotency-key");
  const bodyKey = typeof body.request_id === "string" ? body.request_id : "";
  const key = (header || bodyKey || "").trim();
  if (!key) return null;
  if (key.length > MAX_IDEMPOTENCY_KEY) return null;
  return UUID_REGEX.test(key) ? key : null;
}

async function verificarCaptcha(token: string | null, ip: string): Promise<CaptchaResult> {
  const required = Deno.env.get("OFERTAS_PUBLICAS_REQUIRE_CAPTCHA") === "true";
  const secret = Deno.env.get("OFERTAS_PUBLICAS_CAPTCHA_SECRET") || "";
  if (!secret) {
    if (required) return { ok: false, status: "config_missing" };
    return { ok: true, status: "disabled" };
  }
  if (!token) return { ok: false, status: "invalid" };

  const provider = (Deno.env.get("OFERTAS_PUBLICAS_CAPTCHA_PROVIDER") || "turnstile").toLowerCase();
  const url = provider === "hcaptcha"
    ? "https://hcaptcha.com/siteverify"
    : "https://challenges.cloudflare.com/turnstile/v0/siteverify";

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (ip && ip !== "unknown") form.set("remoteip", ip);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false, status: "invalid" };
    const data = (await response.json()) as { success?: boolean };
    return data?.success === true
      ? { ok: true, status: "ok" }
      : { ok: false, status: "invalid" };
  } catch {
    return { ok: false, status: "invalid" };
  }
}

function mapearErroRpc(message: string): number {
  const code = (message || "").toLowerCase();
  if (code.includes("rate_limit")) return 429;
  if (code.includes("captcha")) return 403;
  if (code.includes("tenant")) return 503;
  if (
    code.includes("payload") ||
    code.includes("campos") ||
    code.includes("nome") ||
    code.includes("telefone") ||
    code.includes("email") ||
    code.includes("cidade") ||
    code.includes("uf") ||
    code.includes("regioes") ||
    code.includes("dias") ||
    code.includes("modalidade") ||
    code.includes("veiculo") ||
    code.includes("valor") ||
    code.includes("lgpd") ||
    code.includes("horario")
  ) {
    return 400;
  }
  return 500;
}

serve(async (req) => {
  const startedAt = Date.now();
  const { origin, ok: corsOk } = originPermitido(req);
  if (!corsOk) {
    return jsonResponse(403, { error: "origem_nao_autorizada" }, origin);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "metodo_nao_permitido" }, origin);
  }

  try {
    const tenantId = (Deno.env.get("OFERTAS_PUBLICAS_TENANT_ID") || "").trim();
    if (!UUID_REGEX.test(tenantId) && tenantId !== TENANT_ID_SENTINELA) {
      return jsonResponse(503, { error: "configuracao_indisponivel" }, origin);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const ipSalt = Deno.env.get("OFERTAS_PUBLICAS_IP_SALT") || "";
    if (!supabaseUrl || !serviceKey || !ipSalt) {
      return jsonResponse(503, { error: "configuracao_indisponivel" }, origin);
    }

    const rawBody = await readJsonBody(req);
    const captchaToken = obterTokenCaptcha(req, rawBody);
    const requestId = obterIdempotencyKey(req, rawBody);

    const payloadInput: JsonRecord = { ...rawBody };
    delete payloadInput.captcha_token;
    delete payloadInput.request_id;

    const ip = getClientIp(req);
    const captcha = await verificarCaptcha(captchaToken, ip);
    if (!captcha.ok) {
      const status = captcha.status === "config_missing" ? 503 : 403;
      return jsonResponse(status, { error: "captcha_invalido" }, origin);
    }

    const validacao = validarPayloadOferta(payloadInput);
    if (!validacao.ok) {
      console.warn("[ofertas-publicas] payload rejeitado", { motivo: validacao.error });
      return jsonResponse(400, { error: "payload_invalido" }, origin);
    }

    const ipHash = await sha256Hex(ip, ipSalt);
    const userAgent = req.headers.get("user-agent") || "";
    const userAgentHash = userAgent ? await sha256Hex(userAgent, ipSalt) : null;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.rpc("f_registrar_oferta_publica", {
      p_tenant_id: tenantId,
      p_payload: validacao.payload,
      p_request_id: requestId,
      p_ip_hash: ipHash,
      p_user_agent_hash: userAgentHash,
    });

    if (error) {
      const status = mapearErroRpc(error.message || "");
      console.error("[ofertas-publicas] rpc falhou", {
        status,
        code: error.code || null,
        motivo: error.message || null,
        latency_ms: Date.now() - startedAt,
      });
      return jsonResponse(status, { error: status === 429 ? "muitas_tentativas" : "nao_foi_possivel_registrar" }, origin);
    }

    const protocolo = typeof data?.protocolo === "string" ? data.protocolo : null;
    if (!protocolo) {
      return jsonResponse(502, { error: "resposta_invalida" }, origin);
    }

    console.log("[ofertas-publicas] oferta registrada", {
      status: 200,
      protocolo,
      ip_hash_prefix: ipHash.slice(0, 12),
      captcha: captcha.status,
      latency_ms: Date.now() - startedAt,
    });

    return jsonResponse(200, { success: true, protocolo }, origin);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const code = error instanceof HttpError ? error.message : "erro_interno";
    console.warn("[ofertas-publicas] erro", { status, code, latency_ms: Date.now() - startedAt });
    return jsonResponse(status, { error: status === 413 ? "payload_muito_grande" : "nao_foi_possivel_registrar" }, origin);
  }
});
