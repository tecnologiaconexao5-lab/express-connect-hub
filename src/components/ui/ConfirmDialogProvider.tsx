import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type MouseEvent } from "react";
import { AlertTriangle, HelpCircle, Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { subscribeDialog, getDialogSnapshot, resolveDialog } from "@/lib/confirmDialog";

/**
 * Host visual único dos diálogos de confirmação/prompt.
 * Montado uma vez no topo da aplicação (main.tsx).
 */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const request = useSyncExternalStore(subscribeDialog, getDialogSnapshot, () => null);
  const intentRef = useRef<"confirm" | "cancel">("cancel");
  const inputRef = useRef<HTMLInputElement>(null);
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    if (!request) return;
    intentRef.current = "cancel";
    setPromptValue(request.kind === "prompt" ? (request.options.defaultValue ?? "") : "");
    if (request.kind === "prompt") {
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [request]);

  const open = request !== null;
  const isPrompt = request?.kind === "prompt";
  const options = request?.options;
  const destructive = request?.kind === "confirm" && (request.options.variant ?? "default") === "destructive";
  const promptInvalido = isPrompt && !promptValue.trim();

  const settle = (value: boolean | string | null) => resolveDialog(value);

  const handleOpenChange = (next: boolean) => {
    if (next || !request) return;
    const value: boolean | string | null =
      request.kind === "prompt"
        ? intentRef.current === "confirm"
          ? promptValue.trim()
          : null
        : intentRef.current === "confirm";
    intentRef.current = "cancel";
    settle(value);
  };

  const confirmar = () => {
    if (promptInvalido) return;
    intentRef.current = "confirm";
    settle(request?.kind === "prompt" ? promptValue.trim() : true);
  };

  return (
    <>
      {children}
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent className="max-w-md rounded-2xl border-border/60 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-start gap-3 text-left">
              <span
                className={cn(
                  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                )}
              >
                {destructive ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : isPrompt ? (
                  <HelpCircle className="h-5 w-5" />
                ) : (
                  <Info className="h-5 w-5" />
                )}
              </span>
              <div className="space-y-1.5">
                <AlertDialogTitle className="text-base">{options?.title}</AlertDialogTitle>
                {options?.description && (
                  <AlertDialogDescription className="whitespace-pre-line">{options.description}</AlertDialogDescription>
                )}
              </div>
            </div>
          </AlertDialogHeader>

          {isPrompt && request?.kind === "prompt" && (
            <div className="space-y-2">
              {request.options.inputLabel && (
                <Label htmlFor="confirm-dialog-input" className="text-xs font-medium">
                  {request.options.inputLabel}
                </Label>
              )}
              <Input
                id="confirm-dialog-input"
                ref={inputRef}
                value={promptValue}
                placeholder={request.options.placeholder}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !promptInvalido) {
                    e.preventDefault();
                    confirmar();
                  }
                }}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { intentRef.current = "cancel"; }}>
              {options?.cancelText ?? "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={promptInvalido}
              className={cn(destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
              onClick={(e: MouseEvent) => {
                e.preventDefault();
                confirmar();
              }}
            >
              {options?.confirmText ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ConfirmDialogProvider;
