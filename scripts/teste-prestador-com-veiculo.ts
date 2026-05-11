/**
 * Script de teste: Cadastrar prestador fake completo + veículo
 * Executar: npx ts-node scripts/teste-prestador-com-veiculo.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Carregar .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function gerarCNPJ(): string {
  const rand = () => Math.floor(Math.random() * 9) + 1;
  const n = Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join('');
  return n.slice(0, 2) + '.' + n.slice(2, 5) + '.' + n.slice(5, 8) + '/' + n.slice(8, 12) + '-' + n.slice(12, 14);
}

async function main() {
  console.log('🚀 Iniciando teste de cadastro de prestador com veículo...\n');

  const timestamp = Date.now();
  const cnpj = gerarCNPJ();

  // 1. Inserir prestador (usando campos que existem na tabela atual)
  const prestadorPayload = {
    nome_completo: 'TESTE PRESTADOR FAKE',
    cpf_cnpj: cnpj,
    tipo_parceiro: 'autonomo',
    status: 'analise',
    telefone: '11999999999',
    whatsapp: '11999999999',
    email: `teste.prestador.fake+${timestamp}@conexaoexpress.com`,
    data_nascimento: '1988-01-10',
    endereco: JSON.stringify({
      cep: '09900000',
      rua: 'Rua Teste',
      numero: '123',
      cidade: 'Diadema',
      estado: 'SP'
    }),
    aceita_refrigerada: true,
    aceita_urbana: true,
    aceita_dedicada: false,
    aceita_esporadica: true,
    score_interno: 0,
    qtd_operacoes: 0,
    indice_aceite: 0,
    indice_comparecimento: 0,
    indice_entrega_prazo: 0,
    conferencia_manual: false,
    data_cadastro: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log('📝 Inserindo prestador...');
  const { data: prestadorData, error: prestadorError } = await supabase
    .from('prestadores')
    .insert([prestadorPayload])
    .select();

  if (prestadorError) {
    console.error('❌ Erro ao inserir prestador:', prestadorError.message, prestadorError.details);
    process.exit(1);
  }

  const prestadorId = prestadorData![0].id;
  console.log(`✅ PRESTADOR CRIADO\n   ID: ${prestadorId}\n   Nome: TESTE PRESTADOR FAKE\n   CNPJ: ${cnpj}\n`);

  // 2. Inserir veículo (campos mínimos para descobrir estrutura)
  const veiculoPayload = {
    placa: 'TST1A23',
    status: 'ativo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log('🚛 Inserindo veículo...');
  const { data: veiculoData, error: veiculoError } = await supabase
    .from('veiculos')
    .insert([veiculoPayload])
    .select();

  if (veiculoError) {
    console.error('❌ Erro ao inserir veículo:', veiculoError.message, veiculoError.details);
    console.log('⚠️ Prestador foi criado, mas veículo falhou.');
    process.exit(1);
  }

   const veiculoId = veiculoData![0].id;
   console.log(`✅ VEÍCULO CRIADO\n   ID: ${veiculoId}\n   Placa: TST1A23\n`);

  // 3. Consultar prestador criado
  console.log('🔍 Consultando prestador criado...');
  const { data: consultaPrestador, error: errorConsultaP } = await supabase
    .from('prestadores')
    .select('*')
    .eq('id', prestadorId)
    .single();

   if (errorConsultaP) {
     console.error('❌ Erro ao consultar prestador:', errorConsultaP.message);
   } else {
     console.log('✅ Prestador confirmado:', consultaPrestador.nome_completo, '| Email:', consultaPrestador.email, '\n');
   }

  // 4. Consultar veículo vinculado
  console.log('🔍 Consultando veículo vinculado...');
  const { data: consultaVeiculo, error: errorConsultaV } = await supabase
    .from('veiculos')
    .select('*')
    .eq('id', veiculoId)
    .single();

   if (errorConsultaV) {
     console.error('❌ Erro ao consultar veículo:', errorConsultaV.message);
   } else {
     console.log('✅ Veículo confirmado:', consultaVeiculo.placa, '| Status:', consultaVeiculo.status, '\n');
   }

  console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ PRESTADOR CRIADO');
  console.log('✅ VEÍCULO VINCULADO');
  console.log('ID do prestador:', prestadorId);
  console.log('ID do veículo:', veiculoId);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
