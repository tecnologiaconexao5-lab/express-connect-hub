import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';
const OS_ID = '71e61468-af09-42e6-8d7e-e4624d9b1468';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tamiris.castilho@conexaoexpress.com.br',
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || 'Conexao@2026'
  });
  if (authErr || !auth?.session) { console.log('FALHA_AUTH:', authErr?.message); process.exit(1); }

  // composicao
  const c = await supabase.from('composicao_financeira_os').select('*').eq('os_id', OS_ID);
  console.log('=== COMPOSICAO ===');
  console.log(JSON.stringify(c.data, null, 2));
  if (c.data) console.log('COUNT:', c.data.length);

  // eventos
  const ev = await supabase.from('eventos_oficiais').select('id, tipo, created_at').eq('origem_id', OS_ID).order('created_at', { ascending: false });
  console.log('\n=== EVENTOS_OFICIAIS ===');
  console.log(JSON.stringify(ev.data, null, 2) || '(empty)');
  if (ev.error) console.log('ERR:', ev.error.message);

  // client
  const cl = await supabase.from('clientes').select('nome_fantasia, razao_social').eq('id', '04280785-4004-42c3-a406-886dd0730a8d').single();
  console.log('\n=== CLIENTE ===');
  console.log(JSON.stringify(cl.data, null, 2));

  // prestador
  const pr = await supabase.from('prestadores').select('nome_completo').eq('id', '6cc41f68-1467-455d-b8d5-c61bfe72cb7c').single();
  console.log('\n=== PRESTADOR ===');
  console.log(JSON.stringify(pr.data, null, 2));
}

main().catch(e => console.error('FATAL:', e.message));
