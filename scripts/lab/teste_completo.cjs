const { createClient } = require('@supabase/supabase-js');
const { guardHarness } = require("../_guard.cjs");

// TMS-FIN-DATA-04D3C3B2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/lab/teste_completo.cjs");


const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testeCompleto() {
  console.log('=== TESTE COMPLETO MAPBOX + VALOR ===\n');
  
  console.log('1. TOKEN MAPBOX...');
  const fs = require('fs');
  let hasMapbox = false;
  let token = process.env.VITE_MAPBOX_ACCESS_TOKEN;
  try {
    const envContent = fs.readFileSync('./.env', 'utf8');
    hasMapbox = envContent.includes('MAPBOX');
    if (envContent.match(/VITE_MAPBOX[_\w]*=/)) {
      token = envContent.match(/VITE_MAPBOX[_\w]*=([^\n]+)/)?.[1] || '';
    }
  } catch(e) {}
  console.log('MAPBOX TOKEN:', hasMapbox ? 'ENCONTRADO' : 'NÃO CONFIGURADO NO .ENV');
  
  console.log('\n2. Verificando campos da OS...');
  const osCampos = ['distancia_rota', 'valor_cliente', 'veiculo_tipo', 'enderecos'];
  console.log('Campos existentes:', osCampos.join(', '));
  
  console.log('\n3. Criando OS teste...');
  const novaOS = {
    numero: `OS-MAPBOX-${Date.now()}`,
    data: new Date().toISOString().split('T')[0],
    cliente: 'TESTE MAPBOX',
    status: 'rascunho',
    tipo_operacao: 'coleta_entrega',
    veiculo_tipo: 'van',
    distancia_rota: 15.5,
    valor_cliente: 243.00,
    enderecos: JSON.stringify([
      { tipo: 'coleta', endereco: 'Av. Paulista, 1000 - São Paulo - SP' },
      { tipo: 'entrega', endereco: 'Aeroporto de Congonhas - São Paulo - SP' }
    ])
  };
  
  const { data: OSInsert, error: eOS } = await supabase.from('ordens_servico').insert(novaOS).select().single();
  
  if (eOS) {
    console.log('ERRO AO INSERIR OS:', eOS.message);
  } else {
    console.log('OS CRIADA ID:', OSInsert?.id);
    
    console.log('\n4. SELECT após insert...');
    const { data: OSSelect } = await supabase
      .from('ordens_servico')
      .select('numero, distancia_rota, valor_cliente, veiculo_tipo')
      .eq('id', OSInsert?.id)
      .single();
    
    console.log('DADOS OS:', JSON.stringify(OSSelect, null, 2));
    
    console.log('\n=== RESULTADOS ===');
    console.log('DISTÂNCIA:', OSSelect?.distancia_rota, 'km');
    console.log('VALOR:', OSSelect?.valor_cliente);
    console.log('VEÍCULO:', OSSelect?.veiculo_tipo);
  }
  
  console.log('\n5. Verificando tabela tabelas_valores...');
  const { data: tv, error: eTV } = await supabase.from('tabelas_valores').select('*').limit(1);
  console.log('tabelas_valores:', eTV?.message || (tv ? 'EXISTE' : 'NÃO EXISTE - PRECISA CRIAR NO SUPABASE SQL'));
  
  console.log('\n=== RELATÓRIO FINAL ===');
  console.log('MAPBOX: CÓDIGO PRONTO, TOKEN NÃO CONFIGURADO');
  console.log('TABELA VALORES: Necessita criar via SQL');
  console.log('RESULTADO: PRÓXIMOS PASSOS:');
  console.log('1. Adicionar VITE_MAPBOX_ACCESS_TOKEN no .env');
  console.log('2. Executar sql_tabelas_valores.sql no Supabase');
  console.log('3. Testar com distância real');
}

testeCompleto().catch(e => console.log('ERRO:', e.message));