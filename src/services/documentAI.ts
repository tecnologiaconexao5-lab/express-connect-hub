import { createWorker, type Worker } from "tesseract.js";

export type DocumentType = "cnh" | "crlv" | "comprovante" | "antt" | "mopp" | "seguro" | "selfie";

export interface ExtractedData {
  nome?: string;
  cpf?: string;
  rg?: string;
  dataNascimento?: string;
  validade?: string;
  placa?: string;
  categoria?: string;
  observacoes?: string;
  registro?: string;
  valor?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
}

export interface DocumentValidation {
  isValid: boolean;
  isExpired: boolean;
  quality: "baixa" | "media" | "alta";
  warnings: string[];
  errors: string[];
  confidence: number;
}

export interface DocumentAnalysisResult {
  documentType: DocumentType;
  success: boolean;
  extractedData: ExtractedData;
  validation: DocumentValidation;
  rawText?: string;
  processedAt: string;
}

const DOCUMENT_PATTERNS = {
  cpf: /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/g,
  placa: /[A-Z]{3}[-\s]?\d[A-Z0-9][-\s]?\d{2}/g,
  data: /(\d{2}[/-]\d{2}[/-]\d{2,4})/g,
  nome: /(?:NOME|NOME CONDUTOR|NOME DO CONDUTOR)[:\s]*([A-ZÀ-Ú\s]+)/i,
  categoria: /(?:CAT|CATEGORIA|CAT\.)[:\s]*([A-E][ABE]?)/i,
  validade: /(?:VAL|VALIDADE|VÁLIDO ATÉ|DATA DE VALIDADE)[:\s]*(\d{2}[/-]\d{2}[/-]\d{4})/i,
  registro: /(?:REG|REGISTRO|N[°º]?\s*REGISTRO)[:\s]*(\d+)/i,
};

function extractWithRegex(text: string, patterns: typeof DOCUMENT_PATTERNS): ExtractedData {
  const data: ExtractedData = {};

  const cpfMatch = text.match(patterns.cpf);
  if (cpfMatch) data.cpf = cpfMatch[0];

  const placaMatch = text.match(patterns.placa);
  if (placaMatch) data.placa = placaMatch[0];

  const nomeMatch = text.match(patterns.nome);
  if (nomeMatch) data.nome = nomeMatch[1].trim();

  const catMatch = text.match(patterns.categoria);
  if (catMatch) data.categoria = catMatch[1].trim();

  const valMatch = text.match(patterns.validade);
  if (valMatch) data.validade = valMatch[1];

  const regMatch = text.match(patterns.registro);
  if (regMatch) data.registro = regMatch[1];

  const dates = text.match(patterns.data);
  if (dates && !data.validade) {
    data.dataNascimento = dates[0];
  }

  return data;
}

function validateDocument(
  data: ExtractedData,
  documentType: DocumentType,
  text: string,
): DocumentValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  let confidence = 50;

  if (text.length < 20) {
    warnings.push("Texto extraído muito curto, qualidade pode estar baixa");
    confidence = 20;
  }

  if (text.length > 100) confidence = 60;
  if (text.length > 300) confidence = 75;

  if (data.cpf) {
    const cleaned = data.cpf.replace(/\D/g, "");
    if (cleaned.length === 11) {
      confidence = Math.min(confidence + 15, 95);
    } else {
      warnings.push("CPF com formato inválido");
    }
  } else {
    warnings.push("CPF não encontrado no documento");
  }

  if (data.nome) {
    confidence = Math.min(confidence + 10, 95);
  } else {
    warnings.push("Nome não encontrado no documento");
  }

  if (data.validade) {
    const parts = data.validade.split(/[/-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      let year = parseInt(parts[2]);
      if (year < 100) year += 2000;
      const expiry = new Date(year, month - 1, day);
      const now = new Date();
      if (expiry < now) {
        errors.push("Documento vencido");
      } else {
        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 30) {
          warnings.push(`Documento vence em ${daysUntilExpiry} dias`);
        }
      }
    }
  } else {
    if (documentType !== "comprovante" && documentType !== "seguro") {
      warnings.push("Validade não encontrada");
    }
  }

  switch (documentType) {
    case "cnh":
      if (data.categoria) {
        confidence = Math.min(confidence + 10, 95);
      } else {
        warnings.push("Categoria da CNH não identificada");
      }
      if (!data.dataNascimento && !data.nome) {
        errors.push("Documento não parece ser uma CNH válida");
      }
      break;

    case "crlv":
      if (data.placa) {
        confidence = Math.min(confidence + 15, 95);
      } else {
        errors.push("Placa não encontrada no CRLV");
      }
      break;

    case "antt":
      if (data.registro) {
        confidence = Math.min(confidence + 15, 95);
      } else {
        warnings.push("Número de registro ANTT não encontrado");
      }
      break;
  }

  let quality: "baixa" | "media" | "alta" = "media";
  if (confidence >= 80) quality = "alta";
  else if (confidence < 40) quality = "baixa";

  const isExpired = errors.some((e) => e.includes("vencido"));

  return {
    isValid: errors.length === 0 && confidence >= 30,
    isExpired,
    quality,
    warnings,
    errors,
    confidence: Math.min(Math.round(confidence), 99),
  };
}

let workerInstance: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerInstance) {
    const worker = await createWorker("por");
    workerInstance = worker;
  }
  return workerInstance;
}

export async function analyzeDocument(
  imageDataUrl: string,
  documentType: DocumentType,
): Promise<DocumentAnalysisResult> {
  const processedAt = new Date().toISOString();

  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(imageDataUrl);

    const text = data.text || "";
    const extracted = extractWithRegex(text, DOCUMENT_PATTERNS);

    if (!extracted.nome && text.length > 20) {
      const lines = text.split("\n").filter((l) => l.trim().length > 3);
      const nameCandidate = lines.find(
        (l) => /^[A-ZÀ-Ú\s]{5,}$/.test(l.trim()) && !l.includes(".") && !/\d/.test(l),
      );
      if (nameCandidate) extracted.nome = nameCandidate.trim();
    }

    const validation = validateDocument(extracted, documentType, text);

    const result: DocumentAnalysisResult = {
      documentType,
      success: validation.isValid || validation.confidence >= 30,
      extractedData: extracted,
      validation,
      rawText: text.slice(0, 500),
      processedAt,
    };

    return result;
  } catch (err) {
    console.warn("OCR error, using smart extraction:", err);

    const extracted: ExtractedData = {};
    const validation: DocumentValidation = {
      isValid: false,
      isExpired: false,
      quality: "baixa",
      warnings: ["OCR indisponível, extração limitada"],
      errors: ["Não foi possível processar a imagem"],
      confidence: 15,
    };

    return {
      documentType,
      success: false,
      extractedData: extracted,
      validation,
      processedAt,
    };
  }
}

export function getDocumentLabel(type: DocumentType): string {
  const map: Record<DocumentType, string> = {
    cnh: "CNH",
    crlv: "CRLV",
    comprovante: "Comprovante de Residência",
    antt: "ANTT",
    mopp: "MOPP",
    seguro: "Seguro da Carga",
    selfie: "Selfie",
  };
  return map[type];
}

export function autoApprove(result: DocumentAnalysisResult): {
  approved: boolean;
  autoApproved: boolean;
  reason: string;
} {
  if (result.validation.quality === "baixa") {
    return {
      approved: false,
      autoApproved: false,
      reason: "Qualidade da imagem muito baixa. Solicite nova foto.",
    };
  }

  if (result.validation.isExpired) {
    return {
      approved: false,
      autoApproved: false,
      reason: "Documento vencido. Solicite atualização.",
    };
  }

  if (result.validation.errors.length > 0 && result.validation.confidence < 50) {
    return {
      approved: false,
      autoApproved: false,
      reason: "Dados não conferem. Encaminhar para análise manual.",
    };
  }

  if (result.validation.confidence >= 80 && result.validation.isValid) {
    return {
      approved: true,
      autoApproved: true,
      reason: "Documento validado automaticamente com alta confiança.",
    };
  }

  if (result.validation.confidence >= 50 && result.validation.isValid) {
    return {
      approved: true,
      autoApproved: false,
      reason: "Pré-aprovado automaticamente. Aguardando confirmação manual.",
    };
  }

  return {
    approved: false,
    autoApproved: false,
    reason: "Não foi possível validar o documento. Encaminhar para análise manual.",
  };
}
