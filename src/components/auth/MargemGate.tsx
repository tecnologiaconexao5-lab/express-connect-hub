import type { ReactNode } from "react";
import { ShieldOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePermissaoFinanceira } from "@/hooks/usePermissaoFinanceira";

interface MargemGateProps {
  children?: ReactNode;
  /** Título do módulo exibido no cartão de acesso restrito. */
  titulo?: string;
  /** Quando true, não renderiza nada (em vez do cartão de acesso restrito). */
  silencioso?: boolean;
}

/**
 * Bloqueia a renderização de qualquer conteúdo de margem/lucro para
 * usuários que não são Administrador Geral.
 */
export function MargemGate({ children, titulo, silencioso = false }: MargemGateProps) {
  const { podeVerMargem } = usePermissaoFinanceira();
  if (podeVerMargem) return <>{children}</>;

  if (silencioso) return null;

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-800">
          <ShieldOff className="h-4 w-4" />
          Acesso restrito à margem
        </CardTitle>
        <CardDescription className="text-amber-700">
          {titulo
            ? `${titulo}: disponível apenas para o Administrador Geral.`
            : "Valores de receita, custo, margem e lucro são visíveis apenas para o Administrador Geral."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-amber-700">
          Solicite permissão ao Administrador Geral caso precise analisar rentabilidade.
        </p>
      </CardContent>
    </Card>
  );
}

interface ValorMargemProps {
  children: ReactNode;
  /** Texto exibido quando o usuário não tem permissão. Padrão: "---". */
  mascarado?: ReactNode;
}

/** Exibe o valor/percentual apenas para Administrador Geral; caso contrário mostra "---". */
export function ValorMargem({ children, mascarado = "---" }: ValorMargemProps) {
  const { podeVerMargem } = usePermissaoFinanceira();
  return <>{podeVerMargem ? children : mascarado}</>;
}

export default MargemGate;
