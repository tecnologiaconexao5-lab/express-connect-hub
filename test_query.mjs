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
    .select("id, nome_completo, cpf_cnpj, telefone, whatsapp, veiculos(tipo, placa), status, regiao_principal")
    .limit(1);
    
  if (error) {
    console.error("ERRO:", error);
  } else {
    console.log("SUCESSO:", data);
  }
}
check();
