const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificar() {
  console.log('=== VERIFICANDO EXISTÊNCIA DE TABELAS ===\n');
  
  const tables = [
    'prestadores',
    'ordens_servico',
    'pagamentos_prestadores',
    'pagamentos_prestadores_itens',
    'adiantamentos_prestadores'
  ];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    console.log(`${table}: ${error ? 'NAO EXISTE' : 'EXISTE'} (${error?.message || 'OK'})`);
  }
}

verificar().catch(e => console.log('ERRO:', e.message));