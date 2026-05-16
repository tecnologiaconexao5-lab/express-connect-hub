import { motion } from "framer-motion";
import { Search, X, Sliders, RotateCcw, Truck, MapPin, Star, Clock, FileText, Bike, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTalentBankStore, type PerfilOperacional, type StatusDocumental } from "@/stores/talentBankStore";

interface AdvancedFiltersProps {
  onClose: () => void;
}

const REGIOES = ["Grande SP", "ABC Paulista", "Interior SP", "Litoral SP", "Rio de Janeiro", "Belo Horizonte", "Paraná", "Santa Catarina", "Rio Grande do Sul"];
const VEICULOS = ["Fiorino/Van", "VUC", "Truck", "Bitrem", "Carreta", "Rodotrom"];
const PERFIS: { value: PerfilOperacional; label: string; icon: typeof Truck }[] = [
  { value: "urbano", label: "Urbano", icon: Bike },
  { value: "leve", label: "Leve", icon: Bike },
  { value: "pesado", label: "Pesado", icon: Truck },
  { value: "emergencia", label: "Emergência", icon: Clock },
  { value: "rota_fixa", label: "Rota Fixa", icon: MapPin },
  { value: "coleta", label: "Coleta", icon: Truck },
  { value: "viagem", label: "Viagem", icon: MapPin },
];
const CARGAS = ["Carga Seca", "Carga Refrigerada", "Carga Perigosa", "Alimentos", "Eletrônicos", "Mudanças", "Documentos"];
const STATUS_DOC: StatusDocumental[] = ["completo", "parcial", "pendente", "expirado"];

export default function AdvancedFilters({ onClose }: AdvancedFiltersProps) {
  const { filtros, atualizarFiltros, limparFiltros, talentos } = useTalentBankStore();

  const cidades = [...new Set(talentos.map((t) => t.cidade))];
  const bairros = [...new Set(talentos.map((t) => t.bairro))];

  const set = (data: Partial<typeof filtros>) => atualizarFiltros(data);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Filtros</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={limparFiltros} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
            <RotateCcw className="w-3 h-3" /> Limpar
          </button>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={filtros.busca} onChange={(e) => set({ busca: e.target.value })} placeholder="Nome, CPF, placa, telefone..." className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <Section title="Região">
          <div className="flex flex-wrap gap-1.5">
            {REGIOES.map((r) => (
              <Chip key={r} selected={filtros.regioes.includes(r)} onClick={() => set({ regioes: filtros.regioes.includes(r) ? filtros.regioes.filter((x) => x !== r) : [...filtros.regioes, r] })}>
                {r}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Cidade">
          <div className="flex flex-wrap gap-1.5">
            {cidades.map((c) => (
              <Chip key={c} selected={filtros.cidades.includes(c)} onClick={() => set({ cidades: filtros.cidades.includes(c) ? filtros.cidades.filter((x) => x !== c) : [...filtros.cidades, c] })}>
                {c}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Tipo de Veículo">
          <div className="flex flex-wrap gap-1.5">
            {VEICULOS.map((v) => (
              <Chip key={v} selected={filtros.tiposVeiculo.includes(v)} onClick={() => set({ tiposVeiculo: filtros.tiposVeiculo.includes(v) ? filtros.tiposVeiculo.filter((x) => x !== v) : [...filtros.tiposVeiculo, v] })}>
                {v}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Perfil Operacional">
          <div className="flex flex-wrap gap-1.5">
            {PERFIS.map((p) => (
              <Chip key={p.value} selected={filtros.perfisOperacionais.includes(p.value)} onClick={() => set({ perfisOperacionais: filtros.perfisOperacionais.includes(p.value) ? filtros.perfisOperacionais.filter((x) => x !== p.value) : [...filtros.perfisOperacionais, p.value] })}>
                {p.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Tipo de Carga">
          <div className="flex flex-wrap gap-1.5">
            {CARGAS.map((c) => (
              <Chip key={c} selected={filtros.cargasPreferidas.includes(c)} onClick={() => set({ cargasPreferidas: filtros.cargasPreferidas.includes(c) ? filtros.cargasPreferidas.filter((x) => x !== c) : [...filtros.cargasPreferidas, c] })}>
                {c}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Score">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} value={filtros.scoreMin} onChange={(e) => set({ scoreMin: parseInt(e.target.value) })} className="flex-1 accent-primary" />
              <span className="text-xs font-medium text-foreground w-8 text-right">{filtros.scoreMin}</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} value={filtros.scoreMax} onChange={(e) => set({ scoreMax: parseInt(e.target.value) })} className="flex-1 accent-primary" />
              <span className="text-xs font-medium text-foreground w-8 text-right">{filtros.scoreMax}</span>
            </div>
          </div>
        </Section>

        <Section title="Status Documental">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_DOC.map((s) => (
              <Chip key={s} selected={filtros.statusDocumental.includes(s)} onClick={() => set({ statusDocumental: filtros.statusDocumental.includes(s) ? filtros.statusDocumental.filter((x) => x !== s) : [...filtros.statusDocumental, s] })}>
                {s === "completo" ? "Completo" : s === "parcial" ? "Parcial" : s === "pendente" ? "Pendente" : "Expirado"}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Disponibilidade">
          <div className="flex gap-1.5">
            <Chip selected={filtros.disponivel === true} onClick={() => set({ disponivel: filtros.disponivel === true ? null : true })}>Disponível</Chip>
            <Chip selected={filtros.disponivel === false} onClick={() => set({ disponivel: filtros.disponivel === false ? null : false })}>Indisponível</Chip>
          </div>
        </Section>

        <Section title="Ordenar por">
          <select value={filtros.ordenarPor} onChange={(e) => set({ ordenarPor: e.target.value as typeof filtros.ordenarPor })} className="w-full h-9 rounded-lg border border-border bg-background text-xs text-foreground px-2 focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="score">Score</option>
            <option value="experiencia">Experiência</option>
            <option value="taxaAceite">Taxa de Aceite</option>
            <option value="receita">Receita</option>
            <option value="compatibilidade">Compatibilidade</option>
            <option value="data">Data de Cadastro</option>
          </select>
          <div className="flex gap-1.5 mt-1">
            <Chip selected={filtros.ordem === "desc"} onClick={() => set({ ordem: "desc" })}>Decrescente</Chip>
            <Chip selected={filtros.ordem === "asc"} onClick={() => set({ ordem: "asc" })}>Crescente</Chip>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("px-2 py-1 rounded-full text-[10px] font-medium border transition-all whitespace-nowrap", selected ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/40")}>
      {children}
    </button>
  );
}
