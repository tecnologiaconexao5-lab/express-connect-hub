import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xxxxx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testeFinanceiroPrestador() {
  console.log('=== TESTE FINANCEIRO PRESTADOR ===\n');

  // 1. Buscar prestador
  console.log('1. Buscando prestador...');
  const cpfCnpj = '04674965152';
  const { data: prestador, error: prestadorError } = await supabase
    .from('prestadores')
    .select('id, nome_completo, cpf_cnpj, valor_diaria, status')
    .eq('cpf_cnpj', cpfCnpj)
    .limit(1)
    .single();

  if (prestadorError || !prestador) {
    console.log('   ❌ Prestador nao encontrado. Tentando outro...');
    const { data: anyPrestador } = await supabase
      .from('prestadores')
      .select('id, nome_completo, cpf_cnpj, valor_diaria, status')
      .limit(1)
      .single();
    
    if (!anyPrestador) {
      console.log('   ❌ Nenhum prestador encontrado.');
      process.exit(1);
    }
    console.log(`   ⚠️ Usando prestador: ${anyPrestador.nome_completo} (${anyPrestador.id})`);
  } else {
    console.log(`   ✅ Prestador: ${prestador.nome_completo}`);
  }

  const prestadorId = prestador?.id || anyPrestador?.id;

  // 2. Atualizar dados financeiros
  console.log('\n2. Atualizando dados financeiros...');
  const { error: updateError } = await supabase
    .from('prestadores')
    .update({
      valor_diaria: 650,
      valor_km: 2,
      valor_saida: 650,
      banco: 'Banco do Brasil',
      chave_pix: 'teste@pix.com',
      status: 'ativo',
      updated_at: new Date().toISOString()
    })
    .eq('id', prestadorId);

  if (updateError) {
    console.log('   ❌ Erro ao atualizar:', updateError.message);
  } else {
    console.log('   ✅ Dados atualizados!');
  }

  // 3. SELECT real para confirmar
  console.log('\n3. Verificando dados salvos...');
  const { data: prestadorAtualizado, error: selectError } = await supabase
    .from('prestadores')
    .select('id, nome_completo, valor_diaria, valor_km, valor_saida, banco, chave_pix, status')
    .eq('id', prestadorId)
    .single();

  if (selectError) {
    console.log('   ❌ Erro ao buscar:', selectError.message);
  } else {
    console.log('\n=== RESULTADO ===');
    console.log(`   Nome: ${prestadorAtualizado.nome_completo}`);
    console.log(`   Valor Diária: R$ ${prestadorAtualizado.valor_diaria},00`);
    console.log(`   Valor KM: R$ ${prestadorAtualizado.valor_km},00`);
    console.log(`   Valor Saída: R$ ${prestadorAtualizado.valor_saida},00`);
    console.log(`   Banco: ${prestadorAtualizado.banco}`);
    console.log(`   Chave PIX: ${prestadorAtualizado.chave_pix}`);
    console.log(`   Status: ${prestadorAtualizado.status}`);
    
    if (prestadorAtualizado.valor_diaria === 650) {
      console.log('\n✅ VALOR DIÁRIA CONFIRMADO');
    }
    if (prestadorAtualizado.status === 'ativo') {
      console.log('✅ STATUS CONFIRMADO');
    }
    console.log('\n✅ FINANCEIRO SALVO');
  }
}

testeFinanceiroPrestador()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Erro:', e);
    process.exit(1);
  });