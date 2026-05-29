const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMdfe() {
  const { count, error } = await supabase
    .from('fiscal_mdfes')
    .select('*', { count: 'exact', head: true });
    
  if (error) console.error("Erro:", error);
  console.log(`\n=== VERIFICACAO MDF-E ===`);
  console.log(`A tabela fiscal_mdfes possui ${count} registros.`);
}

checkMdfe();
