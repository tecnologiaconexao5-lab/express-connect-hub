import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Plus, Trash2, Users, Heart, TrendingUp, Award, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTalentBankStore } from "@/stores/talentBankStore";

export default function ShortlistPanel() {
  const { shortlists, talentos, adicionarShortlist, removerShortlist, removerTalentShortlist, setTalentoAtivo } = useTalentBankStore();
  const [novaShortlist, setNovaShortlist] = useState(false);
  const [nome, setNome] = useState("");
  const [desc, setDesc] = useState("");

  const handleCriar = () => {
    if (!nome.trim()) return;
    adicionarShortlist(nome.trim(), desc.trim());
    setNome("");
    setDesc("");
    setNovaShortlist(false);
  };

  return (
    <div className="p-5 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Shortlists Inteligentes</h2>
          <p className="text-sm text-muted-foreground">{shortlists.length} listas · {shortlists.reduce((a, s) => a + s.talentos.length, 0)} talentos</p>
        </div>
        <button onClick={() => setNovaShortlist(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium">
          <Plus className="w-4 h-4" /> Nova Lista
        </button>
      </div>

      {novaShortlist && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border border-primary/30 bg-primary/[0.02] space-y-3">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da shortlist" className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição (opcional)" className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <div className="flex gap-2">
            <button onClick={handleCriar} className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Criar</button>
            <button onClick={() => setNovaShortlist(false)} className="px-4 h-9 rounded-lg border border-border text-xs text-muted-foreground">Cancelar</button>
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {shortlists.map((sl) => {
          const talentosLista = talentos.filter((t) => sl.talentos.includes(t.id));
          const scoreMedio = talentosLista.length > 0 ? Math.round(talentosLista.reduce((a, t) => a + t.score, 0) / talentosLista.length) : 0;

          return (
            <motion.div key={sl.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${sl.cor}20` }}>
                    <Star className="w-5 h-5" style={{ color: sl.cor }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{sl.nome}</p>
                    <p className="text-xs text-muted-foreground">{sl.descricao}</p>
                  </div>
                </div>
                <button onClick={() => removerShortlist(sl.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-3 text-xs">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-muted-foreground" />{talentosLista.length} talentos</span>
                <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5 text-muted-foreground" />Score médio {scoreMedio}</span>
                <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />Criada em {sl.criadaEm}</span>
              </div>

              <div className="space-y-1.5">
                {talentosLista.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setTalentoAtivo(t.id)}>
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-muted shrink-0">
                      <img src={t.foto} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{t.nome}</p>
                      <p className="text-[9px] text-muted-foreground">{t.veiculo.tipo} · {t.regiao}</p>
                    </div>
                    <span className={cn("text-xs font-bold", t.nivel === "diamante" ? "text-cyan-500" : t.nivel === "ouro" ? "text-yellow-500" : t.nivel === "prata" ? "text-slate-400" : "text-amber-700")}>
                      {t.score}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); removerTalentShortlist(sl.id, t.id); }} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
