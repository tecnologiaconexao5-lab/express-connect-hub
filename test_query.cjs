require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testarBusca() {
  console.log('--- TESTE SIMULADO DE BUSCA DE TABELA ---');
  
  const { data: prestador } = await supabase.from('prestadores')
    .select('id, veiculos(tipo)').ilike('nome_completo', '%franklin%').single();
  const tipoVeiculo = prestador.veiculos[0].tipo;
  console.log('Veículo do Prestador (FRANKLIN):', tipoVeiculo);
  
  const { data: cliente } = await supabase.from('clientes')
    .select('id, razao_social, nome_fantasia').ilike('razao_social', '%dvl%').single();
  console.log('Cliente Selecionado (DVL):', cliente.nome_fantasia || cliente.razao_social);
  
  const clienteId = cliente.id;
  const clienteNome = cliente.razao_social; // simulated
  
  let fantasia = clienteNome;
  if (clienteId) {
    const { data: cli } = await supabase.from('clientes').select('nome_fantasia, razao_social').eq('id', clienteId).single();
    if (cli) fantasia = cli.nome_fantasia || cli.razao_social || clienteNome;
  }
  
  const normalize = (str) => str ? str.trim().toUpperCase() : '';
  const nomeNormalizado = normalize(fantasia);
  const primeiroNome = nomeNormalizado.split(' - ')[0].trim();
  
  console.log('Busca Normalizada (primeiroNome):', primeiroNome);
  
  const { data: specificData, error: specificError } = await supabase
    .from('tabelas_valores')
    .select('nome, km_franquia, valor_km_excedente, tipo_veiculo, status, ativo')
    .ilike('cliente', `%${primeiroNome}%`)
    .eq('tipo_veiculo', tipoVeiculo);
    
  console.log('--- RESULTADO ---');
  if (specificData && specificData.length > 0) {
     console.log(`Tabela: ${specificData[0].nome}`);
     console.log(`Franquia: ${specificData[0].km_franquia} km`);
     console.log(`KM Adicional Cliente: R$ ${specificData[0].valor_km_excedente.toFixed(2)}`);
  } else {
     console.log('Nenhuma tabela encontrada');
  }
}
testarBusca();
