// ============================================================
// useRouterBlocker — bloqueia a navegação do router quando há
// alterações não salvas (menu lateral, links e histórico).
//
// Requer um DATA ROUTER (`createBrowserRouter`), por isso é um
// hook separado do useFormExitGuard (que também roda em contextos
// sem data router, ex.: testes com renderHook).
// ============================================================

import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { confirmAction } from "@/lib/confirmDialog";

export interface UseRouterBlockerOptions {
  /** Há alterações não salvas? (normalmente `exitGuard.isDirty`). */
  isDirty: boolean;
  /** Desativa o bloqueio (ex.: tela somente leitura). */
  enabled?: boolean;
  /** Mensagem do modal de confirmação. */
  message?: string;
  /** Executado quando o usuário CONFIRMA o descarte. */
  onDiscard?: () => void;
}

export function useRouterBlocker({
  isDirty,
  enabled = true,
  message = "Há alterações não salvas. Deseja sair e descartar?",
  onDiscard,
}: UseRouterBlockerOptions): void {
  const onDiscardRef = useRef(onDiscard);
  onDiscardRef.current = onDiscard;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      enabled &&
      isDirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  const bloqueioEmAndamentoRef = useRef(false);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      bloqueioEmAndamentoRef.current = false;
      return;
    }
    if (bloqueioEmAndamentoRef.current) return;
    bloqueioEmAndamentoRef.current = true;
    void (async () => {
      const pode = await confirmAction({
        title: "Descartar alterações?",
        description: message,
        confirmText: "Sair sem salvar",
        cancelText: "Continuar editando",
        variant: "default",
      });
      if (pode) {
        onDiscardRef.current?.();
        blocker.proceed();
      } else {
        blocker.reset();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker.state]);
}
