// ============================================================
// formDraft — persistência local de rascunhos de formulário.
//
// - localStorage (sobrevive à troca de aba/menu e ao reload).
// - Envelope { savedAt, value } com TTL (default 48h) para evitar
//   restaurar rascunhos antigos de sessões esquecidas.
// - `descartarRascunhoForm` bloqueia gravações posteriores da MESMA chave
//   (inclusive o flush de desmontagem) até `limparRascunhoForm`/`liberar`.
// ============================================================

import { useEffect, useRef } from "react";

export const FORM_DRAFT_TTL_MS = 48 * 60 * 60 * 1000;

interface FormDraftEnvelope<T> {
  savedAt: string;
  value: T;
}

/** Chaves descartadas explicitamente — não devem ser regravadas no unmount. */
const descartados = new Set<string>();

export function liberarRascunhoForm(key: string): void {
  descartados.delete(key);
}

export function lerRascunhoForm<T>(key: string, ttlMs: number = FORM_DRAFT_TTL_MS): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormDraftEnvelope<T> | T | null;
    if (!parsed || typeof parsed !== "object") return null;

    const envelope =
      "value" in (parsed as Record<string, unknown>)
        ? (parsed as FormDraftEnvelope<T>)
        : ({ savedAt: "", value: parsed as T } as FormDraftEnvelope<T>);

    if (envelope.savedAt) {
      const idade = Date.now() - new Date(envelope.savedAt).getTime();
      if (!Number.isFinite(idade) || idade > ttlMs) {
        localStorage.removeItem(key);
        return null;
      }
    }
    return envelope.value ?? null;
  } catch {
    return null;
  }
}

export function gravarRascunhoForm<T>(key: string, value: T): void {
  if (descartados.has(key)) return;
  try {
    const envelope: FormDraftEnvelope<T> = { savedAt: new Date().toISOString(), value };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // localStorage indisponível/cota — ignora silenciosamente
  }
}

/** Remove o rascunho e PERMITE novas gravações (usado após salvar com sucesso). */
export function limparRascunhoForm(key: string): void {
  descartados.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // ignora
  }
}

/** Remove o rascunho e BLOQUEIA regravações (usado no descarte confirmado). */
export function descartarRascunhoForm(key: string): void {
  descartados.add(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // ignora
  }
}

/**
 * Auto-save silencioso do formulário (debounce) + flush ao desmontar.
 * `enabled=false` desativa (ex.: tela somente leitura).
 */
export function useAutoSaveFormDraft<T>(
  key: string,
  value: T,
  enabled = true,
  debounceMs = 500,
): void {
  const valueRef = useRef<T>(value);
  valueRef.current = value;

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => gravarRascunhoForm(key, valueRef.current), debounceMs);
    return () => clearTimeout(timer);
  }, [key, enabled, value, debounceMs]);

  useEffect(() => {
    if (!enabled) return;
    return () => {
      gravarRascunhoForm(key, valueRef.current);
    };
  }, [key, enabled]);
}
