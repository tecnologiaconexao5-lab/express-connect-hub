import { format } from "date-fns"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

interface AlocacaoCancelamentoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deleteTarget: {
    prestadorNome?: string
    data?: Date | string
    clienteNome?: string
    totals?: { total?: number }
  } | null
  onConfirmarCancelamento: () => void
  cancelando?: boolean
  disabled?: boolean
}

export function AlocacaoCancelamentoModal({
  open,
  onOpenChange,
  deleteTarget,
  onConfirmarCancelamento,
  cancelando,
  disabled,
}: AlocacaoCancelamentoModalProps) {
  const isDisabled = disabled || cancelando

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" /> Cancelar Alocação
          </DialogTitle>
          <DialogDescription>
            Deseja realmente cancelar/excluir esta alocação?
          </DialogDescription>
        </DialogHeader>
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-800">
          {deleteTarget && (
            <div className="space-y-1">
              <p><strong>Prestador:</strong> {deleteTarget.prestadorNome}</p>
              <p><strong>Data:</strong> {deleteTarget.data ? format(new Date(deleteTarget.data), "dd/MM/yyyy") : "—"}</p>
              <p><strong>Cliente:</strong> {deleteTarget.clienteNome || "—"}</p>
              {deleteTarget.totals?.total && (
                <p><strong>Valor:</strong> R$ {deleteTarget.totals.total.toFixed(2)}</p>
              )}
            </div>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground bg-amber-50 border border-amber-100 rounded-lg p-2.5">
          A alocação será marcada como cancelada e removida da escala, relatórios e financeiro.
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDisabled}>
            Manter Alocação
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirmarCancelamento}
            disabled={isDisabled}
          >
            {cancelando ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Cancelando...
              </>
            ) : (
              "Sim, Cancelar Alocação"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
