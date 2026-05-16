import { useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Truck, Star, Heart, Clock, FileText, Award, User, ChevronRight, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTalentBankStore, type TalentoLogistico } from "@/stores/talentBankStore";

const NIVEL_CORES = { diamante: "text-cyan-500", ouro: "text-yellow-500", prata: "text-slate-400", bronze: "text-amber-700" };
const NIVEL_BGS = { diamante: "bg-cyan-50 border-cyan-200 dark:bg-cyan-950/20", ouro: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20", prata: "bg-slate-100 border-slate-200", bronze: "bg-amber-100 border-amber-200" };
const TAG_COLORS = ["bg-blue-100 text-blue-700 border-blue-200", "bg-purple-100 text-purple-700 border-purple-200", "bg-green-100 text-green-700 border-green-200", "bg-pink-100 text-pink-700 border-pink-200"];

export default function TalentList({ onSelectProfile }: { onSelectProfile: () => void }) {
  const { talentos, filtros, modoExibicao, setModoExibicao, setTalentoAtivo, toggleFavorito, talentoAtivo } = useTalentBankStore();

  const filtrados = useMemo(() => {
    return talentos
      .filter((t) => {
        if (filtros.busca) {
          const q = filtros.busca.toLowerCase();
          if (!t.nome.toLowerCase().includes(q) && !t.cpf.includes(q) && !t.veiculo.placa.toLowerCase().includes(q) && !t.telefone.includes(q)) return false;
        }
        if (filtros.regioes.length && !filtros.regioes.some((r) => t.regioesAtuacao.includes(r))) return false;
        if (filtros.cidades.length && !filtros.cidades.includes(t.cidade)) return false;
        if (filtros.tiposVeiculo.length && !filtros.tiposVeiculo.includes(t.veiculo.tipo)) return false;
        if (filtros.perfisOperacionais.length && !filtros.perfisOperacionais.some((p) => t.perfisOperacionais.includes(p))) return false;
        if (filtros.cargasPreferidas.length && !filtros.cargasPreferidas.some((c) => t.cargaPreferida.includes(c))) return false;
        if (filtros.statusDocumental.length && !filtros.statusDocumental.includes(t.statusDocumental)) return false;
        if (filtros.scoreMin !== null && t.score < filtros.scoreMin) return false;
        if (filtros.scoreMax !== null && t.score > filtros.scoreMax) return false;
        if (filtros.disponivel !== null && t.disponivel !== filtros.disponivel) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = filtros.ordem === "desc" ? -1 : 1;
        if (filtros.ordenarPor === "score") return (a.score - b.score) * dir;
        if (filtros.ordenarPor === "experiencia") return (a.experienciaAnos - b.experienciaAnos) * dir;
        if (filtros.ordenarPor === "taxaAceite") return (a.taxaAceite - b.taxaAceite) * dir;
        if (filtros.ordenarPor === "receita") return (a.receitaMediaMes - b.receitaMediaMes) * dir;
        if (filtros.ordenarPor === "compatibilidade") return (a.scoreCompatibilidade - b.scoreCompatibilidade) * dir;
        return (new Date(a.dataCadastro).getTime() - new Date(b.dataCadastro).getTime()) * dir;
      });
  }, [talentos, filtros]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{filtrados.length}</span> talentos encontrados
        </p>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button onClick={() => setModoExibicao("grid")} className={cn("w-7 h-7 rounded flex items-center justify-center", modoExibicao === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setModoExibicao("list")} className={cn("w-7 h-7 rounded flex items-center justify-center", modoExibicao === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filtrados.length === 0 ? (
          <div className="text-center py-16">
            <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum talento encontrado</p>
            <p className="text-xs text-muted-foreground/60">Tente ajustar os filtros</p>
          </div>
        ) : modoExibicao === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtrados.map((t) => (
              <TalentCard key={t.id} talento={t} isActive={talentoAtivo === t.id} onSelect={() => { setTalentoAtivo(t.id); onSelectProfile(); }} onToggleFav={() => toggleFavorito(t.id)} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((t) => (
              <TalentRow key={t.id} talento={t} isActive={talentoAtivo === t.id} onSelect={() => { setTalentoAtivo(t.id); onSelectProfile(); }} onToggleFav={() => toggleFavorito(t.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TalentCard({ talento: t, isActive, onSelect, onToggleFav }: { talento: TalentoLogistico; isActive: boolean; onSelect: () => void; onToggleFav: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("p-4 rounded-xl border transition-all cursor-pointer", isActive ? "border-primary ring-1 ring-primary/30 bg-primary/[0.02]" : "border-border bg-card hover:border-primary/30 hover:shadow-sm")} onClick={onSelect}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted ring-2 ring-primary/10">
              <img src={t.foto} alt="" className="w-full h-full object-cover" />
            </div>
            <div className={cn("absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background", t.disponivel ? "bg-green-500" : "bg-muted-foreground")} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t.nome}</p>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {t.cidade}, {t.estado}
            </div>
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggleFav(); }} className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors", t.favorito ? "text-red-500 bg-red-50 dark:bg-red-950/20" : "text-muted-foreground hover:bg-muted")}>
          <Heart className={cn("w-3.5 h-3.5", t.favorito && "fill-current")} />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-medium border", NIVEL_BGS[t.nivel])}>{t.nivel.toUpperCase()}</span>
        <span className={cn("text-sm font-bold", NIVEL_CORES[t.nivel])}>{t.score}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{t.veiculo.tipo}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <Metric value={`${t.experienciaAnos}a`} label="Exp." />
        <Metric value={`${t.taxaAceite}%`} label="Aceite" />
        <Metric value={t.totalViagens.toString()} label="Viagens" />
      </div>

      <div className="flex flex-wrap gap-1">
        {t.tagsAutomaticas.map((tag) => (
          <span key={tag} className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-primary/5 text-primary border border-primary/10">{tag.replace("_", " ")}</span>
        ))}
        {t.tagsPersonalizadas.map((tag, i) => (
          <span key={tag} className={cn("px-1.5 py-0.5 rounded text-[8px] font-medium border", TAG_COLORS[i % TAG_COLORS.length])}>{tag}</span>
        ))}
      </div>
    </motion.div>
  );
}

function TalentRow({ talento: t, isActive, onSelect, onToggleFav }: { talento: TalentoLogistico; isActive: boolean; onSelect: () => void; onToggleFav: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer", isActive ? "border-primary bg-primary/[0.02]" : "border-border bg-card hover:border-primary/30")} onClick={onSelect}>
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted">
          <img src={t.foto} alt="" className="w-full h-full object-cover" />
        </div>
        <div className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-background", t.disponivel ? "bg-green-500" : "bg-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-5 gap-2 items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{t.nome}</p>
          <p className="text-[10px] text-muted-foreground truncate">{t.cidade}, {t.estado}</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold" style={{ color: t.nivel === "diamante" ? "#06b6d4" : t.nivel === "ouro" ? "#f59e0b" : t.nivel === "prata" ? "#94a3b8" : "#cd7f32" }}>{t.score}</p>
          <p className="text-[9px] uppercase text-muted-foreground">{t.nivel}</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{t.veiculo.tipo}</p>
          <p className="text-[9px] text-muted-foreground">{t.veiculo.modelo.split(" ").slice(0, 2).join(" ")}</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{t.experienciaAnos}a</p>
          <p className="text-[9px] text-muted-foreground">{t.taxaAceite}% aceite</p>
        </div>
        <div className="text-right flex items-center justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); onToggleFav(); }} className={cn("w-7 h-7 rounded-lg flex items-center justify-center", t.favorito ? "text-red-500" : "text-muted-foreground hover:bg-muted")}>
            <Heart className={cn("w-3.5 h-3.5", t.favorito && "fill-current")} />
          </button>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-1.5 rounded-lg bg-muted/50">
      <p className="text-xs font-bold text-foreground">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
