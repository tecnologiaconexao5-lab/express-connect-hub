const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function buscarTodas() {
  console.log('=== BUSCANDO TODAS TABELAS ===\n');
  
  const prefixes = ['pagamento', 'documento', 'adiantamento', 'prestador'];
  
  for (const prefix of prefixes) {
    try {
      const { data, error } = await supabase.from(prefix + 's').select('id').limit(1);
      console.log(`${prefix}s: ${error ? 'NAO EXISTE' : 'EXISTE'} (${error?.code || 'OK'})`);
    } catch(e) {
      console.log(`${prefix}s: ERRO ${e.message}`);
    }
  }
  
  console.log('\n=== TESTE DIRETO COM documento_prestadores ===');
  const { data2, error2 } = await supabase.from('documentos_prestadores').select('*').limit(1);
  console.log('documentos_prestadores:', error2?.message || 'EXISTE');
}

buscarTodas().catch(e => console.log('ERRO:', e.message));