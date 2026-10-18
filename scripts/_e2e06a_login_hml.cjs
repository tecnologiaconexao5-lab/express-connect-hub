require('dotenv').config();
const crypto = require('crypto');
const { Client } = require('pg');
const PROV = 'e6646799-fbac-453e-a3ef-afdfc01a7085';
const EMAIL = 'hml.e2e.06@conexaoexpress.com.br';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const pw = 'HmlE2E06-' + crypto.randomBytes(9).toString('hex');

  const snap = (await c.query('select auth_user_id, metadata from prestadores where id=$1', [PROV])).rows[0];
  console.log('SNAPSHOT_OLD_AUTH_USER_ID=' + snap.auth_user_id);

  const pre = (await c.query('select id,email from auth.users where email=$1', [EMAIL])).rows;
  console.log('PRE_EXISTING_EMAIL=' + JSON.stringify(pre));
  if (pre.length) { console.log('RESULT=BLOCKED_EMAIL_EXISTS'); await c.end(); return; }

  await c.query('BEGIN');
  const nu = await c.query(
    'insert into auth.users ' +
    '(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,' +
    ' raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous,created_at,updated_at) ' +
    "values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),'authenticated','authenticated',$1," +
    " extensions.crypt($2, extensions.gen_salt('bf')), now()," +
    " '{\"provider\":\"email\",\"providers\":[\"email\"]}'::jsonb," +
    " jsonb_build_object('nome_completo','PRESTADOR TESTE APP','origem','hml_e2e_06','hml_e2e_06',true)," +
    ' false,false, now(), now()) returning id',
    [EMAIL, pw]
  );
  const newId = nu.rows[0].id;

  await c.query(
    'insert into auth.identities (id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at) ' +
    "values (gen_random_uuid(),$1::uuid, jsonb_build_object('sub',$1::text,'email',$2::text,'email_verified',false,'phone_verified',false)," +
    " 'email',$1::text, now(), now(), now())",
    [newId, EMAIL]
  );

  await c.query(
    "update prestadores set auth_user_id=$1, metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('hml_e2e_06',true) where id=$2",
    [newId, PROV]
  );
  await c.query('COMMIT');

  console.log('HML_AUTH_USER_ID=' + newId);
  const v = (await c.query(
    'select p.id, p.status, p.liberado_app, p.auth_user_id, u.email from prestadores p join auth.users u on u.id=p.auth_user_id where p.id=$1',
    [PROV]
  )).rows[0];
  console.log('VALIDATE=' + JSON.stringify(v));
  console.log('AUTH_USER_ID_MATCH=' + (v.auth_user_id === newId));
  console.log('=== CREDENCIAIS TEMPORARIAS (USO UNICO) ===');
  console.log('LOGIN_HML=' + EMAIL);
  console.log('SENHA_HML=' + pw);
  await c.end();
})().catch((e) => { console.error('ERR:' + e.message); process.exit(1); });
