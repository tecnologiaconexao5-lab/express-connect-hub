const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarEstruturaOS() {
  console.log('=== VERIFICANDO ESTRUTURA OS ===\n');
  
  const { data: os, error } = await supabase.from('ordens_servico').select('*').limit(1);
  if (os && os[0]) {
    console.log('Campos OS:', Object.keys(os[0]).join(', '));
  }
  
  console.log('\n--- Verificando clientes ---');
  const { data: c } = await supabase.from('clientes').select('id, nome').limit(1);
  console.log('Cliente:', c);
}

verificarEstruturaOS().catch(e => console.log('ERRO:', e.message));