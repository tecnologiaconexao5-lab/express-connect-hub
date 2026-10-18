const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const AUTH_ID = 'a5e51631-5ed8-430d-9041-4b185c03d821';
const OS_ID = '2c24a4dc-3491-4f46-9d24-69ceb4d76d63';

(async () => {
  await client.connect();
  const r = await client.query(
    'SELECT public.f_buscar_operacoes_motorista($1::uuid) AS resp',
    [AUTH_ID]
  );
  const d = r.rows[0].resp;
  console.log('success:', d.success, '| total:', d.total);
  const ops = Array.isArray(d.operacoes) ? d.operacoes : [];
  console.log('n ops:', ops.length);
  const alvo = ops.find(o =>
    String(o.os_id || o.id) === OS_ID ||
    String(o.ordem_servico_id) === OS_ID ||
    String(o.numero).includes('680216')
  );
  console.log('achou OS 680216:', !!alvo);
  if (alvo) {
    console.log('OS:', alvo.numero, '| status:', alvo.status, '| origem:', alvo.origem, '| destino:', alvo.destino, '| data:', alvo.data_programada, '| valor:', alvo.valor_prestador || alvo.valor_repasse);
    console.log('metadata:', JSON.stringify(alvo.metadata || alvo.journey || {}));
  } else {
    console.log('amostra:', JSON.stringify(ops.slice(0, 3), null, 1).slice(0, 2000));
  }
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });