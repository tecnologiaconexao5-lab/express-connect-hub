process.env.VITE_SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';
process.env.PLAYWRIGHT_TAMIRIS_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || 'Conexao@2026';

const OS_ID = '71e61468-af09-42e6-8d7e-e4624d9b1468';

async function main() {
  // Import service
  const mod = await import('../src/lib/supabase');
  const { supabase } = mod;

  // Authenticate
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tamiris.castilho@conexaoexpress.com.br',
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD
  });
  if (authErr || !auth?.session) { console.log('FALHA_AUTH:', authErr?.message); process.exit(1); }
  console.log('Autenticado');

  // ═══ CAPTURA PRE-IDEMPOTENCIA ═══
  console.log('\n=== CAPTURA PRE-IDEMPOTENCIA ===');

  // 1. Composição
  const cPre = await supabase.from('composicao_financeira_os').select('*').eq('os_id', OS_ID);
  console.log(`Composicoes: ${cPre.data?.length || 0}`);
  const compPre = cPre.data?.[0];
  console.log(`ID: ${compPre?.id}`);
  console.log(`created_at: ${compPre?.created_at}`);
  console.log(`valor_cliente: ${compPre?.valor_cliente}`);
  console.log(`margem_liquida: ${compPre?.margem_liquida}`);

  // 2. Financeiro Receber
  const frPre = await supabase.from('financeiro_receber').select('id, valor, status, updated_at').eq('os_id', OS_ID);
  console.log(`\nFinanceiro Receber: ${frPre.data?.length || 0}`);
  console.log(`ID: ${frPre.data?.[0]?.id}, status: ${frPre.data?.[0]?.status}`);

  // 3. Financeiro Pagar
  const fpPre = await supabase.from('financeiro_pagar').select('id, valor, status, updated_at').eq('os_id', OS_ID);
  console.log(`\nFinanceiro Pagar: ${fpPre.data?.length || 0}`);
  console.log(`ID: ${fpPre.data?.[0]?.id}, status: ${fpPre.data?.[0]?.status}`);

  // 4. Pagamentos Prestadores
  const ppPre = await supabase.from('pagamentos_prestadores').select('id, valor_liquido, competencia, updated_at').eq('os_id', OS_ID);
  console.log(`\nPagamentos Prestadores: ${ppPre.data?.length || 0}`);
  console.log(`ID: ${ppPre.data?.[0]?.id}, valor_liquido: ${ppPre.data?.[0]?.valor_liquido}`);

  // 5. OS
  const osPre = await supabase.from('ordens_servico').select('status, updated_at').eq('id', OS_ID).single();
  console.log(`\nOS status: ${osPre.data?.status}`);
  console.log(`OS updated_at: ${osPre.data?.updated_at}`);

  // ═══ EXECUTAR finalizarOrdemServico() NOVAMENTE ═══
  console.log('\n=== RE-EXECUTANDO finalizarOrdemServico() ===');
  const { finalizarOrdemServico } = await import('../src/services/ordemServicoService');
  const resultado = await finalizarOrdemServico(OS_ID);
  console.log('Resultado:', JSON.stringify(resultado, null, 2));

  if (resultado.success) {
    console.log('✅ Execucao retornou success=true');
  } else {
    console.log('❌ Execucao retornou success=false:', resultado.erro);
  }

  // ═══ CAPTURA POS-IDEMPOTENCIA ═══
  console.log('\n=== CAPTURA POS-IDEMPOTENCIA ===');

  // 1. Composição
  const cPos = await supabase.from('composicao_financeira_os').select('*').eq('os_id', OS_ID);
  console.log(`Composicoes: ${cPos.data?.length || 0}`);
  const compPos = cPos.data?.[0];
  console.log(`ID: ${compPos?.id}`);
  console.log(`created_at: ${compPos?.created_at}`);
  console.log(`valor_cliente: ${compPos?.valor_cliente}`);
  console.log(`margem_liquida: ${compPos?.margem_liquida}`);

  // 2. Financeiro Receber
  const frPos = await supabase.from('financeiro_receber').select('id, valor, status, updated_at').eq('os_id', OS_ID);
  console.log(`\nFinanceiro Receber: ${frPos.data?.length || 0}`);

  // 3. Financeiro Pagar
  const fpPos = await supabase.from('financeiro_pagar').select('id, valor, status, updated_at').eq('os_id', OS_ID);
  console.log(`\nFinanceiro Pagar: ${fpPos.data?.length || 0}`);

  // 4. Pagamentos Prestadores
  const ppPos = await supabase.from('pagamentos_prestadores').select('id, valor_liquido, competencia, updated_at').eq('os_id', OS_ID);
  console.log(`\nPagamentos Prestadores: ${ppPos.data?.length || 0}`);

  // ═══ VALIDACOES ═══
  console.log('\n' + '='.repeat(60));
  console.log('VALIDACOES DE IDEMPOTENCIA:');
  console.log('='.repeat(60));

  const results: { check: string; esperado: string; obtido: string; resultado: string }[] = [];

  // 1. Composição: 1 registro (mesmo ID, mesmo created_at)
  const compCountOk = (cPos.data?.length || 0) === 1 && (cPre.data?.length || 0) === 1;
  results.push({
    check: 'composicao: 1 registro',
    esperado: '1',
    obtido: String(cPos.data?.length || 0),
    resultado: compCountOk ? '✅' : '❌'
  });

  const compIdOk = compPos?.id === compPre?.id;
  results.push({
    check: 'composicao: mesmo ID',
    esperado: compPre?.id || '',
    obtido: compPos?.id || '',
    resultado: compIdOk ? '✅' : '❌'
  });

  const compCreatedAtOk = compPos?.created_at === compPre?.created_at;
  results.push({
    check: 'composicao: created_at inalterado',
    esperado: compPre?.created_at || '',
    obtido: compPos?.created_at || '',
    resultado: compCreatedAtOk ? '✅' : '❌'
  });

  const compValuesOk = compPos?.valor_cliente === 3000 && compPos?.margem_liquida === 1085;
  results.push({
    check: 'composicao: valores inalterados',
    esperado: 'valor=3000, margem_liquida=1085',
    obtido: `valor=${compPos?.valor_cliente}, ml=${compPos?.margem_liquida}`,
    resultado: compValuesOk ? '✅' : '❌'
  });

  // 2. Financeiro
  const frCountOk = (frPos.data?.length || 0) === 1 && (frPre.data?.length || 0) === 1;
  results.push({
    check: 'financeiro_receber: 1 registro',
    esperado: '1',
    obtido: String(frPos.data?.length || 0),
    resultado: frCountOk ? '✅' : '❌'
  });

  const fpCountOk = (fpPos.data?.length || 0) === 1 && (fpPre.data?.length || 0) === 1;
  results.push({
    check: 'financeiro_pagar: 1 registro',
    esperado: '1',
    obtido: String(fpPos.data?.length || 0),
    resultado: fpCountOk ? '✅' : '❌'
  });

  const ppCountOk = (ppPos.data?.length || 0) === 1 && (ppPre.data?.length || 0) === 1;
  results.push({
    check: 'pagamentos_prestadores: 1 registro',
    esperado: '1',
    obtido: String(ppPos.data?.length || 0),
    resultado: ppCountOk ? '✅' : '❌'
  });

  const frValOk = frPos.data?.[0]?.valor === 3000;
  results.push({
    check: 'financeiro_receber: valor=3000',
    esperado: '3000',
    obtido: String(frPos.data?.[0]?.valor),
    resultado: frValOk ? '✅' : '❌'
  });

  const fpValOk = fpPos.data?.[0]?.valor === 1500;
  results.push({
    check: 'financeiro_pagar: valor=1500',
    esperado: '1500',
    obtido: String(fpPos.data?.[0]?.valor),
    resultado: fpValOk ? '✅' : '❌'
  });

  const ppValOk = ppPos.data?.[0]?.valor_liquido === 1750;
  results.push({
    check: 'pagamentos_prestadores: valor_liquido=1750',
    esperado: '1750',
    obtido: String(ppPos.data?.[0]?.valor_liquido),
    resultado: ppValOk ? '✅' : '❌'
  });

  // 3. Nenhuma nova conta
  const noNewRecords = (frPos.data?.length || 0) <= 1 && (fpPos.data?.length || 0) <= 1 && (ppPos.data?.length || 0) <= 1;
  results.push({
    check: 'nenhuma nova conta criada',
    esperado: '≤1 cada',
    obtido: `fr=${frPos.data?.length || 0}, fp=${fpPos.data?.length || 0}, pp=${ppPos.data?.length || 0}`,
    resultado: noNewRecords ? '✅' : '❌'
  });

  // Print table
  console.log('\n  | Check                                         | Esperado                 | Obtido                    | Resultado |');
  console.log('  |' + '-'.repeat(46) + '|' + '-'.repeat(26) + '|' + '-'.repeat(26) + '|' + '-'.repeat(10) + '|');
  for (const r of results) {
    const check = r.check.padEnd(46).slice(0, 46);
    const esp = r.esperado.padEnd(26).slice(0, 26);
    const obt = r.obtido.padEnd(26).slice(0, 26);
    console.log(`  | ${check}| ${esp}| ${obt}|   ${r.resultado}   |`);
  }

  const pass = results.filter(r => r.resultado === '✅').length;
  const fail = results.filter(r => r.resultado === '❌').length;
  console.log(`\n  RESUMO: ${pass}/${results.length} ✅ | ${fail} ❌`);
  console.log('\n' + '='.repeat(60));
  console.log(`  FASE B2 CONCLUIDA`);
  console.log('='.repeat(60));
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
