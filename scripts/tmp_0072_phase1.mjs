import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.production' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const [osC, prC, veC] = await Promise.all([
  supabase.from('ordens_servico').select('id, status, cliente, prestador_id, created_at').limit(5),
  supabase.from('prestadores').select('id, nome_completo, cpf_cnpj, status').limit(5),
  supabase.from('veiculos').select('id, placa, modelo, prestador_vinculado').limit(5),
]);

console.log('=== ORDENS SERVICO ===');
if (osC.error) console.log('ERR:', osC.error.message);
console.log(JSON.stringify(osC.data, null, 2));

console.log('=== PRESTADORES ===');
if (prC.error) console.log('ERR:', prC.error);
const prestadores = await supabase.from('prestadores').select('id, nome_completo, cpf_cnpj, status').limit(5);
if (prestadores.error) console.log('ERR:', prestadores.error.message);
else console.log(JSON.stringify(prestadores.data, null, 2));

console.log('=== VEICULOS ===');
if (veC.error) console.log('ERR:', veC.error.message);
else console.log(JSON.stringify(veC.data, null, 2));

process.exit(0);