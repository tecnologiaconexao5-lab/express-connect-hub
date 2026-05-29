import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase
    .from("tabelas_valores")
    .select("adicionais, percentual_prestador, valor_fixo_prestador, tipo_repasse_prestador, valor_km_excedente, km_franquia")
    .limit(1);
    
  if (error) {
    console.error("ERRO:", error);
  } else {
    console.log("SCHEMA:", JSON.stringify(data[0], null, 2));
  }
}
check();
