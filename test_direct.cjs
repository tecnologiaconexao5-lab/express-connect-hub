const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testar() {
  console.log('=== TESTE SUPERBASE DIRETO ===\n');
  
  console.log('1. Testando tabela prestadores...');
  const { data: p, error: eP } = await supabase.from('prestadores').select('*').limit(1);
  console.log('prestadores OK:', p?.length, 'registros');
  console.log('Erro prestadores:', eP?.message);
  
  console.log('\n2. Testando ordens_servico...');
  const { data: os, error: eOS } = await supabase.from('ordens_servico').select('*').limit(1);
  console.log('ordens_servico OK:', os?.length, 'registros');
  console.log('Erro OS:', eOS?.message);
  
  console.log('\n3. Tentando criar pagamentos_prestadores via POST...');
  const { data: pg, error: ePg } = await supabase.from('pagamentos_prestadores').select('*').limit(1);
  console.log('pagamentos_prestadores:', pg?.length, ePg?.message);
}

testar().catch(e => console.log('ERRO:', e));