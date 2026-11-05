// Validação compartilhada de anexos enviados ao bucket privado
// `documentos_operacionais` (mesmos tipos e limite configurados na infraestrutura).

export const TIPOS_ANEXO_ACEITOS = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const EXTENSOES_ANEXO_ACEITAS = ".pdf,.jpg,.jpeg,.png,.webp";

export const TAMANHO_MAX_ANEXO_BYTES = 50 * 1024 * 1024;

export function validarArquivoAnexo(file: File | null | undefined): string | null {  if (!file) return "Selecione um arquivo.";
  if (file.size <= 0) return "O arquivo selecionado está vazio.";
  if (file.size > TAMANHO_MAX_ANEXO_BYTES) {
    return "Arquivo maior que 50 MB. Envie um PDF ou imagem menor.";
  }
  const tipo = String(file.type || "").toLowerCase();
  if (tipo && !(TIPOS_ANEXO_ACEITOS as readonly string[]).includes(tipo)) {
    return "Formato não suportado. Envie PDF, JPG, PNG ou WEBP.";
  }
  const nome = String(file.name || "").toLowerCase();
  const extensao = nome.includes(".") ? nome.split(".").pop() || "" : "";
  if (!tipo && !["pdf", "jpg", "jpeg", "png", "webp"].includes(extensao)) {
    return "Formato não suportado. Envie PDF, JPG, PNG ou WEBP.";
  }
  return null;
}

const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Garante um MIME type compatível com `allowed_mime_types` do bucket quando o
 * navegador não informa `file.type` (arquivos arrastados/renomeados).
 */
export function garantirTipoAnexo(file: File): File {
  if (file.type) return file;
  const extensao = String(file.name || "").split(".").pop()?.toLowerCase() || "";
  const mime = MIME_POR_EXTENSAO[extensao];
  if (!mime) return file;
  return new File([file], file.name, { type: mime });
}
