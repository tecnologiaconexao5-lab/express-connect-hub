import { useState, useEffect } from "react";
import { toast } from "sonner";

// ============================================================
// SERVIÇO IA — Suporte a Groq, Gemini e Anthropic
// Configuração via ENV (sem hardcode de chaves)
// ============================================================

export type IAProvider = "groq" | "gemini" | "anthropic" | "none";

export interface IAConfig {
  provider: IAProvider;
  modelo: string;
  promptOperacional: string;
  setor: string;
  tomLinguagem: string;
  fallback: string;
  ativo: boolean;
}

export interface IALogEntry {
  id: string;
  timestamp: string;
  tipo: string;
  mensagem: string;
  status: "ok" | "erro" | "fallback";
  tokens?: number;
  provider: IAProvider;
}

const CONFIG_KEY = "tms_ia_config";
const LOGS_KEY   = "tms_ia_logs";

export const DEFAULT_CONFIG: IAConfig = {
  provider:          "none",
  modelo:            "",
  promptOperacional: "Você é um assistente operacional de logística TMS. Responda de forma objetiva e profissional.",
  setor:             "operacional",
  tomLinguagem:      "formal",
  fallback:          "Não foi possível processar a solicitação. Por favor, entre em contato com a equipe operacional.",
  ativo:             false,
};

export function loadIAConfig(): IAConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

export function saveIAConfig(cfg: IAConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

export function loadIALogs(): IALogEntry[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function appendIALog(entry: Omit<IALogEntry, "id" | "timestamp">): void {
  const logs = loadIALogs();
  const newEntry: IALogEntry = {
    ...entry,
    id:        Date.now().toString(),
    timestamp: new Date().toISOString(),
  };
  const updated = [newEntry, ...logs].slice(0, 100); // manter apenas últimos 100
  localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
}

export function getModelosPorProvider(provider: IAProvider): string[] {
  const map: Record<IAProvider, string[]> = {
    groq:      ["llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768", "gemma2-9b-it"],
    gemini:    ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
    anthropic: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
    none:      [],
  };
  return map[provider] || [];
}

export async function enviarMensagemIA(
  mensagem: string,
  config: IAConfig
): Promise<{ resposta: string; tokens?: number; ok: boolean; erro?: string }> {
  if (!config.ativo || config.provider === "none") {
    appendIALog({ tipo: "CHAT", mensagem, status: "fallback", provider: "none" });
    return { resposta: config.fallback, ok: true };
  }

  try {
    const apiKey = config.provider === "groq"
      ? import.meta.env.VITE_GROQ_API_KEY
      : config.provider === "gemini"
      ? import.meta.env.VITE_GEMINI_API_KEY
      : import.meta.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      appendIALog({ tipo: "CHAT", mensagem, status: "fallback", provider: config.provider });
      return { resposta: config.fallback, ok: true };
    }

    let resposta = "";
    let tokens = 0;

    if (config.provider === "groq") {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model:    config.modelo || "llama3-70b-8192",
          messages: [
            { role: "system",   content: config.promptOperacional },
            { role: "user",     content: mensagem },
          ],
          max_tokens: 1024,
        }),
      });
      const json = await res.json();
      resposta = json.choices?.[0]?.message?.content || config.fallback;
      tokens   = json.usage?.total_tokens;
    }

    if (config.provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.modelo || "gemini-1.5-flash"}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${config.promptOperacional}\n\n${mensagem}` }] }],
          }),
        }
      );
      const json = await res.json();
      resposta = json.candidates?.[0]?.content?.parts?.[0]?.text || config.fallback;
    }

    if (config.provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key":    apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model:      config.modelo || "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          system:     config.promptOperacional,
          messages:   [{ role: "user", content: mensagem }],
        }),
      });
      const json = await res.json();
      resposta = json.content?.[0]?.text || config.fallback;
      tokens   = json.usage?.input_tokens + json.usage?.output_tokens;
    }

    appendIALog({ tipo: "CHAT", mensagem, status: "ok", tokens, provider: config.provider });
    return { resposta, tokens, ok: true };
  } catch (e: any) {
    appendIALog({ tipo: "CHAT", mensagem, status: "erro", provider: config.provider });
    return { resposta: config.fallback, ok: false, erro: e.message };
  }
}

// Hook para usar a IA facilmente em qualquer componente
export function useIA() {
  const [config, setConfigState] = useState<IAConfig>(loadIAConfig);
  const [logs,   setLogs]   = useState<IALogEntry[]>(loadIALogs);

  const updateConfig = (c: IAConfig) => {
    saveIAConfig(c);
    setConfigState(c);
    toast.success("Configuração de IA salva!");
  };

  const enviar = async (msg: string) => {
    const result = await enviarMensagemIA(msg, config);
    setLogs(loadIALogs());
    return result;
  };

  return { config, updateConfig, logs, enviar, reloadLogs: () => setLogs(loadIALogs()) };
}
