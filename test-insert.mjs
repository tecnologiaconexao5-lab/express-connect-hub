import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://lzyrubwtvpbvexugbevw.supabase.co', 'sb_publishable_G-6JTZ-TCLHnSMo4N1Os3w_32HkBTms');

async function testInsert() {
  const { data, error } = await supabase.from('clientes').insert([
    { razao_social: 'Teste', cnpj: '111111' }
  ]);
  console.log('Error:', error);
  console.log('Data:', data);
}

testInsert();
