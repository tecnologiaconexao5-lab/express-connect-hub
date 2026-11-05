import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FiltroAtivoItem {
  id: string;
  label: string;
  valor: string;
  onRemove: () => void;
}

export function FiltrosAtivos({
  filtros,
  onLimpar,
  className,
}: {
  filtros: FiltroAtivoItem[];
  onLimpar: () => void;
  className?: string;
}) {
  if (filtros.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {filtros.map((filtro) => (
        <span
          key={filtro.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary shadow-sm"
        >
          <span className="text-muted-foreground">{filtro.label}:</span>
          <span className="max-w-[220px] truncate">{filtro.valor}</span>
          <button
            type="button"
            onClick={filtro.onRemove}
            className="ml-0.5 rounded-full p-0.5 text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
            aria-label={`Remover filtro ${filtro.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onLimpar}
        className="h-7 gap-1 px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700"
      >
        <X className="h-3.5 w-3.5" /> Limpar filtros
      </Button>
    </div>
  );
}
