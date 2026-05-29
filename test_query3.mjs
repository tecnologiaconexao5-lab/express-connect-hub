import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase
    .from("alocacoes_escala")
    .select("*")
    .limit(1);
    
  if (error) {
    console.error("ERRO alocacoes_escala:", error);
  } else {
    console.log("COLUNAS alocacoes_escala:", data.length > 0 ? Object.keys(data[0]) : "Tabela vazia - sem como ver as chaves.");
  }
}
check();
