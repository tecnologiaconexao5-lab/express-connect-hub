const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const ALOC = '2333f16e-6f4f-4169-8766-a02282ec8527';

(async () => {
  await client.connect();
  console.log('=== Baseline do chat — operação HML OS-202608-680216 ===');
  const msgs = await client.query(`
    SELECT id, sender_type, status, read_at, created_at, left(mensagem,50) AS msg
    FROM operacao_mensagens
    WHERE alocacao_id = $1
    ORDER BY created_at ASC`, [ALOC]);
  msgs.rows.forEach(r => console.log(`  ${r.sender_type} | ${r.status} | criada=${r.created_at} | lida=${r.read_at} | ${r.msg}`));
  console.log(`  Total mensagens: ${msgs.rows.length}`);

  const notifs = await client.query(`
    SELECT tipo, titulo, mensagem, created_at, lida, origem_id, origem_tipo
    FROM portal_notificacoes
    WHERE origem_tipo = 'alocacao' AND origem_id = $1
       OR prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'
    ORDER BY created_at DESC LIMIT 8`, [ALOC]);
  console.log('\n=== Notificações App do prestador HML ===');
  notifs.rows.forEach(r => console.log(`  ${r.tipo} | ${r.titulo} | ${r.created_at} | lida=${r.lida} | ${r.origem_tipo}/${r.origem_id?.slice(0,8)}`));

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });