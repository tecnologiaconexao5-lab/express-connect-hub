export type StorageRef = {
  bucket: string;
  path: string;
  external: boolean;
  raw: string;
};

export type SignFn = (bucket: string, path: string, ttl: number) => Promise<string | null>;

export const SIGN_TTL_SECONDS = 600;

export const KNOWN_BUCKETS = new Set<string>([
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

const LOCAL_PREFIXES = ["file://", "data:", "/data/", "/var/"];

function isLocal(v: string): boolean {
  if (LOCAL_PREFIXES.some((p) => v.startsWith(p))) return true;
  return /^[a-zA-Z]:[\\/]/.test(v);
}

export function parseStorageRef(
  value: string | null | undefined,
  defaultBucket: string
): StorageRef | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (isLocal(v)) return null;

  const m = v.match(/\/storage\/v1\/object\/(?:public|sign|authenticated|render)\/([^/]+)\/(.+)$/);
  if (m) {
    return { bucket: m[1], path: m[2].split("?")[0], external: false, raw: v };
  }

  if (/^(https?:)?\/\//i.test(v) || /^https?:\/\//i.test(v)) {
    return { bucket: "", path: "", external: true, raw: v };
  }

  const first = v.split("/")[0];
  if (KNOWN_BUCKETS.has(first) && v.includes("/")) {
    return { bucket: first, path: v.slice(first.length + 1), external: false, raw: v };
  }

  return { bucket: defaultBucket, path: v, external: false, raw: v };
}

export function caminhoValido(path: string | null | undefined): boolean {
  if (!path) return false;
  const p = path.trim();
  if (!p) return false;
  if (p.startsWith("/") || p.includes("..") || p.includes("//")) return false;
  if (p.includes("?") || p.includes("#") || p.includes("\n") || p.includes("\0")) return false;
  if (isLocal(p)) return false;
  return true;
}

export function referenciaEstavel(
  value: string | null | undefined,
  defaultBucket: string
): string | null {
  const ref = parseStorageRef(value, defaultBucket);
  if (!ref) return null;
  if (ref.external) return null;
  if (ref.bucket !== defaultBucket) return null;
  if (!caminhoValido(ref.path)) return null;
  return ref.path;
}

export async function assinarStorageRef(
  ref: StorageRef,
  ttl: number,
  sign?: SignFn
): Promise<string | null> {
  if (ref.external) return ref.raw;
  if (!caminhoValido(ref.path)) return null;
  if (sign) return sign(ref.bucket, ref.path, ttl);
  const { supabase } = await import("@/lib/supabase");
  try {
    const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, ttl);
    if (error || !data?.signedUrl) {
      console.warn("[storageRefService] falha ao assinar:", ref.bucket, ref.path, error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    console.warn("[storageRefService] excecao ao assinar:", e);
    return null;
  }
}
