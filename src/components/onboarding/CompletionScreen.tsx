import { motion } from "framer-motion";
import { CheckCircle2, Truck, Clock, MapPin, User, FileText } from "lucide-react";
import { useOnboardingStore } from "./onboardingStore";

export default function CompletionScreen() {
  const { nome, tipoVeiculo, placa, regioes, submittedAt } = useOnboardingStore();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-full py-8 px-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6"
      >
        <CheckCircle2 className="w-12 h-12 text-green-500" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-2xl font-bold text-foreground text-center"
      >
        Cadastro Completo!
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-muted-foreground text-center mt-2 mb-8 max-w-sm"
      >
        Recebemos seu cadastro com sucesso. Nossa equipe vai analisar seus documentos
        e entrará em contato em até 48 horas.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-sm space-y-3 mb-8"
      >
        <div className="p-4 rounded-xl bg-muted/50 border border-border flex items-center gap-3">
          <User className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Prestador</p>
            <p className="text-sm font-medium text-foreground">{nome}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border border-border flex items-center gap-3">
          <Truck className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Veículo</p>
            <p className="text-sm font-medium text-foreground">
              {tipoVeiculo} — {placa}
            </p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border border-border flex items-center gap-3">
          <MapPin className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Regiões</p>
            <p className="text-sm font-medium text-foreground">
              {regioes.slice(0, 2).join(", ")}
              {regioes.length > 2 && ` +${regioes.length - 2}`}
            </p>
          </div>
        </div>
        {submittedAt && (
          <div className="p-4 rounded-xl bg-muted/50 border border-border flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Enviado em</p>
              <p className="text-sm font-medium text-foreground">
                {new Date(submittedAt).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-center"
      >
        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
          <FileText className="w-3 h-3" />
          Seus documentos estão seguros e serão analisados.
        </p>
      </motion.div>
    </motion.div>
  );
}
