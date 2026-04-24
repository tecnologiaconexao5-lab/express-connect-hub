const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testar() {
  console.log('=== TESTE REAL DE PERSISTÊNCIA - PAGAMENTO PRESTADORES ===\n');
  
  console.log('1. Buscando prestadores ativos...');
  const { data: prestadores, error: e1 } = await supabase
    .from('prestadores')
    .select('id, nome_completo, cpf_cnpj')
    .eq('status', 'ativo')
    .limit(3);
  
  if (e1) { console.log('ERRO prestadores:', e1); process.exit(1); }
  console.log('PRESTADORES:', JSON.stringify(prestadores, null, 2));
  
  console.log('\n2. Buscando OS do período recente...');
  const { data: oss, error: e2 } = await supabase
    .from('ordens_servico')
    .select('id, numero, prestador, custo_prestador, pedagio, adicionais, data')
    .gte('data', '2025-01-01')
    .in('status', ['finalizada', 'concluida'])
    .limit(5);
  
  if (e2) { console.log('ERRO OS:', e2); process.exit(1); }
  console.log('OS DO PERÍODO:', JSON.stringify(oss, null, 2));
  
  if (!prestadores || prestadores.length === 0) {
    console.log('\nERRO: Nenhum prestador encontrado');
    process.exit(1);
  }
  
  const prestador = prestadores[0];
  const osDoPeriodo = oss ? oss.filter(o => o.prestador === prestador.nome_completo) : [];
  
  console.log(`\n3. Gerando fechamento para ${prestador.nome_completo} com ${osDoPeriodo.length} OS`);
  
  const valorTotal = osDoPeriodo.reduce((sum, os) => sum + (os.custo_prestador || 0), 0);
  const pedagioTotal = osDoPeriodo.reduce((sum, os) => sum + (os.pedagio || 0), 0);
  
  console.log('FECHAMENTO PAYLOAD:', {
    prestador_id: prestador.id,
    prestador_nome: prestador.nome_completo,
    prestador_documento: prestador.cpf_cnpj,
    periodo_inicio: '2025-01-01',
    periodo_fim: '2025-04-30',
    quantidade_os: osDoPeriodo.length,
    valor_servicos: valorTotal,
    valor_reembolsos: 0,
    valor_bonus: 0,
    valor_descontos: 0,
    valor_adiantamentos: 0,
    valor_liquido: valorTotal + pedagioTotal,
    status: 'pendente'
  });
  
  console.log('\n4. Inserindo em pagamentos_prestadores...');
  const { data: pagamento, error: e3 } = await supabase
    .from('pagamentos_prestadores')
    .insert([{
      prestador_id: prestador.id,
      prestador_nome: prestador.nome_completo,
      prestador_documento: prestador.cpf_cnpj,
      periodo_inicio: '2025-01-01',
      periodo_fim: '2025-04-30',
      quantidade_os: osDoPeriodo.length,
      valor_servicos: valorTotal,
      valor_reembolsos: 0,
      valor_bonus: 0,
      valor_descontos: 0,
      valor_adiantamentos: 0,
      valor_liquido: valorTotal + pedagioTotal,
      status: 'pendente'
    }])
    .select()
    .single();
  
  if (e3) { console.log('ERRO INSERT:', e3); process.exit(1); }
  console.log('INSERT pagamentos_prestadores_OK:', pagamento.id);
  
  console.log('\n5. Inserindo itens do pagamento...');
  const itens = osDoPeriodo.map(os => ({
    pagamento_id: pagamento.id,
    os_id: os.id,
    os_numero: os.numero,
    valor_servico: os.custo_prestador || 0,
    pedagio: os.pedagio || 0,
    adicional: os.adicionais || 0,
    status: 'pendente'
  }));
  
  console.log('ITENS PAYLOAD:', JSON.stringify(itens, null, 2));
  
  const { data: itensInseridos, error: e4 } = await supabase
    .from('pagamentos_prestadores_itens')
    .insert(itens)
    .select();
  
  if (e4) { console.log('ERRO INSERT ITENS:', e4); process.exit(1); }
  console.log('INSERT pagamentos_prestadores_itens_OK:', itensInseridos?.length, 'itens');
  
  console.log('\n6. SELECT após insert...');
  const { data: pgBuscado, error: e5 } = await supabase
    .from('pagamentos_prestadores')
    .select('*')
    .eq('id', pagamento.id)
    .single();
  
  if (e5) { console.log('ERRO SELECT:', e5); process.exit(1); }
  console.log('SELECT APÓS INSERT:', JSON.stringify(pgBuscado, null, 2));
  
  console.log('\n7. Confirmando pagamento...');
  const { data: atualizado, error: e6 } = await supabase
    .from('pagamentos_prestadores')
    .update({ status: 'pago', data_pagamento: '2025-04-24' })
    .eq('id', pagamento.id)
    .select()
    .single();
  
  if (e6) { console.log('ERRO UPDATE:', e6); process.exit(1); }
  console.log('UPDATE CONFIRMAÇÃO_OK:', JSON.stringify(atualizado, null, 2));
  
  console.log('\n8. SELECT após confirmação...');
  const { data: pgConfirmado, error: e7 } = await supabase
    .from('pagamentos_prestadores')
    .select('*')
    .eq('id', pagamento.id)
    .single();
  
  if (e7) { console.log('ERRO SELECT FINAL:', e7); process.exit(1); }
  console.log('SELECT APÓS CONFIRMAÇÃO:', JSON.stringify(pgConfirmado, null, 2));
  
  console.log('\n=== RESULTADO: APROVADO ===');
  console.log('SUPABASE: SEM ERRO');
}

testar().catch(e => { console.log('ERRO:', e); process.exit(1); });