import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Banknote, QrCode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import UploadZone from "./UploadZone";
import DocumentValidation from "./DocumentValidation";
import { useOnboardingStore } from "./onboardingStore";

export default function StepDocuments() {
  const {
    crlvUrl, comprovanteUrl, anttUrl, moppUrl, seguroUrl,
    chavePix, banco,
    updateField, setFile, setDocumentValidation,
  } = useOnboardingStore();

  const [, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let error = "";
    switch (field) {
      case "crlvUrl":
        if (!value) error = "CRLV é obrigatório";
        break;
      case "comprovanteUrl":
        if (!value) error = "Comprovante é obrigatório";
        break;
      case "chavePix":
        if (!value.trim()) error = "Chave PIX é obrigatória";
        break;
      case "banco":
        if (!value.trim()) error = "Banco é obrigatório";
        break;
    }
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <FileText className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Documentos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Envie seus documentos digitalizados
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <Label className="mb-2 block">CRLV</Label>
          <UploadZone
            value={crlvUrl}
            onChange={(url) => {
              setFile("crlvUrl", url);
              setTouched((prev) => ({ ...prev, crlvUrl: true }));
            }}
            onRemove={() => setFile("crlvUrl", "")}
            label="CRLV do veículo"
            capture="environment"
            aspectRatio="landscape"
          />
          <div className="mt-2">
            <DocumentValidation
              documentType="crlv"
              imageUrl={crlvUrl}
              onValidated={(r) => setDocumentValidation("crlv", { approved: r.validation.isValid, confidence: r.validation.confidence })}
              compact
            />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Comprovante de Residência</Label>
          <UploadZone
            value={comprovanteUrl}
            onChange={(url) => {
              setFile("comprovanteUrl", url);
              setTouched((prev) => ({ ...prev, comprovanteUrl: true }));
            }}
            onRemove={() => setFile("comprovanteUrl", "")}
            label="Conta de água, luz ou telefone"
            capture="environment"
            aspectRatio="landscape"
          />
          <div className="mt-2">
            <DocumentValidation
              documentType="comprovante"
              imageUrl={comprovanteUrl}
              onValidated={(r) => setDocumentValidation("comprovante", { approved: r.validation.isValid, confidence: r.validation.confidence })}
              compact
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-2 block">ANTT</Label>
            <UploadZone
              value={anttUrl}
              onChange={(url) => setFile("anttUrl", url)}
              onRemove={() => setFile("anttUrl", "")}
              label="Registro ANTT"
              capture="environment"
              aspectRatio="portrait"
            />
            <div className="mt-2">
              <DocumentValidation
                documentType="antt"
                imageUrl={anttUrl}
                onValidated={(r) => setDocumentValidation("antt", { approved: r.validation.isValid, confidence: r.validation.confidence })}
                compact
              />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">MOPP</Label>
            <UploadZone
              value={moppUrl}
              onChange={(url) => setFile("moppUrl", url)}
              onRemove={() => setFile("moppUrl", "")}
              label="Curso MOPP"
              capture="environment"
              aspectRatio="portrait"
            />
            <div className="mt-2">
              <DocumentValidation
                documentType="mopp"
                imageUrl={moppUrl}
                onValidated={(r) => setDocumentValidation("mopp", { approved: r.validation.isValid, confidence: r.validation.confidence })}
                compact
              />
            </div>
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Seguro da Carga</Label>
          <UploadZone
            value={seguroUrl}
            onChange={(url) => setFile("seguroUrl", url)}
            onRemove={() => setFile("seguroUrl", "")}
            label="Apolice de seguro"
            capture="environment"
            aspectRatio="landscape"
          />
          <div className="mt-2">
            <DocumentValidation
              documentType="seguro"
              imageUrl={seguroUrl}
              onValidated={(r) => setDocumentValidation("seguro", { approved: r.validation.isValid, confidence: r.validation.confidence })}
              compact
            />
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <div className="flex items-center gap-2 mb-4">
            <Banknote className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Dados Bancários</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="banco">Banco</Label>
              <Input
                id="banco"
                placeholder="Ex: Nubank, Itaú, Bradesco"
                value={banco}
                onChange={(e) => updateField("banco", e.target.value)}
                onBlur={() => handleBlur("banco", banco)}
                className={`h-12 text-base ${
                  touched.banco && !banco ? "border-destructive" : ""
                }`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chavePix">Chave PIX</Label>
              <Input
                id="chavePix"
                placeholder="CPF, telefone, email ou chave aleatória"
                value={chavePix}
                onChange={(e) => updateField("chavePix", e.target.value)}
                onBlur={() => handleBlur("chavePix", chavePix)}
                className={`h-12 text-base ${
                  touched.chavePix && !chavePix ? "border-destructive" : ""
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
