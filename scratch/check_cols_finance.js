
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data: cols, error: err2 } = await supabase.from('financeiro_pagar').select('*').limit(1);
  if (err2) {
    console.error('Error:', err2);
  } else {
    console.log('financeiro_pagar:', Object.keys(cols[0] || {}));
  }
  
  const { data: cols2, error: err3 } = await supabase.from('ordens_servico').select('*').limit(1);
  if (err3) {
    console.error('Error OS:', err3);
  } else {
    console.log('ordens_servico:', Object.keys(cols2[0] || {}));
  }
}

checkColumns();
