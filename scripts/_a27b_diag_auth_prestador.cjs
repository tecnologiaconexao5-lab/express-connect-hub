const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const PREST_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

(async () => {
  await client.connect();

  const p = await client.query(
    "SELECT id, email, nome_completo, auth_user_id FROM public.prestadores WHERE id = $1",
    [PREST_ID]
  );
  console.log('prestador TESTE APP:', JSON.stringify(p.rows, null, 1));

  const u = await client.query(
    "SELECT id, email, raw_user_meta_data FROM auth.users WHERE email ILIKE '%teste@conexao%'"
  );
  console.log('auth.users teste:', JSON.stringify(u.rows, null, 1));

  const tu = await client.query(
    `SELECT tu.user_id, tu.papel, tu.tenant_id, p.email, p.nome_completo
     FROM public.tenant_usuarios tu
     LEFT JOIN public.prestadores p ON p.auth_user_id = tu.user_id
     WHERE p.id = $1`,
    [PREST_ID]
  );
  console.log('tenant_usuarios vínculo:', JSON.stringify(tu.rows, null, 1));

  const pa = await client.query(
    "SELECT * FROM public.prestador_acesso WHERE prestador_id = $1",
    [PREST_ID]
  );
  console.log('prestador_acesso:', JSON.stringify(pa.rows, null, 1));

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });