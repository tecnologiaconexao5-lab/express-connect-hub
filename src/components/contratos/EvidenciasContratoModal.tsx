import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileSignature, Smartphone, Globe, Clock, CheckCircle, XCircle, 
  Copy, Download, Send, AlertTriangle, History, Hash, Phone, Mail 
} from "lucide-react";
import { buscarContratoPorId, buscarHistoricoContrato, type ContratoGerado, type ContratoHistorico } from "@/services/contratosService";
import { useToast } from "@/hooks/use-toast";

interface EvidenciasContratoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratoId: string;
}

const statusCores: Record<string, string> = {
  pendente: "bg-slate-100 text-slate-600",
  enviado: "bg-blue-100 text-blue-600",
  aceito_whatsapp: "bg-green-100 text-green-600",
  assinado: "bg-emerald-100 text-emerald-600",
  recusado: "bg-red-100 text-red-600",
  cancelado: "bg-red-100 text-red-600",
};

export function EvidenciasContratoModal({
  open,
  onOpenChange,
  contratoId,
}: EvidenciasContratoModalProps) {
  const { toast } = useToast();
  const [contrato, setContrato] = useState<ContratoGerado | null>(null);
  const [historico, setHistorico] = useState<ContratoHistorico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && contratoId) {
      setLoading(true);
      Promise.all([
        buscarContratoPorId(contratoId),
        buscarHistoricoContrato(contratoId),
      ])
        .then(([c, h]) => {
          setContrato(c);
          setHistorico(h);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, contratoId]);

  const handleCopiar = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto);
    toast({ title: "Copiado!", description: `${label} copiado para área de transferência` });
  };

  const handleCopiarHash = () => {
    if (contrato?.hash_documento) {
      handleCopiar(contrato.hash_documento, "Hash");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#F97316]" />
            Evidências do Contrato
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316]" />
          </div>
        ) : contrato ? (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#64748B]">Status</span>
              <Badge className={statusCores[contrato.status] || "bg-slate-100"}>
                {contrato.status || "pendente"}
              </Badge>
            </div>

            {/* Hash do Documento */}
            <Card className="bg-slate-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Hash SHA-256
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono break-all flex-1">
                    {contrato.hash_documento || "Não gerado"}
                  </code>
                  <Button size="sm" variant="ghost" onClick={handleCopiarHash}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Aceite WhatsApp */}
            {contrato.aceite_whatsapp && (
              <Card className="bg-green-50 border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    Aceite via WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-green-600" />
                    <span>Tel: {contrato.aceite_whatsapp_numero || "Não informado"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-green-600" />
                    <span>Data: {contrato.aceite_whatsapp_data ? new Date(contrato.aceite_whatsapp_data).toLocaleString("pt-BR") : "Não informada"}</span>
                  </div>
                  {contrato.aceite_whatsapp_mensagem && (
                    <div className="p-2 bg-white rounded text-xs">
                      "{contrato.aceite_whatsapp_mensagem}"
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Assinatura Eletrônica */}
            {contrato.assinatura_eletronica && (
              <Card className="bg-emerald-50 border-emerald-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
                    <FileSignature className="w-4 h-4" />
                    Assinatura Eletrônica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3 h-3 text-emerald-600" />
                    <span>IP: {contrato.assinatura_ip || "Não registrado"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-3 h-3 text-emerald-600" />
                    <span>Navegador: {contrato.assinatura_navegador ? "Detectado" : "Não registrado"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    <span>Data: {contrato.assinatura_data ? new Date(contrato.assinatura_data).toLocaleString("pt-BR") : "Não registrada"}</span>
                  </div>
                  {contrato.assinatura_geolocalizacao && (
                    <div className="text-xs text-emerald-600">
                      Localização: {contrato.assinatura_geolocalizacao}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Histórico */}
            <div>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                <History className="w-4 h-4" />
                Histórico Jurídico
              </h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {historico.length > 0 ? (
                  historico.map((h, idx) => (
                    <div key={h.id || idx} className="flex items-start gap-2 p-2 bg-slate-50 rounded text-xs">
                      <div className="w-2 h-2 rounded-full bg-[#F97316] mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-bold">{h.acao}</p>
                        {h.descricao && <p className="text-slate-600">{h.descricao}</p>}
                        <p className="text-[10px] text-slate-400">
                          {h.created_at ? new Date(h.created_at).toLocaleString("pt-BR") : ""}
                          {h.ip && ` • IP: ${h.ip}`}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Nenhum histórico registrado.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            Contrato não encontrado.
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}