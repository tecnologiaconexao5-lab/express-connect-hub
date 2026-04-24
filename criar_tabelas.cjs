const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function criarTabelas() {
  console.log('=== CRIANDO TABELAS NO SUPABASE ===\n');
  
  console.log('1. Criando tabela pagamentos_prestadores...');
  const { error: e1 } = await supabase.rpc('exec_sql', { 
    sql: `CREATE TABLE IF NOT EXISTS public.pagamentos_prestadores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prestador_id UUID REFERENCES public.prestadores(id) ON DELETE CASCADE,
      prestador_nome TEXT,
      prestador_documento TEXT,
      periodo_inicio DATE NOT NULL,
      periodo_fim DATE NOT NULL,
      quantidade_os INTEGER DEFAULT 0,
      valor_servicos NUMERIC(10,2) DEFAULT 0,
      valor_reembolsos NUMERIC(10,2) DEFAULT 0,
      valor_bonus NUMERIC(10,2) DEFAULT 0,
      valor_descontos NUMERIC(10,2) DEFAULT 0,
      valor_adiantamentos NUMERIC(10,2) DEFAULT 0,
      valor_liquido NUMERIC(10,2) DEFAULT 0,
      status TEXT DEFAULT 'pendente',
      data_pagamento DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );` 
  });
  console.log('ERRO (ouOK se não suportado):', e1?.message || 'OK');
  
  console.log('\n2. Tentando via API REST POST...');
}

criarTabelas().catch(e => console.log('ERRO:', e));