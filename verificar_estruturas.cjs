const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarEstruturas() {
  console.log('=== VERIFICANDO ESTRUTURAS ===\n');
  
  console.log('--- ordens_servico ---');
  const { data: os, error: eOS } = await supabase.from('ordens_servico').select('*').limit(1);
  console.log('Erro:', eOS?.message);
  if (os && os[0]) {
    console.log('Campos OS:', Object.keys(os[0]).filter(k => k.includes('dist') || k.includes('valor') || k.includes('endere') || k.includes('rota')));
  }
  
  console.log('\n--- tabelas_valores ---');
  const { data: tv, error: eTV } = await supabase.from('tabelas_valores').select('*').limit(1);
  console.log('tabelas_valores:', eTV?.message || (tv ? 'EXISTE' : 'NAO EXISTE'));
  
  console.log('\n--- veiculos ---');
  const { data: v, error: eV } = await supabase.from('veiculos').select('*').limit(1);
  console.log('Erro:', eV?.message);
  if (v && v[0]) {
    console.log('Campos veiculos:', Object.keys(v[0]));
  }
  
  console.log('\n--- clientes ---');
  const { data: c, error: eC } = await supabase.from('clientes').select('*').limit(1);
  console.log('Erro:', eC?.message);
}

verificarEstruturas().catch(e => console.log('ERRO:', e.message));