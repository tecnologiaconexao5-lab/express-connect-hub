
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'documentos_prestadores' });
  if (error) {
    console.error('Error:', error);
    // Try raw query if RPC fails
    const { data: cols, error: err2 } = await supabase.from('documentos_prestadores').select('*').limit(1);
    if (err2) {
      console.error('Error 2:', err2);
    } else {
      console.log('Columns:', Object.keys(cols[0] || {}));
    }
  } else {
    console.log('Columns:', data);
  }
}

checkColumns();
