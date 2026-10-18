import {
  assinarStorageRef,
  caminhoValido,
  parseStorageRef,
  referenciaEstavel,
  SIGN_TTL_SECONDS,
  type SignFn,
  type StorageRef,
} from "@/services/storage/storageRefService";

export const BUCKET_DOCUMENTOS_PRESTADORES = "documentos_prestadores";
export const DOCUMENTO_TTL_SECONDS = SIGN_TTL_SECONDS;

export type { SignFn, StorageRef };

export interface OpcoesResolverDocumento {
  prestadorId?: string | null;
  bucketEsperado?: string;
  ttl?: number;
  sign?: SignFn;
}

export function refDocumento(
  value: string | null | undefined
): StorageRef | null {
  return parseStorageRef(value, BUCKET_DOCUMENTOS_PRESTADORES);
}

export function caminhoPertenceAoPrestador(
  path: string | null | undefined,
  prestadorId: string | null | undefined
): boolean {
  if (!path || !prestadorId) return false;
  const p = path.trim();
  const id = prestadorId.trim();
  if (!p || !id) return false;
  return p.startsWith(`doc_${id}_`) || p.startsWith(`foto_${id}_`);
}

export function referenciaEstavelDocumento(value: string | null | undefined): string | null {
  return referenciaEstavel(value, BUCKET_DOCUMENTOS_PRESTADORES);
}

export function mesmaReferencia(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = referenciaEstavelDocumento(a);
  const nb = referenciaEstavelDocumento(b);
  if (na && nb) return na === nb;
  if (na) return na === b;
  if (nb) return nb === a;
  return false;
}

export async function resolverUrlDocumento(
  value: string | null | undefined,
  opcoes: OpcoesResolverDocumento = {}
): Promise<string | null> {
  const { prestadorId = null, bucketEsperado = BUCKET_DOCUMENTOS_PRESTADORES, ttl = DOCUMENTO_TTL_SECONDS, sign } =
    opcoes;

  const ref = parseStorageRef(value, BUCKET_DOCUMENTOS_PRESTADORES);
  if (!ref) return null;
  if (ref.external) return ref.raw;
  if (ref.bucket !== bucketEsperado) return null;
  if (!caminhoValido(ref.path)) return null;
  if (prestadorId && !caminhoPertenceAoPrestador(ref.path, prestadorId)) return null;

  return assinarStorageRef(ref, ttl, sign);
}

export async function resolverDocumentos<T extends { url?: string | null }>(
  rows: T[],
  opcoes: OpcoesResolverDocumento = {}
): Promise<Array<T & { url: string | null }>> {
  const out = await Promise.all(
    rows.map(async (row) => ({ ...row, url: await resolverUrlDocumento(row.url, opcoes) }))
  );
  return out;
}
