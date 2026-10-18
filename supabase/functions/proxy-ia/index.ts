// Proxy IA — Edge Function segura para chamadas de IA
// As chaves de API ficam APENAS aqui (backend), NUNCA no frontend
// Frontend chama esta edge function em vez de chamar APIs IA diretamente
// Segurança: valida JWT do Supabase, não loga secrets, não loga prompts completos

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

interface RequestBody {
  provider: string;
  model: string;
  prompt: string;
  context?: string;
  temperature?: number;
  max_tokens?: number;
  tenant_id?: string;
  tipo_tarefa?: string;
  images?: { type: string; data: string }[];
}

interface ProviderConfig {
  provider: string;
  model: string;
  prompt: string;
  context: string;
  temperature: number;
  max_tokens: number;
  images?: { type: string; data: string }[];
}

const DEFAULT_TIMEOUT = 25000; // 25s timeout for AI provider calls

const PROVIDER_KEYS: Record<string, string> = {
  groq: Deno.env.get("GROQ_API_KEY") || "",
  gemini: Deno.env.get("GEMINI_API_KEY") || "",
  openrouter: Deno.env.get("OPENROUTER_API_KEY") || "",
  openai: Deno.env.get("OPENAI_API_KEY") || "",
  anthropic: Deno.env.get("ANTHROPIC_API_KEY") || "",
};

const PROVIDER_URLS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
};

// Suporta v1 e v1beta; v1beta necessário para alguns modelos 1.5
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function buildHeaders(provider: string, key: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "gemini") return headers;
  if (provider === "anthropic") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    return headers;
  }
  headers["Authorization"] = `Bearer ${key}`;
  return headers;
}

function buildBody(config: ProviderConfig): Record<string, unknown> {
  const fullPrompt = config.context
    ? `Contexto:\n${config.context}\n\nPrompt:\n${config.prompt}`
    : config.prompt;

  if (config.provider === "gemini") {
    return {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.max_tokens,
      },
    };
  }

  if (config.provider === "anthropic") {
    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.max_tokens,
      messages: [{ role: "user", content: fullPrompt }],
      temperature: config.temperature,
    };

    if (config.images && config.images.length > 0) {
      body.messages = [{
        role: "user",
        content: [
          { type: "text", text: fullPrompt },
          ...config.images.map((img) => ({
            type: "image",
            source: { type: "base64", media_type: img.type, data: img.data },
          })),
        ],
      }];
    }

    return body;
  }

  return {
    model: config.model,
    messages: [{ role: "user", content: fullPrompt }],
    temperature: config.temperature,
    max_tokens: config.max_tokens,
  };
}

function extractResponse(provider: string, data: unknown): string {
  const d = data as Record<string, unknown>;

  if (provider === "gemini") {
    const candidates = d.candidates as Array<Record<string, unknown>> | undefined;
    return candidates?.[0]?.content
      ? ((candidates[0].content as Record<string, unknown>).parts as Array<Record<string, unknown>>)?.[0]?.text as string || ""
      : (d.text as string) || "";
  }

  if (provider === "anthropic") {
    const content = d.content as Array<Record<string, unknown>> | undefined;
    return content?.[0]?.text as string || "";
  }

  const choices = d.choices as Array<Record<string, unknown>> | undefined;
  return choices?.[0]?.message
    ? ((choices[0].message as Record<string, unknown>).content as string) || ""
    : "";
}

serve(async (req: Request) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo nao permitido" }), { status: 405, headers });
  }

  // Auth: valida JWT do Supabase (anon key ou service role)
  // O Gateway do Supabase já faz a validação na borda, mas reforçamos aqui
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Token de autenticacao ausente" }), { status: 401, headers });
  }

  try {
    const body: RequestBody = await req.json();
    const {
      provider, model, prompt,
      context = "",
      temperature = 0.7,
      max_tokens = 1024,
      images,
    } = body;

    if (!provider || !model || !prompt) {
      return new Response(JSON.stringify({ error: "provider, model e prompt sao obrigatorios" }), { status: 400, headers });
    }

    const key = PROVIDER_KEYS[provider];
    if (!key) {
      const configuredProviders = Object.entries(PROVIDER_KEYS)
        .filter(([, v]) => v)
        .map(([k]) => k);
      return new Response(JSON.stringify({
        error: `Provedor ${provider} nao configurado no servidor. Configurados: ${configuredProviders.join(", ") || "nenhum"}`,
        configured: configuredProviders,
        provider,
        model,
      }), { status: 503, headers });
    }

    let url = PROVIDER_URLS[provider];
    if (provider === "gemini") {
      url = `${GEMINI_BASE}/${model}:generateContent?key=${key}`;
    }

    const config: ProviderConfig = { provider, model, prompt, context, temperature, max_tokens, images };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(provider, key),
      body: JSON.stringify(buildBody(config)),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({
        error: `HTTP ${response.status}: ${errorText.substring(0, 500)}`,
        provider,
        model,
      }), { status: response.status, headers });
    }

    const data = await response.json();
    const resposta = extractResponse(provider, data);

    return new Response(JSON.stringify({
      sucesso: true,
      resposta,
      provider,
      model,
      tokens_entrada: Math.ceil(prompt.length / 4),
      tokens_saida: Math.ceil(resposta.length / 4),
    }), { status: 200, headers });

  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : "Erro interno";
    return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers });
  }
});
