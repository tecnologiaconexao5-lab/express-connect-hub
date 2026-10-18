// ============================================================
// confirmDialog — API imperativa de confirmação/prompt PREMIUM
//
// Substitui os diálogos nativos do navegador (window.confirm /
// window.prompt) por um Modal/Dialog centralizado (Radix AlertDialog).
//
// Uso:
//   const ok = await confirmAction({ title: "Excluir?", variant: "destructive" });
//   const motivo = await promptAction({ title: "Motivo do bloqueio" });
//
// O host visual é montado uma única vez em <ConfirmDialogProvider> (main.tsx).
// Quando nenhum host está montado (ex.: testes unitários/uso fora da árvore
// React), cai no fallback nativo para não quebrar fluxos headless.
// ============================================================

export type ConfirmVariant = "default" | "destructive";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

export interface PromptOptions {
  title: string;
  description?: string;
  inputLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

export type DialogRequest =
  | { id: number; kind: "confirm"; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: "prompt"; options: PromptOptions; resolve: (v: string | null) => void };

let current: DialogRequest | null = null;
const queue: DialogRequest[] = [];
const listeners = new Set<() => void>();
let seq = 0;

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDialogSnapshot(): DialogRequest | null {
  return current;
}

/** Resolve o diálogo ativo e promove o próximo da fila (chamado pelo host). */
export function resolveDialog(result: boolean | string | null): void {
  if (!current) return;
  const req = current;
  current = queue.shift() ?? null;
  emit();
  // Resolve após atualizar o estado para evitar reentrância.
  (req.resolve as (v: boolean | string | null) => void)(result);
}

function hasHost(): boolean {
  return listeners.size > 0;
}

function joinMessage(title: string, description?: string): string {
  return [title, description].filter(Boolean).join("\n\n");
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (!hasHost()) {
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      return Promise.resolve(window.confirm(joinMessage(options.title, options.description)));
    }
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    const req: DialogRequest = { id: ++seq, kind: "confirm", options, resolve };
    if (current) queue.push(req);
    else {
      current = req;
      emit();
    }
  });
}

export function promptAction(options: PromptOptions): Promise<string | null> {
  if (!hasHost()) {
    if (typeof window !== "undefined" && typeof window.prompt === "function") {
      return Promise.resolve(window.prompt(joinMessage(options.title, options.description), options.defaultValue ?? ""));
    }
    return Promise.resolve(null);
  }
  return new Promise<string | null>((resolve) => {
    const req: DialogRequest = { id: ++seq, kind: "prompt", options, resolve };
    if (current) queue.push(req);
    else {
      current = req;
      emit();
    }
  });
}
