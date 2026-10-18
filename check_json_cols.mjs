import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data: rowData } = await supabase.from('ordens_servico').select('*').limit(1);
  if (rowData && rowData.length > 0) {
    const row = rowData[0];
    const jsonCols = [];
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'object' && value !== null) {
        jsonCols.push(key);
      }
    }
    console.log("Possible JSON/JSONB columns:", jsonCols);
  }
}
check();
