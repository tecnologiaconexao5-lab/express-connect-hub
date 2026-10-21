import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Fonte ÚNICA de conexão com o Supabase.
 *
 * Precedência: variáveis de ambiente (`VITE_SUPABASE_URL` /
 * `VITE_SUPABASE_ANON_KEY`, do .env local ou do painel da Vercel).
 * Se estiverem ausentes no build, cai no fallback público abaixo.
 *
 * ATENÇÃO (TEMPORÁRIO): o fallback existe apenas para destravar a tela
 * branca na Vercel. A `anon key` é pública por design (vai para o bundle
 * do browser e é protegida por RLS), mas o correto é configurar as duas
 * variáveis no painel da Vercel e remover o fallback.
 */

type SupabaseEnvKey = "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY";

const SUPABASE_PUBLIC_FALLBACK: Record<SupabaseEnvKey, string> = {
  VITE_SUPABASE_URL: "https://uwrvzsjtpgaifkktpepn.supabase.co",
  VITE_SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZr" +
    "a3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs",
};

const readEnv = (key: SupabaseEnvKey): string => {
  const value = import.meta.env?.[key];
  const raw = typeof value === "string" && value.trim() ? value : SUPABASE_PUBLIC_FALLBACK[key];
  return raw.trim().replace(/\/+$/, "");
};

const isLocalOrPrivateHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host === "[::1]") return true;
  if (host === "127.0.0.1" || host.startsWith("127.")) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
};

const validateSupabaseUrl = (url: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`VITE_SUPABASE_URL inválida: "${url}". Defina a URL do projeto Supabase (https://<projeto>.supabase.co).`);
  }

  if (import.meta.env.PROD) {
    if (parsed.protocol !== "https:") {
      throw new Error(`VITE_SUPABASE_URL deve usar HTTPS em produção. Valor recebido: "${url}".`);
    }
    if (isLocalOrPrivateHost(parsed.hostname)) {
      throw new Error(
        `VITE_SUPABASE_URL aponta para localhost/IP local ("${parsed.hostname}") em produção. ` +
          "Configure a variável no painel da Vercel com a URL pública do Supabase.",
      );
    }
  }
};

const supabaseUrl = readEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY " +
      "nas variáveis de ambiente do build (Vercel) ou no .env local.",
  );
}

validateSupabaseUrl(supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Cliente administrativo — uso EXCLUSIVO no backend/scripts.
 * A service role key nunca deve ser exposta no bundle do frontend.
 */
export function createServiceClient(serviceRoleKey?: string): SupabaseClient {
  const key = (serviceRoleKey || "").trim();
  if (!key) {
    throw new Error("Service Role Key não informada. Use este cliente apenas no backend/scripts.");
  }
  return createClient(supabaseUrl, key);
}
