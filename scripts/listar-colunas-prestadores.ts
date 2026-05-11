import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("Consultando colunas da tabela prestadores...");
  
  // Como information_schema não é acessível via REST publicamente por default sem rpc,
  // vamos tentar uma query direta se tivermos uma função RPC, ou apenas fazer um select limit 1 
  // para inspecionar as chaves do resultado.
  const { data, error } = await supabase.from('prestadores').select('*').limit(1);
  
  if (error) {
    console.error("Erro ao consultar prestadores:", error);
    return;
  }
  
  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log("Colunas encontradas no payload (pode não ser todas se forem nulas):");
    columns.forEach(col => console.log(`- ${col}`));
  } else {
    // Tenta inserir vazio para ver o erro
    const { error: insertError } = await supabase.from('prestadores').insert({ invalid_col: 1 });
    console.log("Erro de insert para descobrir colunas:", insertError);
  }
}

main();
