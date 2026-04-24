const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function forcarRefresh() {
  console.log('=== FORÇANDO REFRESH SCHEMA ===\n');
  
  console.log('1. Tentando POST para criar tabela pagamentos_prestadores...');
  
  const novaTabela = {
    id: crypto.randomUUID(),
    prestador_id: '00000000-0000-0000-0000-000000000000',
    prestador_nome: 'TESTE',
    prestador_documento: '00000000000',
    periodo_inicio: '2025-01-01',
    periodo_fim: '2025-01-31',
    quantidade_os: 1,
    valor_servicos: 100,
    valor_reembolsos: 0,
    valor_bonus: 0,
    valor_descontos: 0,
    valor_adiantamentos: 0,
    valor_liquido: 100,
    status: 'pendente',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('pagamentos_prestadores')
    .upsert(novaTabela, { onConflict: 'id' })
    .select();
  
  console.log('DATA:', data);
  console.log('ERRO:', error?.message);
}

forcarRefresh().catch(e => console.log('ERRO:', e.message));