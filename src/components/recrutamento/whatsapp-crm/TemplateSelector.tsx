import { useState } from "react";
import { motion } from "framer-motion";
import { Search, FileText, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppCRMStore } from "@/stores/whatsappCRMStore";

interface TemplateSelectorProps {
  onSelect: (text: string) => void;
}

export default function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const { templates, usarTemplate } = useWhatsAppCRMStore();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const categorias = [...new Set(templates.map((t) => t.categoria))];
  const filtrados = templates.filter((t) => {
    if (catFilter && t.categoria !== catFilter) return false;
    if (search && !t.nome.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const maisUsados = [...templates].sort((a, b) => b.usos - a.usos).slice(0, 3);

  return (
    <div className="p-3 rounded-xl border border-border bg-card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-primary" />
          Templates Inteligentes
        </p>
        <div className="flex gap-1">
          {maisUsados.map((t) => (
            <button key={t.id} onClick={() => { onSelect(t.mensagem); usarTemplate(t.id); }} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">
              <Zap className="w-2.5 h-2.5" />
              {t.nome.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar templates..." className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setCatFilter(null)} className={cn("px-2 py-1 rounded-full text-[9px] font-medium whitespace-nowrap border", !catFilter ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border")}>
          Todos
        </button>
        {categorias.map((cat) => (
          <button key={cat} onClick={() => setCatFilter(cat)} className={cn("px-2 py-1 rounded-full text-[9px] font-medium whitespace-nowrap border capitalize", catFilter === cat ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border")}>
            {cat.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="space-y-1 max-h-40 overflow-y-auto">
        {filtrados.map((t) => (
          <motion.button
            key={t.id}
            onClick={() => { onSelect(t.mensagem); usarTemplate(t.id); }}
            whileTap={{ scale: 0.98 }}
            className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">{t.nome}</p>
              <span className="text-[9px] text-muted-foreground">{t.usos} usos</span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{t.mensagem.slice(0, 80)}...</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
