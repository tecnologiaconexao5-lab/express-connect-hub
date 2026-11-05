// Anexos de contratos de clientes — composição dos serviços já existentes.
// O binário vai para o bucket privado `documentos_operacionais` (mesmo bucket da
// Central Inteligente de Documentos) e o contrato guarda a referência estável
// em `clientes_contratos.anexo_url`. Nenhum bucket/serviço de storage paralelo.
import {
  enviarDocumentoOperacional,
  registrarEventoDocumento,
} from "@/services/documentos/documentosMetadataService";
import {
  assinarStorageRef,
  caminhoValido,
  KNOWN_BUCKETS,
  parseStorageRef,
  SIGN_TTL_SECONDS,
} from "@/services/storage/storageRefService";
import { garantirTipoAnexo } from "@/lib/anexoDocumento";

export const BUCKET_ANEXO_CONTRATO = "documentos_operacionais";

export interface ResultadoAnexoContrato {
  url: string;
  nome: string;
  documentoId: string;
}

export async function enviarAnexoContrato(input: {
  file: File;
  clienteId: string;
  clienteNome?: string | null;
  numero?: string | null;
  objeto?: string | null;
}): Promise<ResultadoAnexoContrato> {
  if (!input.clienteId) throw new Error("Cliente não identificado para o anexo.");
  const descricaoContrato = [input.numero ? `Contrato ${input.numero}` : "Contrato", input.objeto]
    .filter(Boolean)
    .join(" — ");

  const { documento } = await enviarDocumentoOperacional({
    file: garantirTipoAnexo(input.file),
    moduloOrigem: "clientes",
    entidadeId: input.clienteId,
    entidadeNome: input.clienteNome ?? null,
    tipo: "Contrato",
    nome: input.file.name,
    categoria: "Comercial",
    departamento: "Comercial",
    clienteId: input.clienteId,
    descricao: descricaoContrato || null,
    responsavel: "TMS",
  });

  return {
    url: documento.url,
    nome: documento.nome || input.file.name,
    documentoId: documento.id,
  };
}

export async function vincularAnexoAoContrato(input: {
  documentoId: string;
  contratoId: string;
  numero?: string | null;
}): Promise<void> {
  if (!input.documentoId || !input.contratoId) return;
  await registrarEventoDocumento(input.documentoId, {
    tipo: "vinculo_contrato",
    descricao: `Documento vinculado ao contrato ${input.numero || input.contratoId}.`,
    metadata: { contrato_id: input.contratoId },
  });
}

/**
 * Resolve a referência do anexo para uma URL assinada (bucket privado) ou
 * devolve a URL externa original (compatibilidade com registros antigos).
 */
export async function resolverUrlAnexoContrato(
  value: string | null | undefined,
): Promise<string | null> {
  const ref = parseStorageRef(value, BUCKET_ANEXO_CONTRATO);
  if (!ref) return null;
  if (ref.external) return ref.raw;
  if (!caminhoValido(ref.path)) return null;
  if (!KNOWN_BUCKETS.has(ref.bucket)) return null;
  return assinarStorageRef(ref, SIGN_TTL_SECONDS);
}
