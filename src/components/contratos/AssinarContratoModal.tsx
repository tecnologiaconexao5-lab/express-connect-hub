import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Check, FileSignature, AlertTriangle, Smartphone, Globe, Clock, Loader2 } from "lucide-react";
import { registrarAssinatura } from "@/services/contratosService";
import { toast } from "sonner";

interface AssinarContratoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratoId: string;
  prestadorNome?: string;
  onSuccess?: () => void;
}

export function AssinarContratoModal({
  open,
  onOpenChange,
  contratoId,
  prestadorNome,
  onSuccess,
}: AssinarContratoModalProps) {
  const [assinatura, setAssinatura] = useState("");
  const [nomeConfirmado, setNomeConfirmado] = useState("");
  const [cpfConfirmado, setCpfConfirmado] = useState("");
  const [loading, setLoading] = useState(false);
  const [navegador, setNavegador] = useState("");
  const [ip, setIp] = useState("");
  const [geo, setGeo] = useState("");

  useEffect(() => {
    if (open) {
      setAssinatura("");
      setNomeConfirmado("");
      setCpfConfirmado("");
      setNavegador(navigator.userAgent);
      fetch('https://api.ipify.org?format=json')
        .then(r => r.json())
        .then(d => setIp(d.ip))
        .catch(() => setIp('0.0.0.0'));
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setGeo(`${pos.coords.latitude},${pos.coords.longitude}`),
          () => setGeo('')
        );
      }
    }
  }, [open]);

  const handleConfirmar = async () => {
    if (!assinatura.trim()) {
      toast.error("Assinatura obrigatória", { description: "Por favor, digite sua assinatura" });
      return;
    }
    if (!nomeConfirmado.trim()) {
      toast.error("Nome obrigatório", { description: "Por favor, confirme seu nome completo" });
      return;
    }
    if (!cpfConfirmado.trim()) {
      toast.error("CPF obrigatório", { description: "Por favor, confirme seu CPF" });
      return;
    }

    setLoading(true);
    try {
      const sucesso = await registrarAssinatura(
        contratoId,
        assinatura,
        nomeConfirmado,
        cpfConfirmado
      );

      if (sucesso) {
        toast.success("Contrato assinado com sucesso!", { description: "Assinatura eletrônica registrada com todos os dados de auditoria." });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast.error("Erro ao assinar", { description: "Não foi possível registrar a assinatura. Tente novamente." });
      }
    } catch (error) {
      console.error("[AssinarContrato] Erro:", error);
      toast.error("Erro ao processar assinatura");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-[#F97316]" />
            Assinatura Eletrônica
          </DialogTitle>
          <DialogDescription>
            Confirme os dados abaixo para registrar sua assinatura eletrônica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-bold">Aviso Legal</p>
                <p>A assinatura eletrônica possui valor jurídico conforme MP 2.200-2/2001 e Lei 11.419/2006.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-bold">Assinatura *</Label>
            <Textarea
              placeholder="Digite sua assinatura (nome completo) ou desenhe..."
              className="min-h-[100px] font-signature"
              value={assinatura}
              onChange={(e) => setAssinatura(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-bold">Nome Completo *</Label>
            <Input
              placeholder={prestadorNome || "Seu nome completo"}
              value={nomeConfirmado}
              onChange={(e) => setNomeConfirmado(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-bold">CPF *</Label>
            <Input
              placeholder="000.000.000-00"
              value={cpfConfirmado}
              onChange={(e) => setCpfConfirmado(e.target.value)}
            />
          </div>

          <Card className="bg-slate-50">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Smartphone className="w-3 h-3" />
                <span>Navegador: {navegador || "Detectando..."}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Globe className="w-3 h-3" />
                <span>IP: {ip || "Detectando..."}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Clock className="w-3 h-3" />
                <span>Data: {new Date().toLocaleString("pt-BR")}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-[#F97316] hover:bg-[#EA580C]"
            onClick={handleConfirmar}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Assinando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Confirmar Assinatura
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}