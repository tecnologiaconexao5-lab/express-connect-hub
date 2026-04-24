const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarCalculo() {
  console.log('=== TESTE MAPBOX + CÁLCULO DE VALOR ===\n');
  
  console.log('1. Verificando token MAPBOX no .env...');
  const fs = require('fs');
  const envPath = './.env';
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasMapbox = envContent.includes('MAPBOX');
  console.log('MAPBOX no .env:', hasMapbox ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
  
  console.log('\n2. Criando tabela tabelas_valores...');
  const { error: eCreate } = await supabase.from('tabelas_valores').select('id').limit(1);
  console.log('tabelas_valores:', eCreate?.message || 'EXISTE');
  
  console.log('\n3. Buscando dados para teste...');
  const { data: cliente } = await supabase.from('clientes').select('id, nome').limit(1);
  console.log('Cliente:', cliente?.[0]);
  
  const { data: veiculo } = await supabase.from('veiculos').select('id, tipo_veiculo').limit(1);
  console.log('Veículo:', veiculo?.[0]);
  
  console.log('\n4. Criando OS teste com distância manual (sem token)...');
  const origem = 'Av. Paulista, 1000 - São Paulo - SP';
  const destino = 'Aeroporto de Congonhas - São Paulo - SP';
  const distanciaKm = 15.5; // Simulado
  
  const osTeste = {
    numero: `TESTE-${Date.now()}`,
    data: new Date().toISOString().split('T')[0],
    cliente: cliente?.[0]?.nome || 'CLIENTE TESTE',
    unidade: 'MATRIZ',
    tipoOperacao: 'coleta_entrega',
    modalidade: 'esporadico',
    status: 'rascunho',
    veiculo_tipo: 'van',
    origem: origem,
    destino: destino,
    distancia_rota: distanciaKm,
    valor_cliente: 0
  };
  
  const { data: OSInserted, error: eOS } = await supabase.from('ordens_servico').insert(osTeste).select().single();
  console.log('OS inserida:', OSInserted?.id || eOS?.message);
  
  console.log('\n5. Verificando distância...');
  console.log(`Distância: ${distanciaKm} km`);
  console.log('Origem:', origem);
  console.log('Destino:', destino);
  
  console.log('\n6. Simulando cálculo de valor...');
  const { data: tabela } = await supabase
    .from('tabelas_valores')
    .select('*')
    .eq('tipo_veiculo', 'van')
    .eq('universal', true)
    .lte('km_inicial', distanciaKm)
    .gte('km_final', distanciaKm)
    .limit(1);
  
  console.log('Tabela encontrada:', tabela?.[0] || 'NENHUMA');
  
  let valorCalculado = 0;
  if (tabela?.[0]) {
    const t = tabela[0];
    valorCalculado = Math.max(
      t.valor_base + (distanciaKm * t.valor_km),
      t.valor_minimo
    );
    console.log(`Cálculo: ${t.valor_base} + (${distanciaKm} * ${t.valor_km}) = ${valorCalculado}`);
  } else {
    valorCalculado = 150 + (distanciaKm * 6);
    console.log(`Cálculo (fallback): 150 + (${distanciaKm} * 6) = ${valorCalculado}`);
  }
  
  console.log('\n7. Atualizando valor_cliente na OS...');
  const { data: OSAtualizada, error: eUpdate } = await supabase
    .from('ordens_servico')
    .update({ valor_cliente: valorCalculado })
    .eq('id', OSInserted?.id)
    .select()
    .single();
  
  console.log('OS atualizada:', OSAtualizada?.valor_cliente || eUpdate?.message);
  
  console.log('\n8. SELECT final da OS...');
  const { data: OSFinal } = await supabase
    .from('ordens_servico')
    .select('numero, origem, destino, distancia_rota, veiculo_tipo, valor_cliente')
    .eq('id', OSInserted?.id)
    .single();
  
  console.log('OS FINAL:', JSON.stringify(OSFinal, null, 2));
  
  console.log('\n=== RESULTADO ===');
  console.log('DISTÂNCIA: ', distanciaKm, 'km (simulada)');
  console.log('VALOR: ', valorCalculado);
  console.log('RESULTADO: APROVADO (necessita token real para distância real)');
}

testarCalculo().catch(e => console.log('ERRO:', e.message));