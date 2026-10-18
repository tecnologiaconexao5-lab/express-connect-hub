import { createClient, SupabaseClient } from "@supabase/supabase-js";

const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key]?.trim();
  }
  return process.env[key]?.trim();
};

const supabaseUrl = getEnvVar("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnvVar("VITE_SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase não configurado corretamente no .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function createServiceClient(serviceRoleKey?: string): SupabaseClient {
  const key = serviceRoleKey || getEnvVar("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !key) {
    throw new Error("Service Role Key não configurada. Defina SUPABASE_SERVICE_ROLE_KEY no .env");
  }
  return createClient(supabaseUrl, key);
}