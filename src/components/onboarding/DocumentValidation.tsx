import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle,
  Clock, Scan, Shield, FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  enqueueDocument, getDocumentStatus, subscribe,
  type QueueStatus,
} from "@/services/documentQueue";
import {
  analyzeDocument,
  type DocumentType,
  type DocumentAnalysisResult,
  getDocumentLabel,
} from "@/services/documentAI";

interface DocumentValidationProps {
  documentType: DocumentType;
  imageUrl: string | null;
  onValidated?: (result: DocumentAnalysisResult) => void;
  compact?: boolean;
}

export default function DocumentValidation({
  documentType,
  imageUrl,
  onValidated,
  compact,
}: DocumentValidationProps) {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [result, setResult] = useState<DocumentAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setStatus(null);
      setResult(null);
      return;
    }

    const existing = getDocumentStatus(documentType);
    if (existing) {
      setStatus(existing.status);
      setResult(existing.result);
      return;
    }

    const runAnalysis = async () => {
      setAnalyzing(true);
      setStatus("processing");
      try {
        const res = await analyzeDocument(imageUrl, documentType);
        setResult(res);
        const valid = res.validation.isValid && res.validation.confidence >= 30;
        setStatus(valid ? "completed" : "failed");
        if (onValidated) onValidated(res);

        enqueueDocument(imageUrl, documentType, res);
      } catch {
        setStatus("failed");
      } finally {
        setAnalyzing(false);
      }
    };

    runAnalysis();
  }, [imageUrl, documentType]);

  useEffect(() => {
    const unsub = subscribe(() => {
      const current = getDocumentStatus(documentType);
      if (current) {
        setStatus(current.status);
        if (current.result) setResult(current.result);
      }
    });
    return unsub;
  }, [documentType]);

  if (!imageUrl) return null;

  const label = getDocumentLabel(documentType);
  const isComplete = status === "completed" || status === "blocked";
  const isProcessing = status === "processing" || analyzing;
  const isFailed = status === "failed";

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs border",
          isComplete && result?.validation.isValid && "bg-green-50 border-green-200 text-green-700",
          isComplete && !result?.validation.isValid && "bg-red-50 border-red-200 text-red-700",
          isProcessing && "bg-blue-50 border-blue-200 text-blue-700",
          isFailed && "bg-amber-50 border-amber-200 text-amber-700",
        )}
      >
        {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
        {isComplete && result?.validation.isValid && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
        {isComplete && !result?.validation.isValid && <XCircle className="w-3.5 h-3.5 shrink-0" />}
        {isFailed && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
        <span className="font-medium">{label}</span>
        {isComplete && result && (
          <span className="ml-auto">
            {result.validation.confidence}%
          </span>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          isProcessing && "bg-blue-100",
          isComplete && result?.validation.isValid && "bg-green-100",
          isComplete && !result?.validation.isValid && "bg-red-100",
          isFailed && "bg-amber-100",
        )}>
          {isProcessing && <Scan className="w-5 h-5 text-blue-600" />}
          {isComplete && result?.validation.isValid && <CheckCircle2 className="w-5 h-5 text-green-600" />}
          {isComplete && !result?.validation.isValid && <XCircle className="w-5 h-5 text-red-600" />}
          {isFailed && <AlertTriangle className="w-5 h-5 text-amber-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            {isProcessing && "Analisando documento..."}
            {isComplete && result?.validation.isValid && "Documento validado"}
            {isComplete && !result?.validation.isValid && "Documento com pendências"}
            {isFailed && "Falha na análise"}
          </p>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            OCR
          </div>
        )}
        {isComplete && result && (
          <div className="text-right">
            <span className={cn(
              "text-sm font-bold",
              result.validation.confidence >= 80 && "text-green-600",
              result.validation.confidence >= 50 && result.validation.confidence < 80 && "text-amber-600",
              result.validation.confidence < 50 && "text-red-600",
            )}>
              {result.validation.confidence}%
            </span>
            <p className="text-[10px] text-muted-foreground">confiança</p>
          </div>
        )}
      </div>

      {result && (
        <div className="p-4 space-y-3">
          {result.extractedData.cpf && (
            <DataRow icon={Shield} label="CPF" value={result.extractedData.cpf} />
          )}
          {result.extractedData.nome && (
            <DataRow icon={Shield} label="Nome" value={result.extractedData.nome} />
          )}
          {result.extractedData.placa && (
            <DataRow icon={Shield} label="Placa" value={result.extractedData.placa} />
          )}
          {result.extractedData.categoria && (
            <DataRow icon={Shield} label="Categoria" value={result.extractedData.categoria} />
          )}
          {result.extractedData.validade && (
            <DataRow
              icon={Clock}
              label="Validade"
              value={result.extractedData.validade}
              warn={result.validation.isExpired}
            />
          )}
          {result.extractedData.registro && (
            <DataRow icon={Shield} label="Registro" value={result.extractedData.registro} />
          )}

          <AnimatePresence>
            {result.validation.warnings.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-1"
              >
                {result.validation.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {result.validation.errors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-1"
              >
                {result.validation.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-red-600">
                    <XCircle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{e}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {result.validation.quality === "baixa" && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              <FileWarning className="w-3.5 h-3.5 shrink-0" />
              Qualidade da imagem baixa — recomendamos enviar uma foto mais nítida
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function DataRow({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 text-sm",
      warn && "text-red-600",
    )}>
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground text-xs">{label}:</span>
      <span className={cn("font-medium text-foreground text-xs", warn && "text-red-600 line-through")}>
        {value}
      </span>
    </div>
  );
}
