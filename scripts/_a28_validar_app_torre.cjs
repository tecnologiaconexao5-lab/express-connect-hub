const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const ALOC = '2333f16e-6f4f-4169-8766-a02282ec8527';
const PREST = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

(async () => {
  await client.connect();

  console.log('=== 1. ÚLTIMAS MENSAGENS DA OPERAÇÃO HML (OS-202608-680216) ===');
  const msgs = await client.query(`
    SELECT id, alocacao_id, os_id, prestador_id, sender_type, sender_user_id,
           mensagem, status, read_at, idempotency_key, created_at, metadata
    FROM operacao_mensagens
    WHERE alocacao_id = $1
    ORDER BY created_at DESC LIMIT 5`, [ALOC]);
  msgs.rows.forEach(r => console.log(JSON.stringify(r, null, 2)));

  console.log('\n=== 2. MENSAGEM "Teste A28" EXATA ===');
  const exata = await client.query(`
    SELECT id, alocacao_id, os_id, prestador_id, sender_type, sender_user_id,
           mensagem, status, read_at, created_at, metadata
    FROM operacao_mensagens
    WHERE alocacao_id = $1 AND mensagem ILIKE '%Teste A28%'
    ORDER BY created_at DESC LIMIT 5`, [ALOC]);
  exata.rows.forEach(r => {
    const d = new Date(r.created_at);
    console.log(`  id=${r.id}`);
    console.log(`  alocacao_id=${r.alocacao_id}`);
    console.log(`  os_id=${r.os_id}`);
    console.log(`  prestador_id=${r.prestador_id}`);
    console.log(`  sender_type=${r.sender_type} | sender_user_id=${r.sender_user_id}`);
    console.log(`  mensagem="${r.mensagem}"`);
    console.log(`  status=${r.status} | read_at=${r.read_at}`);
    console.log(`  created_at_utc=${r.created_at.toISOString()}`);
    console.log(`  created_at_brt=${d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    console.log(`  metadata=${JSON.stringify(r.metadata)}`);
  });

  console.log('\n=== 3. VALIDAÇÃO HORÁRIO BRT (UTC-3) ===');
  if (exata.rows[0]) {
    const utc = new Date(exata.rows[0].created_at);
    const brt = new Date(utc.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const diffMin = Math.round((utc - brt) / 60000);
    console.log(`  diff UTC vs BRT: ${diffMin} min (esperado -180, sem offset fixo no código — conversão p/ exibição)`);
  }

  console.log('\n=== 4. total mensagens na operação ===');
  const cnt = await client.query(`SELECT count(*)::int AS n FROM operacao_mensagens WHERE alocacao_id=$1`, [ALOC]);
  console.log(`  ${cnt.rows[0].n}`);

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });