import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
  const tables = ['fiscal_ctes', 'fiscal_mdfes', 'fiscal_nfse', 'fiscal_events', 'fiscal_logs'];
  
  console.log("=== DIAGNÓSTICO DE ALIMENTAÇÃO (CONTAGEM DE REGISTROS) ===");
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
      
    if (error) {
      console.error(`Error querying ${table}:`, error.message);
    } else {
      console.log(`- ${table}: ${count} registros`);
    }
  }
}

checkCounts();
