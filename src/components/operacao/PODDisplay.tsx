import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Camera, User, FileText, Calendar, MapPin, CheckCircle2, Loader2, ExternalLink, AlertTriangle } from "lucide-react";

interface PODData {
  nome_recebedor: string;
  documento_recebedor?: string;
  observacao?: string;
  foto_entrega_url?: string;
  foto_canhoto_url?: string;
  assinatura_url?: string;
  data_hora_entrega?: string;
  status?: string;
}

interface Props {
  alocacaoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PODDisplay({ alocacaoId, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [pod, setPod] = useState<PODData | null>(null);
  const [alocacao, setAlocacao] = useState<any>(null);

  useEffect(() => {
    if (!open || !alocacaoId) return;
    setLoading(true);
    setPod(null);
    setAlocacao(null);

    (async () => {
      const { data: alocData, error: alocErr } = await supabase
        .from("alocacoes_escala")
        .select("*")
        .eq("id", alocacaoId)
        .maybeSingle();

      if (alocErr) {
        console.error("[PODDisplay] Erro ao buscar alocação:", alocErr.message);
        setLoading(false);
        return;
      }

      if (!alocData) {
        setLoading(false);
        return;
      }

      setAlocacao(alocData);
      const meta = (alocData as any).metadata || {};
      const podMeta: PODData | undefined = meta.pod;

      if (podMeta) {
        setPod(podMeta);
      } else {
        const { data: protocolo } = await supabase
          .from("entregas_protocolo")
          .select("*")
          .eq("alocacao_id", alocacaoId)
          .maybeSingle();

        if (protocolo) {
          setPod({
            nome_recebedor: (protocolo as any).nome_recebedor || "",
            documento_recebedor: (protocolo as any).documento_recebedor || undefined,
            observacao: (protocolo as any).observacao || (alocData as any).observacoes || "",
            foto_entrega_url: (protocolo as any).foto_entrega_url || undefined,
            foto_canhoto_url: (protocolo as any).foto_canhoto_url || undefined,
            assinatura_url: (protocolo as any).assinatura_url || undefined,
            data_hora_entrega: (protocolo as any).data_hora_entrega || (alocData as any).data_finalizacao || "",
            status: (protocolo as any).status || "entregue",
          });
        } else {
          setPod({
            nome_recebedor: "",
            observacao: (alocData as any).observacoes || "",
            data_hora_entrega: (alocData as any).data_finalizacao || "",
            status: "entregue",
          });
        }
      }
      setLoading(false);
    })();
  }, [open, alocacaoId]);

  const podData = pod;
  if (!podData) return null;

  const fotos = [
    { url: podData.foto_canhoto_url, label: "Canhoto/Comprovante" },
    { url: podData.foto_entrega_url, label: "Foto da Entrega" },
    { url: podData.assinatura_url, label: "Assinatura" },
  ].filter(f => f.url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-orange-600" />
            Protocolo de Entrega
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2 text-green-600 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              <span>{(podData.status || "entregue").toUpperCase()}</span>
            </div>

            {/* Recebedor */}
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-bold text-sm">
                    {podData.nome_recebedor || "Não informado"}
                  </p>
                  {podData.documento_recebedor && (
                    <p className="text-xs text-muted-foreground">
                      Documento: {podData.documento_recebedor}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Data/Hora */}
            {podData.data_hora_entrega && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>
                  {new Date(podData.data_hora_entrega).toLocaleString("pt-BR")}
                </span>
              </div>
            )}

            {/* KM */}
            {alocacao && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>KM inicial: {alocacao.metadata?.km_inicial || "—"} / KM final: {alocacao.km_realizados || "—"}</span>
              </div>
            )}

            {/* Observação */}
            {podData.observacao && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Observação:</p>
                <p className="text-sm">{podData.observacao}</p>
              </div>
            )}

            {/* Fotos */}
            {fotos.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Fotos
                </p>
                {fotos.map((foto, i) => (
                  <div key={i}>
                    <p className="text-xs text-muted-foreground mb-1">{foto.label}</p>
                    <a href={foto.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={foto.url}
                        alt={foto.label}
                        className="w-full h-40 object-cover rounded-lg border cursor-pointer hover:opacity-80"
                      />
                    </a>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
