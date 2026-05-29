import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase
    .from("prestadores")
    .select("veiculo_tipo, veiculo_placa, refrigerado")
    .limit(1);
    
  if (error) {
    console.error("ERRO veiculos:", error);
  } else {
    console.log("SUCESSO veiculos:", data);
  }
}
check();
