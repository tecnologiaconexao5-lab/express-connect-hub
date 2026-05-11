import { createClient } from "@supabase/supabase-js";

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