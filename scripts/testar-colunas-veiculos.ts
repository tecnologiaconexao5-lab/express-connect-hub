import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: vData } = await supabase.from('veiculos').select('*').limit(1);
  if (vData && vData.length > 0) console.log("veiculos cols:", Object.keys(vData[0]));
  
  const { data: pData } = await supabase.from('prestadores').select('*').limit(1);
  if (pData && pData.length > 0) console.log("prestadores cols:", Object.keys(pData[0]));
}

main();
