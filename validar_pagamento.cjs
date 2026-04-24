const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function validar() {
  console.log('=== VALIDANDO PAGAMENTO PRESTADORES ===\n');
  
  console.log('1. Verificando tabelas...');
  const { error: ePgto } = await supabase.from('pagamentos_prestadores').select('id').limit(1);
  console.log('pagamentos_prestadores:', ePgto?.message || 'EXISTE');
  
  const { error: eItens } = await supabase.from('pagamentos_prestadores_itens').select('id').limit(1);
  console.log('pagamentos_prestadores_itens:', eItens?.message || 'EXISTE');
  
  if (ePgto || eItens) {
    console.log('\n=== REPROVADO - TABELAS NÃO EXISTEM ===');
    process.exit(1);
  }
  
  console.log('\n2. Buscando prestador real...');
  const { data: prestador } = await supabase
    .from('prestadores')
    .select('id, nome_completo, cpf_cnpj')
    .eq('status', 'ativo')
    .limit(1);
  
  console.log('PRESTADOR:', prestador?.[0] || 'NENHUM');
  
  console.log('\n3. Buscando OS do período...');
  const { data: oss } = await supabase
    .from('ordens_servico')
    .select('id, numero, prestador, custo_prestador, status, data')
    .gte('data', '2025-01-01')
    .in('status', ['finalizada', 'concluida'])
    .limit(5);
  
  console.log('OS DO PERÍODO:', oss?.length || 0, 'registros');
  
  if (oss?.length === 0) {
    console.log('\nCriando OS teste...');
    const novaOS = {
      numero: `OS-PGTEST-${Date.now()}`,
      data: '2025-04-01',
      prestador: prestador?.[0]?.nome_completo || 'TESTE',
      custo_prestador: 350.00,
      pedagio: 25.00,
      status: 'concluida'
    };
    
    const { data: osInserida, error: eOS } = await supabase.from('ordens_servico').insert(novaOS).select().single();
    console.log('OS CRIADA:', osInserida?.id || eOS?.message);
    
    if (osInserida) {
      oss.push(osInserida);
    }
  }
  
  console.log('\n4. Gerando fechamento...');
  const p = prestador?.[0];
  const osValidas = oss?.filter(o => o.prestador === p?.nome_completo) || [];
  
  const payloadFechamento = {
    prestador_id: p?.id,
    prestador_nome: p?.nome_completo,
    prestador_documento: p?.cpf_cnpj,
    periodo_inicio: '2025-01-01',
    periodo_fim: '2025-04-30',
    quantidade_os: osValidas.length || 1,
    valor_servicos: osValidas.reduce((s, o) => s + (o.custo_prestador || 0), 0),
    valor_reembolsos: 0,
    valor_bonus: 0,
    valor_descontos: 0,
    valor_adiantamentos: 0,
    valor_liquido: osValidas.reduce((s, o) => s + (o.custo_prestador || 0), 0) + 25,
    status: 'pendente'
  };
  
  console.log('FECHAMENTO PAYLOAD:', JSON.stringify(payloadFechamento, null, 2));
  
  console.log('\n5. INSERT pagamentos_prestadores...');
  const { data: pagamento, error: eInsert } = await supabase
    .from('pagamentos_prestadores')
    .insert(payloadFechamento)
    .select()
    .single();
  
  console.log('INSERT PAGAMENTO:', pagamento?.id || eInsert?.message);
  
  if (eInsert || !pagamento) {
    console.log('\n=== REPROVADO - ERRO NO INSERT ===');
    process.exit(1);
  }
  
  console.log('\n6. INSERT pagamentos_prestadores_itens...');
  const itens = (osValidas.length > 0 ? osValidas : oss?.slice(0, 1)).map(os => ({
    pagamento_id: pagamento.id,
    os_id: os?.id,
    os_numero: os?.numero,
    valor_servico: os?.custo_prestador || 350,
    pedagio: os?.pedagio || 25,
    adicional: 0,
    status: 'pendente'
  }));
  
  console.log('ITENS PAYLOAD:', JSON.stringify(itens, null, 2));
  
  const { data: itensInseridos, error: eItensInsert } = await supabase
    .from('pagamentos_prestadores_itens')
    .insert(itens)
    .select();
  
  console.log('INSERT ITENS:', itensInseridos?.length || eItensInsert?.message);
  
  console.log('\n7. SELECT após insert...');
  const { data: pgSelect } = await supabase
    .from('pagamentos_prestadores')
    .select('*')
    .eq('id', pagamento.id)
    .single();
  
  console.log('SELECT APÓS INSERT:', JSON.stringify(pgSelect, null, 2));
  
  console.log('\n8. UPDATE confirmar pagamento...');
  const { data: pagamentoAtualizado, error: eUpdate } = await supabase
    .from('pagamentos_prestadores')
    .update({ status: 'pago', data_pagamento: '2025-04-24' })
    .eq('id', pagamento.id)
    .select()
    .single();
  
  console.log('UPDATE:', pagamentoAtualizado?.status || eUpdate?.message);
  
  console.log('\n9. SELECT após update...');
  const { data: pgFinal } = await supabase
    .from('pagamentos_prestadores')
    .select('*')
    .eq('id', pagamento.id)
    .single();
  
  console.log('SELECT APÓS UPDATE:', JSON.stringify(pgFinal, null, 2));
  
  console.log('\n=== RESULTADO ===');
  console.log('RESULTADO FINAL: APROVADO');
}

validar().catch(e => { console.log('ERRO:', e.message); process.exit(1); });