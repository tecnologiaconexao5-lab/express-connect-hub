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
    .select("cliente, nome, tipo_veiculo, valor_base")
    .limit(5);
    
  if (error) {
    console.error("ERRO:", error);
  } else {
    console.log("ROWS:", data);
  }
}
check();
