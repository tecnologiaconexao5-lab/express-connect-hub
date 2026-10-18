const { createClient } = require('@supabase/supabase-js');

// Supabase anon key — pública por definição (não é segredo)
const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzQ5MDUyMDAwLAogICJleHAiOiAxOTA2ODE4NDAwfQ.VkOOiWBnPgiGrbJW5_A8_YDW_Ot9lCbi3l_Cu2_fHBs';

const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

(async () => {
  console.log('=== TESTE ANÔNIMO — alocacoes_escala ===');
  console.log('Autenticado?', (await supabaseAnon.auth.getSession()).data.session ? 'SIM' : 'NÃO');

  // Teste 1: SELECT count (sem dados pessoais)
  const { data: selectData, error: selectError, count } = await supabaseAnon
    .from('alocacoes_escala')
    .select('*', { count: 'exact', head: true });

  console.log('\n1. SELECT count:');
  if (selectError) {
    console.log('   BLOQUEADO:', selectError.message);
    process.exit(1);
  }
  console.log('   APROVADO — count:', count, 'registros acessíveis');

  // Teste 2: SELECT com limit 3 (apenas colunas não-sensíveis)
  const { data: sampleData, error: sampleError } = await supabaseAnon
    .from('alocacoes_escala')
    .select('id, status, data_escala, created_at')
    .limit(3);

  console.log('\n2. SELECT limit 3 (colunas básicas):');
  if (sampleError) {
    console.log('   BLOQUEADO:', sampleError.message);
    process.exit(1);
  }
  console.log('   APROVADO —', sampleData.length, 'linhas retornadas');
  sampleData.forEach(r => console.log('     ', r.id?.slice(0,8), '|', r.status, '|', r.data_escala));

  // Teste 3: Tentar INSERT (simulado — não persiste)
  const { error: insertError } = await supabaseAnon
    .from('alocacoes_escala')
    .insert({ status: 'pendente', data_escala: new Date().toISOString().split('T')[0] })
    .select('id');

  console.log('\n3. INSERT (simulado, sem cascade):');
  if (insertError) {
    console.log('   BLOQUEADO:', insertError.message);
  } else {
    console.log('   APROVADO (PERIGO) — INSERT permitido como anon');
  }

  console.log('\n=== FIM DO TESTE ANÔNIMO ===');
})().catch(e => { console.error(e); process.exit(1); });
