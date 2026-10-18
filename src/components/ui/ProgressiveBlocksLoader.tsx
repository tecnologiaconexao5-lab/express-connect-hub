import React from "react";
import { cn } from "@/lib/utils";

export interface ProgressiveBlocksLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "small" | "normal" | "page";
  className?: string;
  label?: string;
}

/**
 * Padrão Global de Carregamento TMS Conexão Express:
 * 4 Blocos Progressivos Animados (■ ■ ■ ■)
 *
 * Requisitos:
 * - Exatamente 4 blocos arredondados
 * - Animação sequencial contínua (1 -> 2 -> 3 -> 4 -> repetir)
 * - Visualmente SOMENTE os 4 blocos (sem texto visual)
 * - Zero delay artificial / zero requisições extras
 * - Acessibilidade via role="status" e aria-label invisível
 * - Tratamento para prefers-reduced-motion
 * - Três variantes: small, normal, page
 */
export const ProgressiveBlocksLoader = React.forwardRef<HTMLDivElement, ProgressiveBlocksLoaderProps>(
  ({ size = "normal", className, label = "Carregando conteúdo", ...props }, ref) => {
    // Configurações dimensionais por variante
    const sizeConfig = {
      small: {
        container: "gap-1 py-0.5 inline-flex items-center justify-center",
        block: "w-1.5 h-1.5 rounded-[2px]",
      },
      normal: {
        container: "gap-1.5 py-2 inline-flex items-center justify-center",
        block: "w-2.5 h-2.5 rounded-sm",
      },
      page: {
        container: "gap-2.5 py-6 flex items-center justify-center min-h-[160px] w-full",
        block: "w-3.5 h-3.5 rounded-md",
      },
    };

    const currentConfig = sizeConfig[size] || sizeConfig.normal;

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn(currentConfig.container, className)}
        {...props}
      >
        <span className="sr-only">{label}</span>
        <div className="flex items-center gap-[inherit]" aria-hidden="true">
          <span
            data-block="1"
            className={cn(
              "bg-primary tms-progressive-block tms-progressive-block-1 shrink-0",
              currentConfig.block
            )}
          />
          <span
            data-block="2"
            className={cn(
              "bg-primary tms-progressive-block tms-progressive-block-2 shrink-0",
              currentConfig.block
            )}
          />
          <span
            data-block="3"
            className={cn(
              "bg-primary tms-progressive-block tms-progressive-block-3 shrink-0",
              currentConfig.block
            )}
          />
          <span
            data-block="4"
            className={cn(
              "bg-primary tms-progressive-block tms-progressive-block-4 shrink-0",
              currentConfig.block
            )}
          />
        </div>
      </div>
    );
  }
);

ProgressiveBlocksLoader.displayName = "ProgressiveBlocksLoader";

export default ProgressiveBlocksLoader;
