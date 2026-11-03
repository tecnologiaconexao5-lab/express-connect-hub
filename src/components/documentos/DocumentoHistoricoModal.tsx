import { useEffect, useState } from "react";
import { History, Loader2, FileText, CheckCircle2, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  listarVersoesDocumento,
  STATUS_IA_CLASSE,
  STATUS_IA_LABEL,
  type DocumentoMetadata,
} from "@/services/documentos/documentosMetadataService";
import { formatarDataHoraBR } from "@/lib/formatDates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: DocumentoMetadata | null;
}

export function DocumentoHistoricoModal({ open, onOpenChange, documento }: Props) {
  const [versoes, setVersoes] = useState<DocumentoMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !documento?.id) return;
    let ativo = true;
    setLoading(true);
    listarVersoesDocumento(documento.id)
      .then((lista) => { if (ativo) setVersoes(lista); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [open, documento?.id]);

  const eventos = [...(documento?.historico || [])].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Histórico do Documento
          </DialogTitle>
          <DialogDescription>{documento?.nome || documento?.tipo || "Documento"}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
          </div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <FileText className="h-4 w-4" /> Versões
              </h3>
              {versoes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/50 p-3 text-sm text-muted-foreground">
                  Nenhuma versão registrada.
                </p>
              ) : (
                <div className="space-y-2">
                  {versoes.map((versao) => (
                    <div
                      key={versao.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{versao.versao}</Badge>
                        <span className="text-sm font-medium">{versao.nome || versao.tipo || "Documento"}</span>
                        {versao.ativo && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Atual</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_IA_CLASSE[versao.status_ia]}`}>
                          {STATUS_IA_LABEL[versao.status_ia]}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatarDataHoraBR(versao.data_inclusao)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-4 w-4" /> Ações registradas
              </h3>
              {eventos.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/50 p-3 text-sm text-muted-foreground">
                  Nenhum evento registrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {eventos.map((evento, idx) => (
                    <div key={evento.id || idx} className="flex items-start gap-3 rounded-lg border border-border/40 p-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{evento.descricao}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {evento.tipo.replace(/_/g, " ")} · {formatarDataHoraBR(evento.data)}
                          {evento.usuario ? ` · ${evento.usuario}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
