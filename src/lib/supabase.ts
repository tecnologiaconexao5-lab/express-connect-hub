import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Fonte ÚNICA de conexão com o Supabase.
 *
 * As credenciais abaixo são PÚBLICAS por definição: a `anon key` vai para o
 * bundle do browser de qualquer forma e o acesso real é controlado por RLS.
 * Valores fixados no código a pedido do cliente (o deploy não usa variáveis
 * de ambiente). A `service role key` continua fora do frontend.
 */

export const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
export const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

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
    throw new Error(`SUPABASE_URL inválida: "${url}". Use https://<projeto>.supabase.co.`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`SUPABASE_URL deve usar HTTPS. Valor recebido: "${url}".`);
  }
  if (isLocalOrPrivateHost(parsed.hostname)) {
    throw new Error(`SUPABASE_URL aponta para localhost/IP local ("${parsed.hostname}").`);
  }
};

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
