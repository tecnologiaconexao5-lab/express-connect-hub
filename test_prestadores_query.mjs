import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase
          .from("prestadores")
          .select("id, nome_completo, cpf_cnpj, telefone, whatsapp, veiculos(tipo, placa), status, regiao_principal, valor_diaria, valor_saida, fixo_mensal, franquia_km, valor_km, tipo_pagamento")
          .eq("status", "ativo");
  console.log("Error:", error);
  console.log("Data length:", data?.length);
}
run();
