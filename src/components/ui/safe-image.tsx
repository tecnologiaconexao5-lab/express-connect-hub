import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SafeImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  /**
   * Renderizado quando não há imagem, o src é inválido ou o carregamento falha.
   * Evita o ícone de imagem quebrada nas listagens.
   */
  fallback?: ReactNode;
  fallbackClassName?: string;
  loading?: "lazy" | "eager";
}

/**
 * Imagem resiliente para listagens: enquanto o src for válido tenta carregar;
 * em erro (404, URL quebrada, caminho de Storage inválido) mostra o fallback
 * em vez do ícone de imagem quebrada. Se o src mudar, tenta de novo.
 */
export function SafeImage({
  src,
  alt = "",
  className,
  fallback,
  fallbackClassName,
  loading = "lazy",
}: SafeImageProps) {
  const texto = String(src ?? "").trim();
  const [falhouEm, setFalhouEm] = useState<string | null>(null);

  const srcValido = !!texto && !/^(null|undefined|nan)$/i.test(texto) && falhouEm !== texto;

  if (!srcValido) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted text-muted-foreground",
          fallbackClassName
        )}
        aria-hidden={!fallback}
      >
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={texto}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => setFalhouEm(texto)}
    />
  );
}
