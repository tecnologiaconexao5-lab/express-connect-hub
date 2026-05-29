import { Wallet, CheckCircle, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export interface EscalaFinanceiroForm {
  valorCliente: number
  valorTipo: 'percentual' | 'fixo'
  valorPercentual: number
  valorFixo: number
  combustivel: number
  pedagio: number
  ajudantes: number
  valorAjudante: number
  diariasAdicionais: number
  desconto: number
  segundaSaida: boolean
  valorSegundaSaida: number
  terceiraSaida: boolean
  valorTerceiraSaida: number
}

export interface EscalaFinanceiroResumo {
  valorBase: number
  totalAdicionais: number
  totalDescontos: number
  total: number
  totalPrestador: number
  margem: number
  margemPercentual?: string
}

interface AlocacaoFinanceiroFieldsProps {
  financeiro: EscalaFinanceiroForm
  onFinanceiroChange: (updater: (prev: EscalaFinanceiroForm) => EscalaFinanceiroForm) => void
  resumo: EscalaFinanceiroResumo
}

export function AlocacaoFinanceiroFields({
  financeiro,
  onFinanceiroChange,
  resumo = { valorBase: 0, totalAdicionais: 0, totalDescontos: 0, total: 0, totalPrestador: 0, margem: 0, margemPercentual: undefined },
}: AlocacaoFinanceiroFieldsProps) {
  const set = (updater: (prev: EscalaFinanceiroForm) => EscalaFinanceiroForm) => {
    onFinanceiroChange(updater)
  }

  const fmt = (v: unknown) => (Number(v ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Valor do Cliente (Faturamento)</h4>
          <div className="space-y-1">
            <Label className="text-xs">Valor cobrado do cliente (R$)</Label>
            <Input type="number" value={financeiro.valorCliente} onChange={e => set(f => ({ ...f, valorCliente: Number(e.target.value) }))} className="h-9 border-blue-300" />
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Valor do Prestador (Repasse)</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Cálculo</Label>
              <Select value={financeiro.valorTipo} onValueChange={v => set(f => ({ ...f, valorTipo: v as 'percentual' | 'fixo' }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">% sobre tabela</SelectItem>
                  <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {financeiro.valorTipo === 'percentual' ? (
              <div className="space-y-1">
                <Label className="text-xs">Percentual (%)</Label>
                <Input type="number" value={financeiro.valorPercentual} onChange={e => set(f => ({ ...f, valorPercentual: Number(e.target.value) }))} className="h-9" />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Valor Fixo (R$)</Label>
                <Input type="number" value={financeiro.valorFixo} onChange={e => set(f => ({ ...f, valorFixo: Number(e.target.value) }))} className="h-9" />
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Adicionais e Descontos</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-600">Combustível (R$)</Label>
              <Input type="number" value={financeiro.combustivel} onChange={e => set(f => ({ ...f, combustivel: Number(e.target.value) }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-600">Pedágio (R$)</Label>
              <Input type="number" value={financeiro.pedagio} onChange={e => set(f => ({ ...f, pedagio: Number(e.target.value) }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-600">Ajudantes (qtd)</Label>
              <Input type="number" value={financeiro.ajudantes} onChange={e => set(f => ({ ...f, ajudantes: Number(e.target.value) }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-600">R$/Ajudante</Label>
              <Input type="number" value={financeiro.valorAjudante} onChange={e => set(f => ({ ...f, valorAjudante: Number(e.target.value) }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-600">Diárias Adic.</Label>
              <Input type="number" value={financeiro.diariasAdicionais} onChange={e => set(f => ({ ...f, diariasAdicionais: Number(e.target.value) }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-600">Desconto (R$)</Label>
              <Input type="number" value={financeiro.desconto} onChange={e => set(f => ({ ...f, desconto: Number(e.target.value) }))} className="h-8 text-xs border-red-200" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-white border rounded-lg p-2.5 flex items-center justify-between">
              <div className="flex flex-col">
                <Label className="text-[10px] font-bold">2ª Saída</Label>
                <span className="text-[9px] text-slate-400">Adicionar valor fixo</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={financeiro.segundaSaida} onCheckedChange={v => set(f => ({ ...f, segundaSaida: v }))} />
                <Input type="number" value={financeiro.valorSegundaSaida} onChange={e => set(f => ({ ...f, valorSegundaSaida: Number(e.target.value) }))} disabled={!financeiro.segundaSaida} className="w-16 h-8 text-xs" />
              </div>
            </div>

            <div className="bg-white border rounded-lg p-2.5 flex items-center justify-between">
              <div className="flex flex-col">
                <Label className="text-[10px] font-bold">3ª Saída</Label>
                <span className="text-[9px] text-slate-400">Adicionar valor fixo</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={financeiro.terceiraSaida} onCheckedChange={v => set(f => ({ ...f, terceiraSaida: v }))} />
                <Input type="number" value={financeiro.valorTerceiraSaida} onChange={e => set(f => ({ ...f, valorTerceiraSaida: Number(e.target.value) }))} disabled={!financeiro.terceiraSaida} className="w-16 h-8 text-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="md:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between min-h-[250px]">
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-primary" /> Resumo Financeiro
          </h4>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-blue-200 bg-blue-50/50 rounded px-1">
              <span className="text-blue-700 font-bold">Valor Cliente:</span>
              <span className="font-bold text-blue-700">R$ {fmt(resumo.totalPrestador)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-slate-500 font-semibold">Diária Base (Prest.):</span>
              <span className="font-bold text-slate-800">R$ {fmt(resumo.valorBase)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b">
              <span className="text-slate-500 font-semibold">Adicionais:</span>
              <span className="font-bold text-green-600">+ R$ {fmt(resumo.totalAdicionais)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b text-red-500">
              <span className="font-semibold">Descontos:</span>
              <span className="font-bold">- R$ {fmt(resumo.totalDescontos)}</span>
            </div>

            <div className="bg-white border rounded-lg p-2 mt-3 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total a Pagar (Prestador)</p>
              <p className="text-lg font-black text-green-600 mt-0.5">
                R$ {fmt(resumo.total)}
              </p>
            </div>

            <div className={`border rounded-lg p-2 mt-2 text-center ${(resumo.margem ?? 0) >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Margem Estimada</p>
              <p className={`text-base font-black mt-0.5 ${(resumo.margem ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                R$ {fmt(resumo.margem)}
                {resumo.margemPercentual != null && <span className="text-[11px] ml-1">({resumo.margemPercentual}%)</span>}
              </p>
              <div className="mt-1 flex justify-center gap-1">
                {resumo.margemPercentual && (
                  <>
                    {Number(resumo.margemPercentual) >= 20 ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px]">
                        <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> Margem saudável
                      </Badge>
                    ) : Number(resumo.margemPercentual) > 0 ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px]">
                        <AlertCircle className="w-2.5 h-2.5 mr-0.5" /> Margem baixa
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px]">
                        <AlertCircle className="w-2.5 h-2.5 mr-0.5" /> Margem negativa
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
