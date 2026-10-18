import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tamiris.castilho@conexaoexpress.com.br',
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || 'Conexao@2026'
  });
  if (authErr || !auth?.session) { console.log('FALHA_AUTH:', authErr?.message); process.exit(1); }
  console.log('Autenticado:', auth.user.email);

  // 1. Find OS
  const { data: os, error: osErr } = await supabase
    .from('ordens_servico')
    .select('*')
    .eq('numero', 'TEST-M80-CF-MR751I7O')
    .maybeSingle();
  if (osErr) { console.log('ERR:', osErr.message); process.exit(1); }
  if (!os) { console.log('NOT_FOUND'); process.exit(1); }
  console.log('OS ENCONTRADA:');
  console.log(JSON.stringify(os, null, 2));
}
main().catch(e => console.error(e));
