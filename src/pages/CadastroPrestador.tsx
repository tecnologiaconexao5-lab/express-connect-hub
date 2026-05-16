import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Truck, FileText, Map, FileSignature,
  ChevronLeft, ChevronRight, Sparkles, RotateCcw,
  Loader2, CheckCircle2, AlertCircle, Brain, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useOnboardingStore } from "@/components/onboarding/onboardingStore";
import StepPersonal from "@/components/onboarding/StepPersonal";
import StepVehicle from "@/components/onboarding/StepVehicle";
import StepDocuments from "@/components/onboarding/StepDocuments";
import StepAvailability from "@/components/onboarding/StepAvailability";
import StepSignature from "@/components/onboarding/StepSignature";
import CompletionScreen from "@/components/onboarding/CompletionScreen";
import AIDashboard from "@/components/onboarding/AIDashboard";

const STEP_CONFIG = [
  { icon: User, label: "Dados Pessoais", component: StepPersonal },
  { icon: Truck, label: "Veículo", component: StepVehicle },
  { icon: FileText, label: "Documentos", component: StepDocuments },
  { icon: Map, label: "Disponibilidade", component: StepAvailability },
  { icon: FileSignature, label: "Assinatura", component: StepSignature },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

export default function CadastroPrestador() {
  const store = useOnboardingStore();
  const {
    currentStep, isComplete, submittedAt,
    nome, cpf, selfieUrl, cnhUrl,
    tipoVeiculo, modelo, placa, ano, capacidade, fotosVeiculo,
    crlvUrl, comprovanteUrl, chavePix, banco,
    regioes, tipoCarga, tipoViagem,
    aceiteLGPD, aceiteContrato, aceiteResponsabilidade, assinaturaDataUrl,
    showAIDashboard,
    nextStep, prevStep, submitComplete, reset, toggleAIDashboard,
  } = store;

  const [direction, setDirection] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    const unsub = useOnboardingStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useOnboardingStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return () => unsub();
  }, []);

  useEffect(() => {
    if (hydrated && currentStep > 0 && !isComplete) {
      setShowResume(true);
    }
  }, [hydrated, currentStep, isComplete]);

  const validateStep = useCallback((): string[] => {
    const errors: string[] = [];
    switch (currentStep) {
      case 0:
        if (!nome.trim()) errors.push("Nome completo é obrigatório");
        if (!cpf.trim()) errors.push("CPF é obrigatório");
        else if (cpf.replace(/\D/g, "").length !== 11) errors.push("CPF inválido");
        if (!selfieUrl) errors.push("Selfie é obrigatória");
        if (!cnhUrl) errors.push("Foto da CNH é obrigatória");
        break;
      case 1:
        if (!tipoVeiculo) errors.push("Tipo de veículo é obrigatório");
        if (!modelo.trim()) errors.push("Modelo é obrigatório");
        if (!placa.trim()) errors.push("Placa é obrigatória");
        if (!ano) errors.push("Ano é obrigatório");
        if (!capacidade) errors.push("Capacidade é obrigatória");
        if (fotosVeiculo.length === 0) errors.push("Adicione ao menos 1 foto do veículo");
        break;
      case 2:
        if (!crlvUrl) errors.push("CRLV é obrigatório");
        if (!comprovanteUrl) errors.push("Comprovante de residência é obrigatório");
        if (!chavePix.trim()) errors.push("Chave PIX é obrigatória");
        if (!banco.trim()) errors.push("Banco é obrigatório");
        break;
      case 3:
        if (regioes.length === 0) errors.push("Selecione ao menos 1 região");
        if (!tipoCarga) errors.push("Selecione o tipo de carga");
        if (tipoViagem.length === 0) errors.push("Selecione ao menos 1 tipo de viagem");
        break;
      case 4:
        if (!aceiteLGPD) errors.push("Aceite os termos da LGPD");
        if (!aceiteContrato) errors.push("Aceite o contrato de prestação de serviços");
        if (!aceiteResponsabilidade) errors.push("Aceite o termo de responsabilidade");
        if (!assinaturaDataUrl) errors.push("Assine digitalmente");
        break;
    }
    return errors;
  }, [currentStep, nome, cpf, selfieUrl, cnhUrl, tipoVeiculo, modelo, placa, ano, capacidade, fotosVeiculo, crlvUrl, comprovanteUrl, chavePix, banco, regioes, tipoCarga, tipoViagem, aceiteLGPD, aceiteContrato, aceiteResponsabilidade, assinaturaDataUrl]);

  const handleNext = useCallback(() => {
    const errors = validateStep();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setDirection(1);
    nextStep();
  }, [validateStep, nextStep]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    setValidationErrors([]);
    prevStep();
  }, [prevStep]);

  const handleSubmit = useCallback(async () => {
    const errors = validateStep();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("candidatos").insert([{
        nome_completo: nome,
        cpf: cpf.replace(/\D/g, ""),
        telefone: "",
        whatsapp: "",
        email: "",
        tipo_veiculo: tipoVeiculo,
        placa,
        regiao: regioes.join(", "),
        tipo_carroceria: tipoCarga,
        mensagem_livre: `Modelo: ${modelo}, Ano: ${ano}, Capacidade: ${capacidade}`,
        canal_captacao: "onboarding_app",
        status: "interessado",
      }]);

      if (error) throw error;

      submitComplete();
      toast.success("Cadastro concluído com sucesso!", {
        description: "Analisaremos seus documentos e entraremos em contato.",
      });
    } catch (err) {
      console.error("Erro ao enviar:", err);
      toast.error("Erro ao enviar cadastro. Seu rascunho foi salvo.", {
        description: "Tente novamente mais tarde.",
      });
    } finally {
      setSubmitting(false);
    }
  }, [nome, cpf, tipoVeiculo, placa, regioes, tipoCarga, modelo, ano, capacidade, validateStep, submitComplete]);

  const handleResumeContinue = () => {
    setShowResume(false);
  };

  const handleResumeRestart = () => {
    reset();
    setShowResume(false);
    setDirection(0);
  };

  if (isComplete && submittedAt) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <CompletionScreen />
        </div>
      </div>
    );
  }

  if (showResume && hydrated) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Continuar Cadastro</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Você tem um cadastro em andamento. Deseja continuar de onde parou?
            </p>
          </div>

          <div className="space-y-3 mb-8">
            <div className="p-4 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Progresso</span>
                <span className="text-sm font-medium text-foreground">
                  {Math.round((currentStep / 4) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentStep / 4) * 100}%` }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-1">
              {STEP_CONFIG.map((s, i) => (
                <div key={i} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                      i < currentStep
                        ? "bg-primary text-primary-foreground"
                        : i === currentStep
                        ? "bg-primary/20 text-primary border-2 border-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < currentStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  {i < 4 && (
                    <div className={`w-6 h-0.5 ${i < currentStep ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground pt-2">
              Etapa {currentStep + 1} de 5 — {STEP_CONFIG[currentStep].label}
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleResumeContinue}
              className="w-full h-12 text-base gap-2 rounded-xl"
            >
              Continuar Cadastro
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              onClick={handleResumeRestart}
              className="w-full h-12 text-base gap-2 rounded-xl"
            >
              <RotateCcw className="w-5 h-5" />
              Recomeçar do Início
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const StepComponent = STEP_CONFIG[currentStep]?.component;

  if (showAIDashboard) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-background to-muted/30 flex flex-col">
        <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={toggleAIDashboard}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="text-sm font-medium text-foreground">Score & IA Documental</span>
            <div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <AIDashboard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/30 flex flex-col">
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {STEP_CONFIG.map((_, i) => (
                <div key={i} className="flex items-center">
                  <motion.div
                    animate={{
                      scale: i === currentStep ? 1 : 0.85,
                      backgroundColor: i <= currentStep
                        ? "var(--primary)"
                        : "var(--muted)",
                    }}
                    className="w-2.5 h-2.5 rounded-full transition-colors"
                  />
                  {i < 4 && (
                    <motion.div
                      animate={{
                        backgroundColor: i < currentStep
                          ? "var(--primary)"
                          : "var(--muted)",
                      }}
                      className="w-6 h-0.5 mx-0.5 rounded-full"
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={toggleAIDashboard}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-all"
              title="Score & IA Documental"
            >
              <Brain className="w-4 h-4" />
            </button>
          </div>

          <div className="w-10" />
        </div>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full"
            >
              {StepComponent && <StepComponent />}
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {validationErrors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-destructive">
                    Corrija os campos abaixo:
                  </p>
                  {validationErrors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive/80">
                      {err}
                    </p>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-4 pb-2 space-y-3">
          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              className="w-full h-12 text-base gap-2 rounded-xl shadow-lg shadow-primary/20"
            >
              Continuar
              <ChevronRight className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 text-base gap-2 rounded-xl shadow-lg shadow-primary/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando cadastro...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Finalizar Cadastro
                </>
              )}
            </Button>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Seus dados estão salvos automaticamente
          </p>
        </div>
      </div>
    </div>
  );
}
