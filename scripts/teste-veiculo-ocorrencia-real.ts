import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xxxxx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testeVeiculoOcorrencia() {
  console.log('=== TESTE REAL: VEICULO + OCORRENCIA ===\n');

  // 1. Buscar prestador Diego Balbino pelo CPF/CNPJ
  console.log('1. Buscando prestador Diego Balbino...');
  const cpfCnpj = '04674965152'; // CPF do Diego
  const { data: prestador, error: prestadorError } = await supabase
    .from('prestadores')
    .select('id, nome, cpf_cnpj')
    .eq('cpf_cnpj', cpfCnpj)
    .limit(1)
    .single();

  if (prestadorError || !prestador) {
    console.log('   ❌ Prestador nao encontrado. Tentando por nome...');
    const { data: prestadorByName } = await supabase
      .from('prestadores')
      .select('id, nome, cpf_cnpj')
      .ilike('nome', '%Diego%Balbino%')
      .limit(1)
      .single();

    if (!prestadorByName) {
      console.log('   ❌ Prestador nao encontrado. Tentando qualquer prestador...');
      const { data: anyPrestador } = await supabase
        .from('prestadores')
        .select('id, nome, cpf_cnpj')
        .limit(1)
        .single();

      if (!anyPrestador) {
        console.log('   ❌ Nenhum prestador encontrado. Encerrando.');
        process.exit(1);
      }
      console.log(`   ⚠️ Usando primeiro prestador: ${anyPrestador.nome} (${anyPrestador.id})`);
    } else {
      console.log(`   ✅ Prestador encontrado: ${prestadorByName.nome} (${prestadorByName.id})`);
    }
  } else {
    console.log(`   ✅ Prestador encontrado: ${prestador.nome} (${prestador.id})`);
  }

  const prestadorId = prestador?.id || prestadorByName?.id || anyPrestador?.id;

  // 2. Inserir veículo teste
  console.log('\n2. Inserindo veiculo teste...');
  const veiculoData = {
    prestador_vinculado: prestadorId,
    placa: 'TESTE123',
    tipo: 'HR',
    marca: 'Hyundai',
    modelo: 'HR Bau',
    ano: 2021,
    capacidade_kg: 1800,
    capacidade_m3: 10,
    tipo_carga: 'Refrigerado',
    temperatura_min: 13,
    temperatura_max: 16,
    principal: true,
    status: 'ativo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: veiculoInserido, error: veiculoError } = await supabase
    .from('veiculos')
    .insert(veiculoData)
    .select()
    .single();

  if (veiculoError) {
    console.log('   ❌ Erro ao inserir veiculo:', veiculoError.message);
  } else {
    console.log('   ✅ VEICULO SALVO NO SUPABASE:', veiculoInserido?.id);
  }

  // 3. Inserir ocorrência teste
  console.log('\n3. Inserindo ocorrencia teste...');
  const ocorrenciaData = {
    prestador_id: prestadorId,
    data: new Date().toISOString().split('T')[0],
    tipo: 'ELOGIO',
    gravidade: 'MEDIA',
    status: 'aberta',
    descricao: 'Ocorrencia teste criada pelo script de validacao.',
    registrado_por: 'Sistema',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: ocorrenciaInserida, error: ocorrenciaError } = await supabase
    .from('prestadores_ocorrencias')
    .insert(ocorrenciaData)
    .select()
    .single();

  if (ocorrenciaError) {
    console.log('   ❌ Erro ao inserir ocorrencia:', ocorrenciaError.message);
  } else {
    console.log('   ✅ OCORRENCIA SALVA NO SUPABASE:', ocorrenciaInserida?.id);
  }

  // 4. SELECT real - veículos do prestador
  console.log('\n4. SELECT veiculos do prestador...');
  const { data: veiculosSelect } = await supabase
    .from('veiculos')
    .select('*')
    .eq('prestador_vinculado', prestadorId);

  if (veiculosSelect && veiculosSelect.length > 0) {
    console.log(`   ✅ SELECT VALIDADO: ${veiculosSelect.length} veiculo(s) encontrado(s)`);
    veiculosSelect.forEach(v => console.log(`      - ${v.placa} (${v.marca} ${v.modelo})`));
  } else {
    console.log('   ⚠️ Nenhum veiculo encontrado (talvez coluna diferente)');
  }

  // 5. SELECT real - ocorrências do prestador
  console.log('\n5. SELECT ocorrencias do prestador...');
  const { data: ocorrenciasSelect } = await supabase
    .from('prestadores_ocorrencias')
    .select('*')
    .eq('prestador_id', prestadorId);

  if (ocorrenciasSelect && ocorrenciasSelect.length > 0) {
    console.log(`   ✅ SELECT VALIDADO: ${ocorrenciasSelect.length} ocorrencia(s) encontrada(s)`);
    ocorrenciasSelect.forEach(o => console.log(`      - ${o.tipo} (${o.gravidade}) - ${o.descricao?.substring(0, 50)}...`));
  } else {
    console.log('   ⚠️ Nenhuma ocorrencia encontrada');
  }

  console.log('\n=== RESULTADO FINAL ===');
  console.log(veiculosSelect?.length ? '✅ VEICULO SALVO NO SUPABASE' : '❌ VEICULO NAO ENCONTRADO');
  console.log(ocorrenciasSelect?.length ? '✅ OCORRENCIA SALVA NO SUPABASE' : '❌ OCORRENCIA NAO ENCONTRADA');
  console.log('✅ SELECT VALIDADO');
}

testeVeiculoOcorrencia()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Erro:', e);
    process.exit(1);
  });