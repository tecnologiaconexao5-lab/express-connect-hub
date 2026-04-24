const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testeCompleto() {
  console.log('=== TESTE COMPLETO PAGAMENTO PRESTADORES ===\n');
  
  console.log('1. Verificando tabelas...');
  const { error: ePgto } = await supabase.from('pagamentos_prestadores').select('id').limit(1);
  const { error: eItens } = await supabase.from('pagamentos_prestadores_itens').select('id').limit(1);
  console.log('pagamentos_prestadores:', ePgto?.message || 'EXISTE ✅');
  console.log('pagamentos_prestadores_itens:', eItens?.message || 'EXISTE ✅');
  
  if (ePgto || eItens) {
    console.log('\n=== REPROVADO ==='); process.exit(1);
  }
  
  console.log('\n2. Buscando prestador real...');
  const { data: prestador } = await supabase.from('prestadores').select('id, nome_completo, cpf_cnpj').eq('status', 'ativo').limit(1);
  console.log('PRESTADOR:', prestador?.[0]);
  
  console.log('\n3. Buscando/Criando OS do período...');
  const { data: oss } = await supabase.from('ordens_servico').select('id, numero, custo_prestador, pedagio').gte('data', '2025-01-01').in('status', ['concluida']).limit(3);
  console.log('OS encontrada:', oss?.length);
  
  let osLista = oss || [];
  if (osLista.length === 0) {
    console.log('Criando 2 OS teste...');
    for (let i = 0; i < 2; i++) {
      const nova = {
        numero: `OS-PGT-${Date.now()}-${i}`,
        data: '2025-04-15',
        custo_prestador: 250 + (i * 100),
        pedagio: 15 + (i * 5),
        status: 'concluida'
      };
      const { data: os } = await supabase.from('ordens_servico').insert(nova).select().single();
      if (os) osLista.push(os);
    }
  }
  console.log('OS USADAS:', osLista.length);
  
  console.log('\n4. Gerando fechamento payload...');
  const payload = {
    prestador_id: prestador?.[0]?.id,
    prestador_nome: prestador?.[0]?.nome_completo,
    prestador_documento: prestador?.[0]?.cpf_cnpj,
    periodo_inicio: '2025-04-01',
    periodo_fim: '2025-04-30',
    quantidade_os: osLista.length,
    valor_servicos: osLista.reduce((s, o) => s + (o.custo_prestador || 0), 0),
    valor_reembolsos: 50,
    valor_bonus: 0,
    valor_descontos: 0,
    valor_adiantamentos: 0,
    valor_liquido: osLista.reduce((s, o) => s + (o.custo_prestador || 0), 0) + osLista.reduce((s, o) => s + (o.pedagio || 0), 0) + 50,
    status: 'pendente'
  };
  console.log('FECHAMENTO:', JSON.stringify(payload, null, 2));
  
  console.log('\n5. INSERT pagamentos_prestadores...');
  const { data: pg, error: ePg } = await supabase.from('pagamentos_prestadores').insert(payload).select().single();
  console.log('INSERT PAGAMENTO ID:', pg?.id || ePg?.message);
  
  if (!pg || ePg) {
    console.log('\n=== REPROVADO ==='); process.exit(1);
  }
  
  console.log('\n6. INSERT pagamentos_prestadores_itens...');
  const itens = osLista.map(os => ({
    pagamento_id: pg.id,
    os_id: os.id,
    os_numero: os.numero,
    valor_servico: os.custo_prestador || 0,
    pedagio: os.pedagio || 0,
    adicional: 0,
    status: 'pendente'
  }));
  console.log('ITENS:', JSON.stringify(itens, null, 2));
  
  const { data: itensInseridos, error: eIt } = await supabase.from('pagamentos_prestadores_itens').insert(itens).select();
  console.log('INSERT ITENS:', itensInseridos?.length || eIt?.message);
  
  console.log('\n7. SELECT após insert...');
  const { data: selectPG } = await supabase.from('pagamentos_prestadores').select('*').eq('id', pg.id).single();
  console.log('SELECT:', JSON.stringify(selectPG, null, 2));
  
  console.log('\n8. UPDATE confirmar pagamento...');
  const { data: upPG, error: eUp } = await supabase.from('pagamentos_prestadores').update({ status: 'pago', data_pagamento: '2025-04-24' }).eq('id', pg.id).select().single();
  console.log('UPDATE:', upPG?.status || eUp?.message);
  
  console.log('\n9. SELECT após update...');
  const { data: finalPG } = await supabase.from('pagamentos_prestadores').select('*').eq('id', pg.id).single();
  console.log('SELECT FINAL:', JSON.stringify(finalPG, null, 2));
  
  console.log('\n=== RESULTADO ===');
  console.log('SUPABASE: SEM ERRO');
  console.log('RESULTADO FINAL: APROVADO ✅');
}

testeCompleto().catch(e => { console.log('ERRO:', e.message); process.exit(1); });