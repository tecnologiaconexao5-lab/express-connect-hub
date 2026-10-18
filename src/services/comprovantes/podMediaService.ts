import { supabase } from "@/lib/supabase";

/**
 * APP-E2E-07 — F3: resolução SEGURA de mídia POD em bucket privado.
 *
 * O bucket `driver-evidence` é PRIVADO. As referências persistidas podem vir em
 * formatos diferentes (URL pública antiga, URL assinada, caminho de objeto ou URL
 * externa). Este serviço converte refs privadas em SIGNED URLs temporárias,
 * preservando compatibilidade com mídias públicas/legadas.
 *
 * NUNCA usa service_role no frontend. A autorização é feita pela RLS de
 * storage.objects (policy driver_evidence_select_tms) no momento de assinar.
 */

/** Buckets conhecidos do projeto (usados para separar bucket × path em refs "bucket/..."). */
const KNOWN_BUCKETS = new Set<string>([
  "driver-evidence",
  "comprovantes-entrega",
  "documentos",
  "documentos_prestadores",
  "prestadores",
  "veiculos",
  "contratos",
  "fiscal-documentos",
  "biblioteca-global",
  "certificados-fiscais",
]);

/** Buckets que exigem signed URL (privados). */
const PRIVATE_BUCKETS = new Set<string>(["driver-evidence", "fiscal-documentos", "certificados-fiscais"]);

/** TTL curto e profissional para URLs de evidência (10 minutos), alinhado ao
 *  padrão já existente em `fiscal-documento-url`. */
export const POD_MEDIA_TTL_SECONDS = 600;

export interface StorageRef {
  bucket: string;
  path: string;
  /** true quando a referência não é um objeto do Storage Supabase (ex.: URL externa). */
  external: boolean;
  /** valor original persistido. */
  raw: string;
}

/** Extrai bucket/path de uma referência de mídia persistida, com segurança. */
export function parseStorageRef(value: string | null | undefined): StorageRef | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;

  // Caminho local de dispositivo / data URI — não resolvível no servidor.
  if (
    v.startsWith("file://") ||
    v.startsWith("data:") ||
    /^[a-zA-Z]:[\\/]/.test(v) ||
    v.startsWith("/data/") ||
    v.startsWith("/var/")
  ) {
    return null;
  }

  // URL do Supabase Storage (public / sign / authenticated).
  const m = v.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
  if (m) {
    const bucket = m[1];
    const path = m[2].split("?")[0];
    return { bucket, path, external: false, raw: v };
  }

  // URL externa arbitrária — NÃO assinar.
  if (/^https?:\/\//i.test(v)) {
    return { bucket: "", path: "", external: true, raw: v };
  }

  // Referência "bucket/..." para bucket conhecido.
  const first = v.split("/")[0];
  if (KNOWN_BUCKETS.has(first)) {
    return { bucket: first, path: v.slice(first.length + 1), external: false, raw: v };
  }

  // Caminho de objeto sem bucket (padrão do APP: <authUid>/pod/... → driver-evidence).
  return { bucket: "driver-evidence", path: v, external: false, raw: v };
}

/**
 * Resolve UMA referência de mídia:
 * - privada → signed URL temporária (createSignedUrl, TTL curto);
 * - pública/legada/externa → devolve o valor original (compatibilidade);
 * - inválida/local → null.
 */
export async function resolverMidiaPod(value: string | null | undefined): Promise<string | null> {
  const ref = parseStorageRef(value);
  if (!ref) return null;
  if (ref.external || !PRIVATE_BUCKETS.has(ref.bucket)) return ref.raw;

  try {
    const { data, error } = await supabase.storage
      .from(ref.bucket)
      .createSignedUrl(ref.path, POD_MEDIA_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      console.warn("[podMediaService] Falha ao assinar mídia:", ref.bucket, ref.path, error?.message);
      return ref.raw;
    }
    return data.signedUrl;
  } catch (e) {
    console.warn("[podMediaService] Exceção ao assinar mídia:", e);
    return ref.raw;
  }
}

type PodMediaRow = {
  foto_entrega_url?: string | null;
  foto_canhoto_url?: string | null;
  assinatura_url?: string | null;
};

/** Resolve as 3 mídias de um POD em paralelo, preservando os demais campos. */
export async function resolverMidiasPod<T extends PodMediaRow>(pod: T): Promise<T> {
  const [foto, canhoto, assinatura] = await Promise.all([
    resolverMidiaPod(pod.foto_entrega_url),
    resolverMidiaPod(pod.foto_canhoto_url),
    resolverMidiaPod(pod.assinatura_url),
  ]);
  return { ...pod, foto_entrega_url: foto, foto_canhoto_url: canhoto, assinatura_url: assinatura };
}

/** Resolve as mídias de uma lista de PODs. */
export async function resolverMidiasPods<T extends PodMediaRow>(pods: T[]): Promise<T[]> {
  return Promise.all(pods.map((p) => resolverMidiasPod(p)));
}
