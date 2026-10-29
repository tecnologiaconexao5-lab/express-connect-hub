import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationBarProps {
  page: number;
  pageSize: number;
  totalCount: number | null;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

/**
 * Monta a lista de páginas visíveis (com reticências) para paginação numerada.
 * Ex.: total=28, current=1 → [1, 2]; total=50, current=5 → [1, "…", 4, 5, 6, "…", 10].
 */
export function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 0) return [];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

/**
 * Rótulo de faixa da paginação.
 * totalCount=0 → "Exibindo 0 de 0" (nunca "null–null de 0").
 * totalCount=null → contagem desconhecida → "Página N".
 */
export function formatRangeLabel(page: number, pageSize: number, totalCount: number | null): string {
  if (totalCount === null) return `Página ${page}`;
  if (totalCount === 0) return "Exibindo 0 de 0";
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  return `Exibindo ${from}–${to} de ${totalCount}`;
}

export default function PaginationBar({ page, pageSize, totalCount, onPageChange, loading }: PaginationBarProps) {
  const totalPages = totalCount !== null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  const pages = totalPages ? buildPageList(page, totalPages) : [];
  const canPrev = page > 1;
  const canNext = totalPages === null ? true : page < totalPages;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4 text-sm text-muted-foreground">
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-foreground">
          {totalPages !== null ? `Página ${page} de ${totalPages}` : `Página ${page}`}
        </span>
        <span>{formatRangeLabel(page, pageSize, totalCount)}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={!canPrev || loading}
          onClick={() => onPageChange(page - 1)}
          title="Anterior"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-muted-foreground select-none">…</span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="sm"
              className="min-w-8 px-2"
              disabled={loading}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              title={`Página ${p}`}
            >
              {p}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={!canNext || loading}
          onClick={() => onPageChange(page + 1)}
          title="Próxima"
          aria-label="Próxima página"
        >
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
