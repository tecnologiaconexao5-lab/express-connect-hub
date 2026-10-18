import { Wallet, CheckCircle, AlertCircle, Truck } from "lucide-react"
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
  segundaSaidaMotivo: string
  segundaSaidaObs: string
  segundaSaidaCobrarCliente: boolean
  segundaSaidaPagarPrestador: boolean
  terceiraSaida: boolean
  valorTerceiraSaida: number
  terceiraSaidaMotivo: string
  terceiraSaidaObs: string
  terceiraSaidaCobrarCliente: boolean
  terceiraSaidaPagarPrestador: boolean
  pedagioCobradoCliente: number
  reentregaCliente: number
  agendamentoCliente: number
  overbookingCliente: number
}

export interface EscalaFinanceiroResumo {
  valorBase: number
  totalAdicionais: number
  totalDescontos: number
  total: number
  totalPrestador: number
  totalCliente: number
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
  resumo = { valorBase: 0, totalAdicionais: 0, totalDescontos: 0, total: 0, totalPrestador: 0, totalCliente: 0, margem: 0, margemPercentual: undefined },
}: AlocacaoFinanceiroFieldsProps) {
  const set = (updater: (prev: EscalaFinanceiroForm) => EscalaFinanceiroForm) => {
    onFinanceiroChange(updater)
  }

  const fmt = (v: unknown) => (Number(v ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Faturamento do Cliente</h4>
          <div className="space-y-1">
            <Label className="text-xs">Valor cobrado do cliente (R$)</Label>
            <Input type="number" value={financeiro.valorCliente} onChange={e => set(f => ({ ...f, valorCliente: Number(e.target.value) }))} className="h-9 border-blue-300" />
          </div>

          <div className="pt-2 border-t border-blue-100">
            <Label className="text-[10px] font-bold text-blue-800 uppercase mb-2 block">Adicionais do Cliente</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-blue-800">Pedágio Cobrado (R$)</Label>
                <Input type="number" value={financeiro.pedagioCobradoCliente} onChange={e => set(f => ({ ...f, pedagioCobradoCliente: Number(e.target.value) }))} className="h-8 text-xs border-blue-200" placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-blue-800">Reentrega (R$)</Label>
                <Input type="number" value={financeiro.reentregaCliente} onChange={e => set(f => ({ ...f, reentregaCliente: Number(e.target.value) }))} className="h-8 text-xs border-blue-200" placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-blue-800">Agendamento (R$)</Label>
                <Input type="number" value={financeiro.agendamentoCliente} onChange={e => set(f => ({ ...f, agendamentoCliente: Number(e.target.value) }))} className="h-8 text-xs border-blue-200" placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-blue-800">Overbooking (R$)</Label>
                <Input type="number" value={financeiro.overbookingCliente} onChange={e => set(f => ({ ...f, overbookingCliente: Number(e.target.value) }))} className="h-8 text-xs border-blue-200" placeholder="0,00" />
              </div>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Repasse do Prestador</h4>
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

          <div className="pt-2 border-t border-slate-100">
            <Label className="text-[10px] font-bold text-slate-800 uppercase mb-2 block">Adicionais e Descontos do Prestador</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-600">Combustível (R$)</Label>
                <Input type="number" value={financeiro.combustivel} onChange={e => set(f => ({ ...f, combustivel: Number(e.target.value) }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-600">Pedágio / Reembolso (R$)</Label>
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
              <div className="bg-white border rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Label className="text-[10px] font-bold">2ª Saída</Label>
                    <span className="text-[9px] text-slate-400">Adicionar valor fixo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={financeiro.segundaSaida} onCheckedChange={v => set(f => ({ ...f, segundaSaida: v }))} />
                    <Input type="number" value={financeiro.valorSegundaSaida} onChange={e => set(f => ({ ...f, valorSegundaSaida: Number(e.target.value) }))} disabled={!financeiro.segundaSaida} className="w-16 h-8 text-xs" />
                  </div>
                </div>
                {financeiro.segundaSaida && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <Input type="text" placeholder="Motivo" value={financeiro.segundaSaidaMotivo} onChange={e => set(f => ({ ...f, segundaSaidaMotivo: e.target.value }))} className="h-7 text-xs" />
                    <Input type="text" placeholder="Observação curta" value={financeiro.segundaSaidaObs} onChange={e => set(f => ({ ...f, segundaSaidaObs: e.target.value }))} className="h-7 text-xs" />
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <Switch checked={financeiro.segundaSaidaCobrarCliente} onCheckedChange={v => set(f => ({ ...f, segundaSaidaCobrarCliente: v }))} className="scale-75" />
                        <Label className="text-[9px] text-slate-500">Cobrar do cliente</Label>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <Switch checked={financeiro.segundaSaidaPagarPrestador} onCheckedChange={v => set(f => ({ ...f, segundaSaidaPagarPrestador: v }))} className="scale-75" />
                        <Label className="text-[9px] text-slate-500">Pagar ao prestador</Label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Label className="text-[10px] font-bold">3ª Saída</Label>
                    <span className="text-[9px] text-slate-400">Adicionar valor fixo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={financeiro.terceiraSaida} onCheckedChange={v => set(f => ({ ...f, terceiraSaida: v }))} />
                    <Input type="number" value={financeiro.valorTerceiraSaida} onChange={e => set(f => ({ ...f, valorTerceiraSaida: Number(e.target.value) }))} disabled={!financeiro.terceiraSaida} className="w-16 h-8 text-xs" />
                  </div>
                </div>
                {financeiro.terceiraSaida && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <Input type="text" placeholder="Motivo" value={financeiro.terceiraSaidaMotivo} onChange={e => set(f => ({ ...f, terceiraSaidaMotivo: e.target.value }))} className="h-7 text-xs" />
                    <Input type="text" placeholder="Observação curta" value={financeiro.terceiraSaidaObs} onChange={e => set(f => ({ ...f, terceiraSaidaObs: e.target.value }))} className="h-7 text-xs" />
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <Switch checked={financeiro.terceiraSaidaCobrarCliente} onCheckedChange={v => set(f => ({ ...f, terceiraSaidaCobrarCliente: v }))} className="scale-75" />
                        <Label className="text-[9px] text-slate-500">Cobrar do cliente</Label>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <Switch checked={financeiro.terceiraSaidaPagarPrestador} onCheckedChange={v => set(f => ({ ...f, terceiraSaidaPagarPrestador: v }))} className="scale-75" />
                        <Label className="text-[9px] text-slate-500">Pagar ao prestador</Label>
                      </div>
                    </div>
                  </div>
                )}
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
              <span className="text-blue-700 font-bold">Faturamento do Cliente:</span>
              <span className="font-bold text-blue-700">R$ {fmt(resumo.totalCliente ?? resumo.total)}</span>
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
              <p className="text-[10px] font-bold text-slate-400 uppercase">Resultado da Operação</p>
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
