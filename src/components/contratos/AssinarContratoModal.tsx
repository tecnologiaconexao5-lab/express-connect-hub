import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Check, FileSignature, AlertTriangle, Smartphone, Globe, Clock, Loader2, ExternalLink, Pen } from "lucide-react";
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
  const [usarAutentique, setUsarAutentique] = useState(true);
  const [navegador, setNavegador] = useState("");
  const [ip, setIp] = useState("");
  const [geo, setGeo] = useState("");

  useEffect(() => {
    if (open) {
      setAssinatura("");
      setNomeConfirmado("");
      setCpfConfirmado("");
      setUsarAutentique(true);
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

  const handleAbrirAutentique = () => {
    const url = `https://app.autentique.com.br/contrato/${contratoId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.success("Redirecionando para Autentique", { description: "Finalize a assinatura no ambiente seguro do Autentique." });
    onOpenChange(false);
  };

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
        toast.success("Registro de ciência salvo!", { description: "Para validade jurídica completa, utilize o Autentique." });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast.error("Erro ao registrar", { description: "Não foi possível registrar. Tente novamente." });
      }
    } catch (error) {
      console.error("[AssinarContrato] Erro:", error);
      toast.error("Erro ao processar");
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
            Assinatura de Contrato
          </DialogTitle>
          <DialogDescription>
            Este contrato deve ser assinado no Autentique, nossa plataforma oficial de assinatura digital.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-primary mt-0.5" />
              <div className="space-y-2">
                <p className="font-bold text-sm">Assinar via Autentique (recomendado)</p>
                <p className="text-xs text-muted-foreground">Assinatura digital com validade jurídica. Contrato TAC, aditivos e documentos oficiais.</p>
                <Button size="sm" className="gap-2" onClick={handleAbrirAutentique}>
                  <ExternalLink className="w-4 h-4" />
                  Abrir Autentique
                </Button>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou registro de ciência</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-bold">Atenção</p>
                <p>O registro abaixo é apenas uma declaração de ciência. Para contratos TAC, aditivos e documentos jurídicos, use o Autentique acima.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-bold flex items-center gap-1.5">
              <Pen className="w-3.5 h-3.5 text-muted-foreground" />
              Assinatura (ciência)
            </Label>
            <Textarea
              placeholder="Digite seu nome completo"
              className="min-h-[80px] font-signature"
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
                Registrando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Registrar Ciência
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}