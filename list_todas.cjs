const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listarTodas() {
  console.log('=== LISTANDO TODAS AS TABELAS ===\n');
  
  const testTables = [
    'prestadores', 'ordens_servico', 'veiculos', 'clientes', 
    'usuarios', 'contratos', 'orcamentos', 'propostas',
    'documentos_prestadores', 'documentos', 'ocorrencias', 'escalas'
  ];
  
  for (const table of testTables) {
    const result = await supabase.from(table).select('id').limit(1);
    console.log(`${table}: ${result.error ? 'NAO' : 'SIM'}`);
  }
}

listarTodas().catch(e => console.log('ERRO:', e.message));