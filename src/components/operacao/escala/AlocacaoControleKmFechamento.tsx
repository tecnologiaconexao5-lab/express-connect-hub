import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import type { ResultadoCalculoEscala } from "@/helpers/calculoEscalaFinanceiro"

interface AlocacaoControleKmFechamentoProps {
  kmInicial: number
  kmFinal: number
  onKmInicialChange: (value: number) => void
  onKmFinalChange: (value: number) => void
  totals: ResultadoCalculoEscala
  tabelaValores: { km_franquia?: number; valor_km?: number; valor_base?: number } | null
  regraEspecialAtiva: boolean
  novoClienteId: string
  onGerarRelatorioClick: () => void
}

export function AlocacaoControleKmFechamento({
  kmInicial,
  kmFinal,
  onKmInicialChange,
  onKmFinalChange,
  totals,
  tabelaValores,
  regraEspecialAtiva,
  novoClienteId,
  onGerarRelatorioClick,
}: AlocacaoControleKmFechamentoProps) {
  const fmt = (v: unknown) => (Number(v ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  const fmtDecimal = (v: unknown) => (Number(v ?? 0)).toFixed(2)
  const kmRodados = totals.kmRodados
  const kmFranquia = tabelaValores?.km_franquia || 200
  const kmExcedente = totals.kmExcedente
  const tabelaNaoConfigurada = totals.tabelaNaoConfigurada
  const diariaCalculada = totals.diariaCalculada
  const totalDia = totals.total
  const valorKm = tabelaValores?.valor_km || 2.50
  const valorKmExcedente = totals.valorKmExcedente
  const diariaBase = tabelaValores?.valor_base || 400
  const percentualAdicional = totals.percentualAdicional

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2">
        Controle de KM e Fechamento
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 font-semibold">KM Inicial</Label>
            <Input
              type="number"
              value={kmInicial}
              onChange={(e) => onKmInicialChange(Number(e.target.value))}
              className="bg-white text-xs h-8 border-slate-200"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500 font-semibold">KM Final</Label>
            <Input
              type="number"
              value={kmFinal}
              onChange={(e) => onKmFinalChange(Number(e.target.value))}
              className="bg-white text-xs h-8 border-slate-200"
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-xs py-1 border-b">
          <span className="text-slate-500 font-semibold">KM Total Automático:</span>
          <span className="font-bold text-slate-800">{kmRodados} km</span>
        </div>

        <div className="flex justify-between items-center text-xs py-1 border-b">
          <span className="text-slate-500 font-semibold">Franquia KM:</span>
          {tabelaNaoConfigurada ? (
            <Badge className="bg-red-50 text-red-600 border border-red-100 font-bold text-[10px] border-0">
              Tabela não configurada
            </Badge>
          ) : (
            <span className="font-bold text-slate-800">{kmFranquia} km</span>
          )}
        </div>

        <div className="flex justify-between items-center text-xs py-1 border-b">
          <span className="text-slate-500 font-semibold">KM Excedente:</span>
          {tabelaNaoConfigurada ? (
            <span className="font-bold text-slate-400">-</span>
          ) : (
            <span className="font-bold text-orange-600">{kmExcedente} km</span>
          )}
        </div>

        <div className="flex justify-between items-center text-xs py-1 border-b">
          <span className="text-slate-500 font-semibold">Valor KM Adicional:</span>
          {tabelaNaoConfigurada ? (
            <Badge className="bg-red-50 text-red-600 border border-red-100 font-bold text-[10px] border-0">
              Tabela não configurada
            </Badge>
          ) : (
            <span className="font-bold text-slate-800">R$ {fmtDecimal(valorKm)}</span>
          )}
          </div>
          <div className="flex justify-between items-center text-xs py-1 text-slate-600">
            <span>Valor por KM Excedente:</span>
            <span className="font-bold text-slate-800">R$ {fmtDecimal(valorKmExcedente)}</span>
          </div>

        <div className="bg-white border rounded-lg p-3 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Total da Diária + Extras</p>
              <p className="text-[10px] text-slate-600">Antes da margem</p>
            </div>
            <span className="text-base font-black text-green-600">R$ {fmtDecimal(totalDia)}</span>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            variant="outline"
            className="gap-2 h-9 text-xs border-primary text-primary hover:bg-primary/10"
            onClick={onGerarRelatorioClick}
          >
            <Download className="w-3.5 h-3.5" /> Gerar Relatório de Pagamento
          </Button>
        </div>
      </div>
    </div>
  )
}
