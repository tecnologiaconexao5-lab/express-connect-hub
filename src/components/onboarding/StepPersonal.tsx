import { useState } from "react";
import { motion } from "framer-motion";
import { User, Fingerprint, Calendar, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import UploadZone from "./UploadZone";
import DocumentValidation from "./DocumentValidation";
import { useOnboardingStore } from "./onboardingStore";

export default function StepPersonal() {
  const {
    nome, cpf, rg, dataNascimento, selfieUrl, cnhUrl,
    updateField, setFile, setDocumentValidation,
  } = useOnboardingStore();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateCPF = (v: string) => {
    const cleaned = v.replace(/\D/g, "");
    if (cleaned.length !== 11) return "CPF deve ter 11 dígitos";
    return "";
  };

  const validateRG = (v: string) => {
    if (v && v.replace(/\D/g, "").length < 7) return "RG inválido";
    return "";
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let error = "";

    switch (field) {
      case "nome":
        if (!nome.trim()) error = "Nome é obrigatório";
        break;
      case "cpf":
        if (!cpf.trim()) error = "CPF é obrigatório";
        else error = validateCPF(cpf);
        break;
      case "dataNascimento":
        if (!dataNascimento) error = "Data de nascimento é obrigatória";
        break;
      case "selfieUrl":
        if (!selfieUrl) error = "Selfie é obrigatória";
        break;
      case "cnhUrl":
        if (!cnhUrl) error = "Foto da CNH é obrigatória";
        break;
    }

    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const formatCPF = (v: string) => {
    const cleaned = v.replace(/\D/g, "").slice(0, 11);
    return cleaned
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatRG = (v: string) => {
    const cleaned = v.replace(/\D/g, "").slice(0, 9);
    return cleaned
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1})$/, "$1-$2");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <User className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Dados Pessoais</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Suas informações para cadastro
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome Completo</Label>
          <Input
            id="nome"
            placeholder="Seu nome completo"
            value={nome}
            onChange={(e) => updateField("nome", e.target.value)}
            onBlur={() => handleBlur("nome")}
            className={`h-12 text-base ${
              touched.nome && errors.nome ? "border-destructive ring-destructive/30" : ""
            }`}
          />
          {touched.nome && errors.nome && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive">
              {errors.nome}
            </motion.p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => updateField("cpf", formatCPF(e.target.value))}
              onBlur={() => handleBlur("cpf")}
              className={`h-12 text-base ${
                touched.cpf && errors.cpf ? "border-destructive ring-destructive/30" : ""
              }`}
            />
            {touched.cpf && errors.cpf && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive">
                {errors.cpf}
              </motion.p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rg">RG</Label>
            <Input
              id="rg"
              placeholder="00.000.000-0"
              value={rg}
              onChange={(e) => updateField("rg", formatRG(e.target.value))}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, rg: true }));
                const err = validateRG(rg);
                setErrors((prev) => ({ ...prev, rg: err }));
              }}
              className="h-12 text-base"
            />
            {touched.rg && errors.rg && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive">
                {errors.rg}
              </motion.p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dataNascimento">Data de Nascimento</Label>
          <Input
            id="dataNascimento"
            type="date"
            value={dataNascimento}
            onChange={(e) => updateField("dataNascimento", e.target.value)}
            onBlur={() => handleBlur("dataNascimento")}
            className={`h-12 text-base ${
              touched.dataNascimento && errors.dataNascimento ? "border-destructive ring-destructive/30" : ""
            }`}
          />
          {touched.dataNascimento && errors.dataNascimento && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive">
              {errors.dataNascimento}
            </motion.p>
          )}
        </div>

        <div>
          <Label className="mb-2 block">Selfie</Label>
          <UploadZone
            value={selfieUrl}
            onChange={(url) => {
              setFile("selfieUrl", url);
              setTouched((prev) => ({ ...prev, selfieUrl: true }));
              setErrors((prev) => ({ ...prev, selfieUrl: "" }));
            }}
            onRemove={() => {
              setFile("selfieUrl", "");
              setErrors((prev) => ({ ...prev, selfieUrl: "Selfie é obrigatória" }));
            }}
            label="Tire sua selfie"
            capture="user"
            aspectRatio="square"
          />
          {touched.selfieUrl && errors.selfieUrl && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive mt-1">
              {errors.selfieUrl}
            </motion.p>
          )}
        </div>

        <div>
          <Label className="mb-2 block">Foto da CNH</Label>
          <UploadZone
            value={cnhUrl}
            onChange={(url) => {
              setFile("cnhUrl", url);
              setTouched((prev) => ({ ...prev, cnhUrl: true }));
              setErrors((prev) => ({ ...prev, cnhUrl: "" }));
            }}
            onRemove={() => {
              setFile("cnhUrl", "");
              setErrors((prev) => ({ ...prev, cnhUrl: "Foto da CNH é obrigatória" }));
            }}
            label="Foto da CNH (frente)"
            capture="environment"
            aspectRatio="landscape"
          />
          {touched.cnhUrl && errors.cnhUrl && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive mt-1">
              {errors.cnhUrl}
            </motion.p>
          )}
          <div className="mt-2">
            <DocumentValidation
              documentType="cnh"
              imageUrl={cnhUrl}
              onValidated={(r) => setDocumentValidation("cnh", { approved: r.validation.isValid, confidence: r.validation.confidence })}
              compact
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
