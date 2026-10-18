import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tamiris.castilho@conexaoexpress.com.br',
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || 'Conexao@2026'
  });
  if (authErr) { console.log('FALHA_AUTH:', authErr.message); process.exit(1); }

  // Try to get a single row from composicao to see ALL columns
  const c = await supabase.from('composicao_financeira_os').select('*').limit(1).single();
  if (c.data) console.log('COMPOSICAO_SCHEMA:', JSON.stringify(Object.keys(c.data)));

  // Try eventos_oficiais - first get 1 row to see columns
  const ev = await supabase.from('eventos_oficiais').select('*').limit(1);
  if (ev.data && ev.data.length > 0) {
    console.log('EVENTOS_SCHEMA:', JSON.stringify(Object.keys(ev.data[0])));
  } else {
    console.log('EVENTOS_TABLE: accessible, 0 rows or error:', ev.error?.message || 'OK (0 rows)');
    // Try inserting a test record
    const ins = await supabase.from('eventos_oficiais').insert({
      origem_id: '71e61468-af09-42e6-8d7e-e4624d9b1468',
      tipo_evento: 'os.finalizada',
      dados: { os_id: '71e61468-af09-42e6-8d7e-e4624d9b1468', status: 'finalizada' }
    }).select();
    console.log('EVENTOS_INSERT:', ins.error?.message || 'OK ' + JSON.stringify(ins.data));
    if (ins.data) {
      await supabase.from('eventos_oficiais').delete().eq('id', ins.data[0].id);
    }
  }
}

main().catch(e => console.error('FATAL:', e.message));
