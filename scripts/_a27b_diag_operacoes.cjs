const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const PREST_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

(async () => {
  await client.connect();

  console.log('### assinatura f_buscar_operacoes_motorista:');
  const sig = await client.query(`
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) AS result
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_buscar_operacoes_motorista';
  `);
  console.log(JSON.stringify(sig.rows, null, 1));

  // tenta com uuid
  console.log('\n### chamada direta com uuid:');
  try {
    const r1 = await client.query(`SELECT public.f_buscar_operacoes_motorista($1) AS resp`, [PREST_ID]);
    console.log('retorno:', JSON.stringify(r1.rows[0].resp).slice(0, 3000));
  } catch (e) {
    console.log('ERRO:', e.message);
  }

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });