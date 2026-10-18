import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, KEY);

async function check() {
  const candidates = [
    'contratos', 'contratos_servico', 'contrato_servico',
    'contratos_transporte', 'contrato_transporte', 'acordos_servico',
    'convenios', 'contrato_cliente', 'contrato_prestador'
  ];
  
  for (const name of candidates) {
    const { data, error } = await supabase.from(name).select('id').limit(1);
    if (!error) {
      const count = data?.length || 0;
      console.log(`TABLE EXISTS: ${name} (${count} registros)`);
      process.exit(0);
    }
  }
  
  console.log('Nenhuma tabela de contratos encontrada entre os candidatos');
  
  // Try REST API to list schema
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/?limit=0`, {
      headers: { 'apikey': KEY }
    });
    const text = await resp.text();
    console.log('Schema response:', text.substring(0, 500));
  } catch (e: any) {
    console.log('Schema fetch error:', e.message);
  }
}

check().then(() => process.exit(0));
