import { useState, useEffect } from "react";
import { toast } from "sonner";
import { proxyIaClient } from "./proxyIaClient";

// ============================================================
// SERVICO IA — Suporte a Groq, Gemini e Anthropic
// Chaves no backend seguro (proxy-ia Edge Function)
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
  promptOperacional: "Voce e um assistente operacional de logistica TMS. Responda de forma objetiva e profissional.",
  setor:             "operacional",
  tomLinguagem:      "formal",
  fallback:          "Nao foi possivel processar a solicitacao. Por favor, entre em contato com a equipe operacional.",
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
  const updated = [newEntry, ...logs].slice(0, 100);
  localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
}

export function getModelosPorProvider(provider: IAProvider): string[] {
  const map: Record<IAProvider, string[]> = {
    groq:      ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"],
    gemini:    ["gemini-2.0-flash", "gemini-2.0-flash-lite"],
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
    const resultado = await proxyIaClient.executar({
      provider: config.provider,
      model: config.modelo || "llama-3.3-70b-versatile",
      prompt: `${config.promptOperacional}\n\n${mensagem}`,
      max_tokens: 1024,
    });

    if (resultado.sucesso && resultado.resposta) {
      appendIALog({ tipo: "CHAT", mensagem, status: "ok", tokens: resultado.tokens_saida, provider: config.provider });
      return { resposta: resultado.resposta, tokens: resultado.tokens_saida, ok: true };
    }

    appendIALog({ tipo: "CHAT", mensagem, status: "fallback", provider: config.provider });
    return { resposta: config.fallback, ok: true };
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
