import { AlertTriangle } from "lucide-react";

/**
 * Badge "Cadastro Incompleto" — marca clientes/prestadores criados rapidamente
 * (ou sem dados essenciais) para que a operação finalize o cadastro.
 */
export function BadgeCadastroIncompleto({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700 ${className}`}
    >
      <AlertTriangle className="h-3 w-3" />
      Cadastro Incompleto
    </span>
  );
}
