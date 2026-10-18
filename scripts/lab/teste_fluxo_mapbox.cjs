const { createClient } = require('@supabase/supabase-js');
const { guardHarness } = require("../_guard.cjs");

// TMS-FIN-DATA-04D3C3B2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/lab/teste_fluxo_mapbox.cjs");


const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testeFluxoCompleto() {
  console.log('=== TESTE FLUXO COMPLETO MAPBOX + VALOR ===\n');
  
  const origem = 'Av. Paulista, 1000 - São Paulo - SP';
  const destino = 'Aeroporto de Congonhas - São Paulo - SP';
  const tipoVeiculo = 'van';
  const distanciaKm = 15.5;
  
  console.log('1. Dados do teste:');
  console.log('   Origem:', origem);
  console.log('   Destino:', destino);
  console.log('   Tipo Veículo:', tipoVeiculo);
  console.log('   Distância:', distanciaKm, 'km');
  
  console.log('\n2. Verificando tabelas_valores...');
  const { data: tv, error: eTV } = await supabase.from('tabelas_valores').select('*').limit(1);
  console.log('tabelas_valores:', eTV?.message || (tv ? 'EXISTE' : 'NÃO EXISTE'));
  
  if (!eTV && tv) {
    console.log('\n3. Buscando tabela de valores...');
    const { data: tabela } = await supabase
      .from('tabelas_valores')
      .select('*')
      .eq('tipo_veiculo', tipoVeiculo)
      .eq('ativo', true)
      .lte('km_inicial', distanciaKm)
      .gte('km_final', distanciaKm)
      .limit(1);
    
    console.log('Tabela encontrada:', tabela?.[0] || 'NENHUMA');
    
    if (tabela?.[0]) {
      const t = tabela[0];
      const valorCalc = Math.max(t.valor_base + (distanciaKm * t.valor_km), t.valor_minimo);
      console.log('Cálculo:', t.valor_base, '+ (', distanciaKm, '*', t.valor_km, ') =', valorCalc);
      console.log('VALOR CALCULADO:', valorCalc);
    }
  }
  
  console.log('\n4. Criando OS teste...');
  const novaOS = {
    numero: `OS-MAP-${Date.now()}`,
    data: new Date().toISOString().split('T')[0],
    status: 'rascunho',
    tipo_operacao: 'coleta_entrega',
    veiculo_tipo: tipoVeiculo,
    distancia_rota: distanciaKm,
    valor_cliente: 0,
    enderecos: JSON.stringify([
      { tipo: 'coleta', endereco: origem },
      { tipo: 'entrega', endereco: destino }
    ])
  };
  
  const { data: OSInsert, error: eOS } = await supabase.from('ordens_servico').insert(novaOS).select().single();
  console.log('OS inserida:', OSInsert?.id || eOS?.message);
  
  console.log('\n5. Atualizando valor_cliente...');
  let valorCliente = 243;
  if (!eTV && tv) {
    const tabela = await supabase.from('tabelas_valores').select('*').eq('tipo_veiculo', tipoVeiculo).eq('ativo', true).lte('km_inicial', distanciaKm).gte('km_final', distanciaKm).limit(1);
    if (tabela?.data?.[0]) {
      const t = tabela.data[0];
      valorCliente = Math.max(t.valor_base + (distanciaKm * t.valor_km), t.valor_minimo);
    }
  }
  
  const { data: OSUpdate, error: eUpdate } = await supabase
    .from('ordens_servico')
    .update({ valor_cliente: valorCliente })
    .eq('id', OSInsert?.id)
    .select()
    .single();
  
  console.log('VALOR CLIENTE atualizado:', OSUpdate?.valor_cliente);
  
  console.log('\n6. SELECT após salvar...');
  const { data: OSSelect } = await supabase
    .from('ordens_servico')
    .select('numero, distancia_rota, valor_cliente, veiculo_tipo, enderecos')
    .eq('id', OSSelect?.id || OSInsert?.id)
    .single();
  
  console.log('DADOS FINAIS:', JSON.stringify(OSSelect, null, 2));
  
  console.log('\n=== RELATÓRIO ===');
  console.log('ORIGEM:', origem);
  console.log('DESTINO:', destino);
  console.log('DISTÂNCIA:', distanciaKm, 'km');
  console.log('TIPO VEÍCULO:', tipoVeiculo);
  console.log('VALOR:', valorCliente);
  console.log('SUPABASE:', eOS?.message || 'SEM ERRO');
}

testeFluxoCompleto().catch(e => console.log('ERRO:', e.message));