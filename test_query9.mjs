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
    .select("*")
    .ilike("nome", "%FIORINO DVL%");
    
  if (error) {
    console.error("ERRO tabelas_valores:", error);
  } else {
    console.log("FIORINO DVL TABELAS:", data);
  }
}
check();
