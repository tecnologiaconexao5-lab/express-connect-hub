const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarECriar() {
  console.log('=== VERIFICANDO E TENTANDO CRIAR TABELA ===\n');
  
  console.log('1. Verificando se tabela existe...');
  const { data: check, error: eCheck } = await supabase.from('tabelas_valores').select('id').limit(1);
  console.log('Existe:', eCheck?.message || (check ? 'SIM' : 'NÃO'));
  
  console.log('\n2. Tentando executar via RPC...');
  const { data: rpc, error: eRpc } = await supabase.rpc('create_table_tabelas_valores', { sql: `
    CREATE TABLE IF NOT EXISTS public.tabelas_valores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cliente_id UUID,
      nome TEXT NOT NULL,
      tipo_veiculo TEXT NOT NULL,
      km_inicial INTEGER NOT NULL DEFAULT 0,
      km_final INTEGER NOT NULL,
      valor_base NUMERIC(10,2) DEFAULT 0,
      valor_km NUMERIC(10,2) DEFAULT 0,
      valor_minimo NUMERIC(10,2) DEFAULT 0,
      pedagio_incluso BOOLEAN DEFAULT false,
      ativo BOOLEAN DEFAULT true,
      universal BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `});
  console.log('RPC:', rpc, eRpc?.message);
}

verificarECriar().catch(e => console.log('ERRO:', e.message));