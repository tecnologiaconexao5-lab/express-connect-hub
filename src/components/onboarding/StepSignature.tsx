import { motion } from "framer-motion";
import { FileSignature, Shield, FileText, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import SignaturePad from "./SignaturePad";
import { useOnboardingStore } from "./onboardingStore";

export default function StepSignature() {
  const {
    aceiteLGPD, aceiteContrato, aceiteResponsabilidade, assinaturaDataUrl,
    updateField, setFile,
  } = useOnboardingStore();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <FileSignature className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Assinatura Digital</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Aceite os termos e assine digitalmente
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30">
            <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-sm font-semibold">LGPD — Proteção de Dados</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Autorizo o tratamento dos meus dados pessoais conforme a Lei Geral de
                  Proteção de Dados (LGPD) para fins de cadastro, comunicação e
                  prestação de serviços.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lgpd"
                  checked={aceiteLGPD}
                  onCheckedChange={(v) => updateField("aceiteLGPD", v)}
                />
                <Label htmlFor="lgpd" className="text-sm cursor-pointer">
                  Aceito os termos da LGPD
                </Label>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30">
            <FileText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-sm font-semibold">Contrato de Prestação de Serviços</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Declaro que li e concordo com os termos e condições do contrato de
                  prestação de serviços de transporte, incluindo cláusulas de
                  responsabilidade, prazos e remuneração.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="contrato"
                  checked={aceiteContrato}
                  onCheckedChange={(v) => updateField("aceiteContrato", v)}
                />
                <Label htmlFor="contrato" className="text-sm cursor-pointer">
                  Aceito o contrato de prestação de serviços
                </Label>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30">
            <AlertTriangle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-sm font-semibold">Termo de Responsabilidade</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Assumo total responsabilidade pela veracidade das informações
                  prestadas, pela documentação apresentada e pela condução segura
                  do veículo durante as operações.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="responsabilidade"
                  checked={aceiteResponsabilidade}
                  onCheckedChange={(v) => updateField("aceiteResponsabilidade", v)}
                />
                <Label htmlFor="responsabilidade" className="text-sm cursor-pointer">
                  Aceito o termo de responsabilidade
                </Label>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">Assinatura Digital</Label>
          </div>
          <SignaturePad
            value={assinaturaDataUrl}
            onChange={(url) => setFile("assinaturaDataUrl", url)}
          />
        </div>
      </div>
    </motion.div>
  );
}
