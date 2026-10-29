// ============================================================
// useFormExitGuard — proteção contra perda silenciosa de alterações.
//
// Padrão único reutilizável (dirty state + beforeunload + confirmação de saída),
// alinhado ao já usado em OrdemServicoForm/PrestadorDetalhe.
//
// - isDirty: comparação serializada entre o valor atual e o baseline.
// - beforeunload: bloqueia fechar/recarregar a aba quando dirty.
// - confirmExit(): confirmação PREMIUM (modal centralizado via confirmAction,
//   sem window.confirm) para navegação interna (Voltar/Cancelar).
//   Retorna Promise<boolean> — true se pode sair.
// - markClean(): redefine o baseline (após carregar/salvar com sucesso).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirmAction } from "@/lib/confirmDialog";

export interface UseFormExitGuardOptions {
  /** Valor atual do formulário. */
  current: unknown;
  /** Baseline (valor carregado/inicial). Pode ser omitido e definido via markClean(). */
  initial?: unknown;
  /** Desativa a proteção (ex.: durante salvamento). */
  enabled?: boolean;
  /** Mensagem de confirmação. */
  message?: string;
  /** Serializador (default: JSON.stringify). */
  serialize?: (value: unknown) => string;
  /** Executado quando o usuário CONFIRMA o descarte (ex.: limpar rascunho local). */
  onDiscard?: () => void;
}

export interface UseFormExitGuardResult {
  isDirty: boolean;
  /** Confirma a saída. Resolve true se pode sair (premium modal). */
  confirmExit: () => Promise<boolean>;
  markClean: () => void;
}

const defaultSerialize = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value ?? "");
  }
};

export function useFormExitGuard({
  current,
  initial,
  enabled = true,
  message = "Há alterações não salvas. Deseja sair e descartar?",
  serialize = defaultSerialize,
  onDiscard,
}: UseFormExitGuardOptions): UseFormExitGuardResult {
  const currentSerialized = useMemo(() => serialize(current), [current, serialize]);
  const initialSerializedRef = useRef<string>(serialize(initial));
  const baselineRef = useRef<string>(initialSerializedRef.current);
  const [baseline, setBaseline] = useState<string>(initialSerializedRef.current);

  // Atualiza o baseline SOMENTE quando o `initial` (registro carregado) muda de
  // conteúdo — não a cada nova referência (evita reset indevido de dirty).
  useEffect(() => {
    const serialized = serialize(initial);
    if (serialized !== initialSerializedRef.current) {
      initialSerializedRef.current = serialized;
      baselineRef.current = serialized;
      setBaseline(serialized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const isDirty = enabled && currentSerialized !== baseline;

  // Browser exit guard (fechar/recarregar aba).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, message]);

  const markClean = useCallback(() => {
    baselineRef.current = currentSerialized;
    setBaseline(currentSerialized);
  }, [currentSerialized]);

  const onDiscardRef = useRef(onDiscard);
  onDiscardRef.current = onDiscard;

  const confirmExit = useCallback(async (): Promise<boolean> => {
    if (!isDirty) return true;
    const pode = await confirmAction({
      title: "Descartar alterações?",
      description: message,
      confirmText: "Sair sem salvar",
      cancelText: "Continuar editando",
      variant: "default",
    });
    if (pode) onDiscardRef.current?.();
    return pode;
  }, [isDirty, message]);

  return { isDirty, confirmExit, markClean };
}
