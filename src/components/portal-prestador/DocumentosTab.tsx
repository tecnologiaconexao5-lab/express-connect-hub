import { motion } from "framer-motion";
import { FileText, Upload, CheckCircle2, XCircle, Clock, AlertTriangle, FileWarning, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalPrestadorStore, type DocumentoPrestador } from "@/stores/portalPrestadorStore";

const STATUS_DOC = {
  aprovado: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800", label: "Aprovado" },
  pendente: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800", label: "Pendente" },
  rejeitado: { icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800", label: "Rejeitado" },
  expirado: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800", label: "Expirado" },
};

export default function DocumentosTab() {
  const { documentos, adicionarDocumento } = usePortalPrestadorStore();

  const aprovados = documentos.filter((d) => d.status === "aprovado").length;
  const pendentes = documentos.filter((d) => d.status === "pendente" || d.status === "rejeitado" || d.status === "expirado").length;

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Documentos</h1>
        <p className="text-sm text-muted-foreground">{aprovados} aprovados · {pendentes} pendentes</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Aprovados", value: aprovados, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
          { label: "Pendentes", value: pendentes, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20" },
          { label: "Total", value: documentos.length, color: "text-primary", bg: "bg-primary/5" },
        ].map((s) => (
          <div key={s.label} className={cn("p-3 rounded-xl text-center", s.bg)}>
            <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {documentos.map((doc, i) => (
          <DocumentoCard key={doc.id} doc={doc} index={i} />
        ))}
      </div>

      <motion.button whileTap={{ scale: 0.97 }} className="w-full p-4 rounded-2xl border-2 border-dashed border-border flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
        <Plus className="w-5 h-5" />
        <span className="text-sm font-medium">Adicionar documento</span>
      </motion.button>
    </div>
  );
}

function DocumentoCard({ doc, index }: { doc: DocumentoPrestador; index: number }) {
  const config = STATUS_DOC[doc.status];
  const Icon = config.icon;

  const diasRestantes = doc.dataVencimento ? Math.ceil((new Date(doc.dataVencimento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-4 rounded-2xl border border-border bg-card"
    >
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", config.bg)}>
          <FileText className={cn("w-5 h-5", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{doc.tipo}</p>
            <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", config.bg)}>
              <Icon className="w-3 h-3" />
              {config.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{doc.nome}</p>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span>Envio: {new Date(doc.dataEnvio).toLocaleDateString("pt-BR")}</span>
            {doc.dataVencimento && (
              <span className={cn(diasRestantes !== null && diasRestantes < 30 ? "text-red-600" : "")}>
                Vence: {new Date(doc.dataVencimento).toLocaleDateString("pt-BR")}
                {diasRestantes !== null && diasRestantes < 30 && ` (${diasRestantes}d)`}
              </span>
            )}
          </div>
          {doc.observacao && (
            <div className="flex items-start gap-1.5 mt-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg p-2">
              <FileWarning className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{doc.observacao}</span>
            </div>
          )}
        </div>
      </div>

      {doc.status === "pendente" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: "60%" }} className="h-full rounded-full bg-amber-500" />
        </motion.div>
      )}
    </motion.div>
  );
}
