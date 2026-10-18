export type ModoProducao = "homologacao" | "assistido" | "producao";

const MODOS_ZOHO = ["homologacao", "assistido", "producao"] as const;
const MODOS_WHATSAPP = ["homologacao", "assistido", "producao"] as const;

export function getModoZoho(): ModoProducao {
  const raw = import.meta.env.VITE_ZOHO_MODE || "homologacao";
  if (MODOS_ZOHO.includes(raw as "homologacao" | "assistido" | "producao")) {
    return raw as ModoProducao;
  }
  return "homologacao";
}

export function getModoWhatsApp(): ModoProducao {
  const raw = import.meta.env.VITE_WHATSAPP_MODE || "homologacao";
  if (MODOS_WHATSAPP.includes(raw as "homologacao" | "assistido" | "producao")) {
    return raw as ModoProducao;
  }
  return "homologacao";
}

export function isProducaoAssistida(modo: ModoProducao): boolean {
  return modo === "assistido" || modo === "producao";
}

export function isProducaoAutonoma(modo: ModoProducao): boolean {
  return modo === "producao";
}

/** Em modo asistido, falhas viram pendente (fallback). Em producao, erros sao reais. */
export function isFallbackPermitido(modo: ModoProducao): boolean {
  return modo === "assistido";
}

export function modoParaLabel(modo: ModoProducao): string {
  switch (modo) {
    case "homologacao": return "Homologação (simulado)";
    case "assistido": return "Produção Assistida (real com fallback)";
    case "producao": return "Produção (real direto)";
  }
}

export function modoSimbolo(modo: ModoProducao): string {
  switch (modo) {
    case "homologacao": return "SIMULADO";
    case "assistido": return "ASSISTIDO";
    case "producao": return "PRODUÇÃO";
  }
}
