import { format } from "date-fns"
import { AlertTriangle, Loader2, AlertCircle, ClipboardList, Truck, DollarSign } from "lucide-react"
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
    status?: string
    temTracking?: boolean
    temPOD?: boolean
    temFinanceiro?: boolean
    temOSVinculada?: boolean
  } | null
  onConfirmarCancelamento: () => void
  cancelando?: boolean
  disabled?: boolean
}

function AlertaRisco({ label, ativo }: { label: string; ativo?: boolean }) {
  if (!ativo) return null
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-amber-800">
      <AlertCircle className="w-3 h-3 shrink-0" />
      <span>{label}</span>
    </div>
  )
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
              <p><strong>Status:</strong> {deleteTarget.status || "—"}</p>
              {deleteTarget.totals?.total && (
                <p><strong>Valor:</strong> R$ {deleteTarget.totals.total.toFixed(2)}</p>
              )}
            </div>
          )}
        </div>
        {deleteTarget?.temTracking || deleteTarget?.temPOD || deleteTarget?.temFinanceiro || deleteTarget?.temOSVinculada ? (
          <div className="space-y-1.5 bg-orange-50 border border-orange-200 rounded-lg p-2.5 text-[11px]">
            <p className="font-semibold text-orange-800 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Riscos identificados:
            </p>
            <AlertaRisco label="OS vinculada será desassociada." ativo={deleteTarget?.temOSVinculada} />
            <AlertaRisco label="Tracking em andamento será interrompido." ativo={deleteTarget?.temTracking} />
            <AlertaRisco label="POD/fotos já enviados permanecem no histórico." ativo={deleteTarget?.temPOD} />
            <AlertaRisco label="Financeiro vinculado será cancelado (valores reversão automática via trigger)." ativo={deleteTarget?.temFinanceiro} />
          </div>
        ) : null}
        <div className="text-[11px] text-muted-foreground bg-amber-50 border border-amber-100 rounded-lg p-2.5">
          A alocação será marcada como cancelada e removida da programação, relatórios e financeiro.
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
