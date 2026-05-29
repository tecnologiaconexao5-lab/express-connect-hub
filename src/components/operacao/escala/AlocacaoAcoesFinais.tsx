import { AlertTriangle, Loader2, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AlocacaoAcoesFinaisProps {
  hasSelectedAlocacao: boolean
  loading?: boolean
  salvando?: boolean
  disabled?: boolean
  mensagem?: string | null
  onSalvarClick: () => void
  onCancelarClick: () => void
}

export function AlocacaoAcoesFinais({
  hasSelectedAlocacao,
  loading,
  salvando,
  disabled,
  mensagem,
  onSalvarClick,
  onCancelarClick,
}: AlocacaoAcoesFinaisProps) {
  const isDisabled = disabled || salvando || loading

  return (
    <div className="flex justify-between items-center sm:justify-between mt-4">
      <div className="flex gap-2 items-center">
        {hasSelectedAlocacao && (
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 text-red-600 hover:bg-red-50 gap-1 font-bold text-xs"
            onClick={onCancelarClick}
            disabled={isDisabled}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Cancelar Alocação
          </Button>
        )}
        <Button
          variant="outline"
          className="border-emerald-200 text-emerald-700 bg-emerald-50/50 gap-2 font-bold text-xs opacity-50 cursor-not-allowed"
          disabled
          title="Em desenvolvimento"
        >
          <MessageCircle className="w-4 h-4" /> Confirmar via WA
        </Button>
        {mensagem && (
          <span className="text-xs text-muted-foreground ml-2">{mensagem}</span>
        )}
      </div>
      <Button onClick={onSalvarClick} disabled={isDisabled}>
        {salvando ? (
          <>
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            Salvando...
          </>
        ) : (
          "Salvar na Grade"
        )}
      </Button>
    </div>
  )
}
