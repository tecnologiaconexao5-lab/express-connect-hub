const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const OS_ID = '2c24a4dc-3491-4f46-9d24-69ceb4d76d63';
const PREST_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

(async () => {
  await client.connect();

  // Simula exatamente a query do painel TMS (OrdemServicoForm.tsx useEffect A27)
  const aloc = await client.query(
    `SELECT id, placa, tipo_veiculo, data_aceite
     FROM public.alocacoes_escala
     WHERE ordem_servico_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [OS_ID]
  );
  const prest = await client.query(
    `SELECT nome_completo FROM public.prestadores WHERE id = $1`,
    [PREST_ID]
  );
  const veic = await client.query(
    `SELECT placa, tipo_veiculo FROM public.veiculos
     WHERE prestador_vinculado = $1 ORDER BY placa ASC LIMIT 1`,
    [PREST_ID]
  );

  console.log('=== Painel TMS "Aceita na Rede de Prestadores" — dados ===');
  console.log('Alocação :', JSON.stringify(aloc.rows[0]));
  console.log('Prestador:', JSON.stringify(prest.rows[0]));
  console.log('Veículo  :', JSON.stringify(veic.rows[0]));

  const a = aloc.rows[0], p = prest.rows[0], v = veic.rows[0];
  const placa = a?.placa || v?.placa;
  const tipo = a?.tipo_veiculo || v?.tipo_veiculo;
  const aceite = a?.data_aceite;
  console.log('\nPainel exibirá:');
  console.log('  Prestador :', p?.nome_completo || '—');
  console.log('  Placa     :', placa || '—');
  console.log('  Tipo      :', tipo || '—');
  console.log('  Aceite em :', aceite || '—');
  console.log('  Alocação  :', a?.id || '—');

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });