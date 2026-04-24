const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarEstrutura() {
  console.log('=== ESTRUTURA documento_prestadores ===\n');
  
  const { data, error } = await supabase.from('documentos_prestadores').select('*').limit(1);
  console.log('DATA:', data);
  console.log('ERRO:', error?.message);
  
  console.log('\n=== TENTANDO USAR documento_prestadores COMO pagamento ===');
  const testDoc = {
    id: '00000000-0000-0000-0000-000000000099',
    prestador_id: '16c5dece-0837-4597-aac8-954f0d5a98e9',
    tipo: 'pagamento',
    status: 'pendente'
  };
  
  const { data: insert, error: eIns } = await supabase.from('documentos_prestadores').upsert(testDoc).select();
  console.log('INSERT:', insert);
  console.log('ERRO:', eIns?.message);
}

verificarEstrutura().catch(e => console.log('ERRO:', e.message));