const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey, {
  schema: 'public',
  persistSession: false
});

async function criarTodas() {
  console.log('=== CRIANDO TODAS AS TABELAS NECESSÁRIAS ===\n');
  
  const tabelas = [
    'pagamentos_prestadores',
    'pagamentos_prestadores_itens', 
    'adiantamentos_prestadores'
  ];
  
  for (const table of tabelas) {
    console.log(`\n--- Testando ${table} por insert ---`);
    
    const payload = [
      {
        id: crypto.randomUUID(),
        prestador_id: '16c5dece-0837-4597-aac8-954f0d5a98e9',
        prestador_nome: 'TESTE_SUPABASE',
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
        created_at: new Date().toISOString()
      }
    ];
    
    const { data, error } = await supabase.from(table).insert(payload).select();
    console.log(`ERRO ${table}:`, error?.message || 'SUCESSO/CRIADO');
    console.log(`DATA ${table}:`, data ? data[0]?.id : 'N/A');
    
    if (!error) {
      console.log(`=== ${table} CRIADA COM SUCESSO ===`);
    }
  }
}

criarTodas()
  .then(() => console.log('\n=== FIM ==='))
  .catch(e => console.log('ERRO:', e.message));