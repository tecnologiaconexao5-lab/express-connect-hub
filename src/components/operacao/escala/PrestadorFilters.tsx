import { Search, Filter, Truck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { SearchableSelect } from "@/components/ui/SearchableSelect"

interface PrestadorFiltersProps {
  filtroNome: string
  onFiltroNomeChange: (v: string) => void
  filtroVeiculo: string
  onFiltroVeiculoChange: (v: string) => void
  filtroStatus: string
  onFiltroStatusChange: (v: string) => void
  opcoesVeiculo: [string, string][]
  filtroPrestadorEscalaId: string | null
  onFiltroPrestadorEscalaChange: (id: string | null, nome: string) => void
  filtroClienteEscalaId: string | null
  onFiltroClienteEscalaChange: (id: string | null, nome: string) => void
}

export function PrestadorFilters({
  filtroNome,
  onFiltroNomeChange,
  filtroVeiculo,
  onFiltroVeiculoChange,
  filtroStatus,
  onFiltroStatusChange,
  opcoesVeiculo,
  filtroPrestadorEscalaId,
  onFiltroPrestadorEscalaChange,
  filtroClienteEscalaId,
  onFiltroClienteEscalaChange,
}: PrestadorFiltersProps) {
  return (
    <div className="p-4 border-b border-border bg-muted/30 escala-header">
      <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
        <Truck className="w-5 h-5 text-primary" /> Prestadores Homologados
      </h3>

      {/* Filtro por Prestador na Escala */}
      <div className="mb-2">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
          Filtrar Programação por Prestador
        </label>
        <SearchableSelect
          table="prestadores"
          labelField="nome_completo"
          searchFields={["nome_completo", "cpf_cnpj"]}
          value={filtroPrestadorEscalaId}
          onChange={(id, record) => {
            onFiltroPrestadorEscalaChange(id, record?.nome_completo || "");
          }}
          placeholder="Prestador na programação..."
        />
      </div>

      {/* Filtro por Cliente na Escala */}
      <div className="mb-3">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
          Filtrar Programação por Cliente
        </label>
        <SearchableSelect
          table="clientes"
          labelField="nome_fantasia"
          searchFields={["nome_fantasia", "razao_social"]}
          value={filtroClienteEscalaId}
          onChange={(id, record) => {
            onFiltroClienteEscalaChange(id, record?.nome_fantasia || "");
          }}
          placeholder="Cliente na programação..."
        />
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
        <Input
          placeholder="Buscar por placa ou nome..."
          className="pl-9 text-xs h-9"
          value={filtroNome}
          onChange={(e) => onFiltroNomeChange(e.target.value)}
        />
        <div className="flex flex-col gap-2 mt-3">
          <Select value={filtroVeiculo} onValueChange={onFiltroVeiculoChange}>
            <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {opcoesVeiculo.map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Select value={filtroStatus} onValueChange={onFiltroStatusChange}>
              <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="disponivel">Disponivel</SelectItem>
                <SelectItem value="ocupado">Ocupado</SelectItem>
                <SelectItem value="indisponivel">Indisponivel</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 px-2"><Filter className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  )
}
