import { Truck, MapPin, CheckCircle, AlertTriangle } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SearchableSelect } from "@/components/ui/SearchableSelect"

interface AlocacaoSeletoresPrincipaisProps {
  prestadorId: string
  onPrestadorChange: (id: string, item?: any) => void
  prestadorVeiculo: { tipo_veiculo: string; placa: string; refrigerado: boolean } | null
  clienteId: string
  onClienteChange: (id: string, item?: any) => void
  loadingTabelaValores: boolean
  tabelaValores: { valor_base: number; valor_km: number; km_franquia: number; tipo_veiculo: string; percentual_prestador?: number; custo_prestador?: number; markup_desejavel?: number } | null
  regraEspecialAtiva: boolean
  os: string
  onOSChange: (value: string) => void
  kmInicial: number
  kmFinal: number
  onKmInicialChange: (value: number) => void
  onKmFinalChange: (value: number) => void
  tipoVeiculoLabel: Record<string, string>
}

export function AlocacaoSeletoresPrincipais({
  prestadorId,
  onPrestadorChange,
  prestadorVeiculo,
  clienteId,
  onClienteChange,
  loadingTabelaValores,
  tabelaValores,
  regraEspecialAtiva,
  os,
  onOSChange,
  kmInicial,
  kmFinal,
  onKmInicialChange,
  onKmFinalChange,
  tipoVeiculoLabel,
}: AlocacaoSeletoresPrincipaisProps) {
  const kmRodados = Math.max(kmFinal - kmInicial, 0)
  const kmFranquia = tabelaValores?.km_franquia || 200
  const valorKm = tabelaValores?.valor_km || 2.50
  const kmExcedente = Math.max(kmRodados - kmFranquia, 0)
  const totalExcedente = kmExcedente * valorKm
  const tabelaNaoConfigurada = clienteId !== "" && !regraEspecialAtiva

  return (
    <>
      <div className="space-y-1">
        <Label className="text-xs font-bold text-primary">Prestador *</Label>
        <SearchableSelect
          table="prestadores"
          labelField="nome_completo"
          searchFields={["nome_completo", "cpf_cnpj"]}
          value={prestadorId}
          onChange={onPrestadorChange}
          placeholder="Pesquisar por nome ou CPF/CNPJ..."
        />
      </div>
      {prestadorVeiculo && (
        <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-medium text-slate-700">{tipoVeiculoLabel[prestadorVeiculo.tipo_veiculo] || prestadorVeiculo.tipo_veiculo}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-medium text-slate-700">{prestadorVeiculo.placa || "Sem placa"}</span>
            </div>
            {prestadorVeiculo.refrigerado && (
              <Badge className="bg-cyan-100 text-cyan-700 text-[10px]">Refrigerado</Badge>
            )}
          </div>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs font-bold text-primary">Cliente Vinculado</Label>
        <SearchableSelect
          table="clientes"
          labelField="nome_fantasia"
          searchFields={["nome_fantasia", "razao_social"]}
          value={clienteId}
          onChange={onClienteChange}
          placeholder="Selecione o cliente para buscar tabela de preços..."
        />
      </div>
      {loadingTabelaValores && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Buscando tabela de valores...
        </div>
      )}
      {tabelaValores && (
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-emerald-800 flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3" />
              Tabela: {regraEspecialAtiva ? "Cliente" : "Universal"}
            </span>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px]">
              {regraEspecialAtiva ? "Personalizada" : "Padrão"}
            </Badge>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
            <div className="bg-white/50 rounded p-1.5 text-center">
              <span className="text-emerald-600 font-bold">Base: R$ {tabelaValores.valor_base?.toFixed(2) || "0"}</span>
            </div>
            <div className="bg-white/50 rounded p-1.5 text-center">
              <span className="text-emerald-600 font-bold">KM: R$ {tabelaValores.valor_km?.toFixed(2) || "0"}</span>
            </div>
            <div className="bg-white/50 rounded p-1.5 text-center">
              <span className="text-emerald-600 font-bold">Franquia: {tabelaValores.km_franquia || 200} km</span>
            </div>
          </div>
          {tabelaValores.percentual_prestador && tabelaValores.percentual_prestador > 0 && (
            <div className="mt-1.5 text-[10px] text-emerald-600 flex items-center gap-1">
              <span>Repasse prestador: {tabelaValores.percentual_prestador}%</span>
              {tabelaValores.markup_desejavel && (
                <span className="ml-2">| Markup desejável: {tabelaValores.markup_desejavel}%</span>
              )}
            </div>
          )}
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground italic">OS vinculada (opcional — se vazio, gera OC automática)</Label>
        <SearchableSelect
          table="ordens_servico"
          labelField="numero"
          searchFields={["numero"]}
          value={os}
          onChange={onOSChange}
          placeholder="Vincular OS ou deixar vazio para OC automática..."
        />
      </div>

      <div className="border-t pt-4 mt-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Controle de KM e Franquia</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">KM Inicial</Label>
            <Input
              type="number"
              value={kmInicial}
              onChange={(e) => onKmInicialChange(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">KM Final</Label>
            <Input
              type="number"
              value={kmFinal}
              onChange={(e) => onKmFinalChange(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2 p-3 bg-slate-50 rounded-xl border text-[11px]">
          <div className="text-center border-r">
            <p className="text-slate-500 font-medium">KM Total</p>
            <p className="font-bold text-slate-800">{kmRodados} km</p>
          </div>
          <div className="text-center border-r">
            <p className="text-slate-500 font-medium">Franquia</p>
            <p className="font-bold text-slate-800">{tabelaNaoConfigurada ? "N/C" : `${kmFranquia} km`}</p>
          </div>
          <div className="text-center border-r">
            <p className="text-slate-500 font-medium">KM Exced.</p>
            <p className="font-bold text-orange-600">{tabelaNaoConfigurada ? "-" : `${kmExcedente} km`}</p>
          </div>
          <div className="text-center border-r">
            <p className="text-slate-500 font-medium">Vlr KM Adic.</p>
            <p className="font-bold text-slate-800">{tabelaNaoConfigurada ? "-" : `R$ ${valorKm.toFixed(2)}`}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 font-medium">Total Exced.</p>
            <p className="font-bold text-green-600">{tabelaNaoConfigurada ? "-" : `R$ ${totalExcedente.toFixed(2)}`}</p>
          </div>
        </div>
      </div>
    </>
  )
}
