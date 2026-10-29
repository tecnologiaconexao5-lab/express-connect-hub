import { Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface HistoricoOSItem {
  data?: string;
  acao?: string;
  usuario?: string;
  status_novo?: string;
  [chave: string]: unknown;
}

interface HistoricoOSProps {
  historico?: HistoricoOSItem[] | null;
  vazio?: string;
  className?: string;
}

const formatarDataHistorico = (valor?: string): string => {
  if (!valor) return "—";
  try {
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleString("pt-BR");
  } catch {
    return String(valor);
  }
};

/**
 * Timeline do histórico da OS — componente único reutilizado pelo Preview
 * (OrdemServicoPreview) e pelo Dialog rápido da Lista de OS.
 */
export function HistoricoOS({ historico, vazio = "Sem registros de histórico.", className }: HistoricoOSProps) {
  const itens = Array.isArray(historico) ? historico : [];

  if (itens.length === 0) {
    return (
      <div
        className={`rounded-lg border border-dashed bg-slate-50 py-8 text-center text-sm text-muted-foreground ${className || ""}`}
      >
        <Clock className="mx-auto mb-2 h-6 w-6 opacity-30" />
        {vazio}
      </div>
    );
  }

  return (
    <div className={`relative ml-3 space-y-6 border-l-2 border-slate-200 ${className || ""}`}>
      {itens.map((h, idx) => (
        <div key={idx} className="relative pl-6">
          <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white bg-slate-200" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{formatarDataHistorico(h.data)}</span>
              <Badge variant="secondary" className="text-[10px]">{h.acao}</Badge>
            </div>
            <p className="text-sm font-medium">{h.status_novo || h.acao}</p>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" /> {h.usuario || "Sistema"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default HistoricoOS;
