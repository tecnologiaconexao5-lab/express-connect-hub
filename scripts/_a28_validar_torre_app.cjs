const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const ALOC = '2333f16e-6f4f-4169-8766-a02282ec8527';

(async () => {
  await client.connect();

  console.log('=== MENSAGEM TORRE → APP "Teste A28 Torre para App" ===');
  const exata = await client.query(`
    SELECT id, alocacao_id, os_id, prestador_id, sender_type, sender_user_id,
           mensagem, status, read_at, idempotency_key, created_at, metadata
    FROM operacao_mensagens
    WHERE alocacao_id = $1 AND mensagem ILIKE '%Teste A28 Torre para App%'
    ORDER BY created_at DESC LIMIT 5`, [ALOC]);

  if (!exata.rows.length) {
    console.log('  NENHUMA MENSAGEM ENCONTRADA com esse texto exato.');
  }
  exata.rows.forEach(r => {
    const d = new Date(r.created_at);
    const ra = r.read_at ? new Date(r.read_at) : null;
    console.log(`  id=${r.id}`);
    console.log(`  alocacao_id=${r.alocacao_id}`);
    console.log(`  os_id=${r.os_id}`);
    console.log(`  prestador_id=${r.prestador_id}`);
    console.log(`  sender_type=${r.sender_type} | sender_user_id=${r.sender_user_id}`);
    console.log(`  mensagem="${r.mensagem}"`);
    console.log(`  status=${r.status} | read_at=${ra ? ra.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'null'}`);
    console.log(`  created_at_utc=${r.created_at.toISOString()}`);
    console.log(`  created_at_brt=${d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    console.log(`  metadata=${JSON.stringify(r.metadata)}`);
  });

  console.log('\n=== CONTAGEM (duplicidade?) ===');
  const cnt = await client.query(`
    SELECT count(*)::int AS n FROM operacao_mensagens
    WHERE alocacao_id=$1 AND mensagem ILIKE '%Teste A28 Torre para App%'`, [ALOC]);
  console.log(`  Ocorrências exatas: ${cnt.rows[0].n}`);

  console.log('\n=== TODAS as mensagens da operação (ordem cronológica) ===');
  const all = await client.query(`
    SELECT sender_type, status, created_at, left(mensagem,45) AS msg
    FROM operacao_mensagens WHERE alocacao_id=$1 ORDER BY created_at ASC`, [ALOC]);
  all.rows.forEach(r => {
    const d = new Date(r.created_at);
    console.log(`  [${d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] ${r.sender_type} | ${r.status} | ${r.msg}`);
  });

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });