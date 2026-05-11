import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xxxxx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function validarSchema() {
  console.log('=== VALIDACAO DE SCHEMA ===\n');

  let erros: string[] = [];

  // Validar prestadores.rg_ie
  console.log('1. Validando prestadores.rg_ie...');
  try {
    const { data: prestadoresData, error: prestadoresError } = await supabase
      .from('prestadores')
      .select('rg_ie')
      .limit(1);

    if (prestadoresError && prestadoresError.message.includes('rg_ie')) {
      erros.push('FALTA: coluna rg_ie na tabela prestadores');
      console.log('   ❌ Coluna rg_ie NAO existe em prestadores');
    } else {
      console.log('   ✅ Coluna rg_ie existe em prestadores');
    }
  } catch (e: any) {
    if (e.message?.includes('rg_ie') || e.code === 'PGRST116') {
      erros.push('FALTA: coluna rg_ie na tabela prestadores');
      console.log('   ❌ Coluna rg_ie NAO existe em prestadores');
    }
  }

  // Validar veiculos
  console.log('\n2. Validando colunas em veiculos...');
  const colunasVeiculos = [
    'prestador_vinculado', 'placa', 'tipo', 'marca', 'modelo', 'ano',
    'renavam', 'antt', 'proprietario_nome', 'proprietario_documento',
    'capacidade_kg', 'capacidade_m3', 'comprimento_m', 'largura_m', 'altura_m',
    'tipo_carga', 'temperatura_min', 'temperatura_max', 'rastreador', 'seguro',
    'restricoes_regiao', 'observacoes', 'principal', 'status'
  ];

  for (const col of colunasVeiculos) {
    try {
      const { data, error } = await supabase
        .from('veiculos')
        .select(col)
        .limit(1);

      if (error && error.message.includes(col)) {
        console.log(`   ❌ FALTA: ${col}`);
        erros.push(`FALTA: coluna ${col} em veiculos`);
      } else {
        console.log(`   ✅ ${col}`);
      }
    } catch (e: any) {
      if (e.message?.includes(col)) {
        console.log(`   ❌ FALTA: ${col}`);
        erros.push(`FALTA: coluna ${col} em veiculos`);
      }
    }
  }

  // Validar prestadores_ocorrencias
  console.log('\n3. Validando prestadores_ocorrencias...');
  try {
    const { data: ocorrenciasData, error: ocorrenciasError } = await supabase
      .from('prestadores_ocorrencias')
      .select('id, tipo, gravidade, status')
      .limit(1);

    if (ocorrenciasError && ocorrenciasError.message.includes('does not exist')) {
      erros.push('FALTA: tabela prestadores_ocorrencias');
      console.log('   ❌ Tabela prestadores_ocorrencias NAO existe');
    } else {
      console.log('   ✅ Tabela prestadores_ocorrencias existe');
    }
  } catch (e: any) {
    if (e.message?.includes('does not exist') || e.code === 'PGRST116') {
      erros.push('FALTA: tabela prestadores_ocorrencias');
      console.log('   ❌ Tabela prestadores_ocorrencias NAO existe');
    }
  }

  console.log('\n=== RESULTADO ===');
  if (erros.length === 0) {
    console.log('✅ TODO O SCHEMA VALIDADO COM SUCESSO!');
    return true;
  } else {
    console.log(`❌ ${erros.length} ERRO(S) ENCONTRADO(S):`);
    erros.forEach(e => console.log(`   - ${e}`));
    console.log('\n Execute o SQL em: sql/migration_prestadores_veiculos_ocorrencias_fix.sql');
    return false;
  }
}

validarSchema()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Erro:', e);
    process.exit(1);
  });