import { createClient } from '@supabase/supabase-js';

const sup = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  const a = await sup.auth.signInWithPassword({
    email: 'tamiris.castilho@conexaoexpress.com.br',
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || 'Conexao@2026'
  });
  if (!a?.data?.session) { console.log('FALHA_AUTH:', a?.error?.message); return; }
  console.log('Auth OK');

  const OS_ID = '71e61468-af09-42e6-8d7e-e4624d9b1468';

  const ev1 = await sup.from('eventos_oficiais').select('*').eq('entity_id', OS_ID).order('created_at', { ascending: false }).limit(5);
  console.log('EVENTOS entity_id:', JSON.stringify(ev1.data || []), ev1.error?.message || '');

  const ev2 = await sup.from('eventos_oficiais').select('*').eq('entity_number', 'TEST-M80-CF-MR751I7O').limit(5);
  console.log('EVENTOS entity_number:', JSON.stringify(ev2.data || []));

  const ev3 = await sup.from('eventos_oficiais').select('id,event_type,entity_type,entity_id,created_at').order('created_at', { ascending: false }).limit(10);
  console.log('ULTIMOS 10:', JSON.stringify(ev3.data || []));

  const ev4 = await sup.from('eventos_oficiais').select('id,event_type').eq('event_type', 'os.finalizada').limit(5);
  console.log('EVENTOS os.finalizada:', JSON.stringify(ev4.data || []));

  // Check columns
  const ev0 = await sup.from('eventos_oficiais').select('*').limit(1);
  console.log('COLUMNS:', Object.keys(ev0.data?.[0] || {}).join(', '), ev0.error?.message || '');
}
main().catch(e => console.error('ERR:', e));
