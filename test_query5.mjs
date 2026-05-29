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
    .select("cliente, id, tipo_veiculo, valor_base, km_franquia")
    .not("cliente", "is", null)
    .limit(1);
    
  if (error) {
    console.error("ERRO tabelas_valores:", error);
  } else {
    console.log("ROW tabelas_valores:", data);
  }
}
check();
