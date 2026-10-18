import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data: rowData, error: rowError } = await supabase.from('ordens_servico').select('*').limit(1);
  if (rowData && rowData.length > 0) {
    const keys = Object.keys(rowData[0]);
    console.log(JSON.stringify(keys, null, 2));
  } else {
    console.log("No data or error:", rowError);
  }
}
check();
