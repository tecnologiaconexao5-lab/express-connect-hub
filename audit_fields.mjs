import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data: rowData } = await supabase.from('ordens_servico').select('*').limit(1);
  const keys = rowData && rowData.length > 0 ? Object.keys(rowData[0]) : [];
  
  const fieldsToCheck = [
    "pedido_interno", "numero_os", "numero_oc_cliente", "cliente_id", "unidade_id",
    "data_emissao", "data_programada", "horario_programado", "endereco_origem",
    "endereco_destino", "bairro", "cep", "status", "status_operacional",
    "status_financeiro", "metadata"
  ];
  
  for (const f of fieldsToCheck) {
    if (keys.includes(f)) {
      console.log(`- ${f}: EXISTING`);
    } else {
      console.log(`- ${f}: MISSING`);
    }
  }
}
check();
