/* Acesso Tamiris â€” criar/ajustar Auth + papel comercial + RLS CRM.
 * Uso: node scripts/_apply_acesso_tamiris.cjs [--apply]  (default = dry-run)
 */
const path = require("node:path");
const { readFileSync, writeFileSync } = require("node:fs");
const root = process.cwd();
const { Client } = require(path.join(root, "node_modules", "pg"));

const env = {};
for (const line of readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const APPLY = process.argv.includes("--apply");
const EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const SENHA = "conexao2027";
const NOME = "Tamiris Castilho";
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const MIGRATION = path.join(root, "supabase", "migrations", "20261123000000_acesso_tamiris_comercial.sql");

const db = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const out = { modo: APPLY ? "APPLY" : "DRY_RUN" };
async function q(sql, params) { return (await db.query(sql, params)).rows; }

(async () => {
  await db.connect();
  await db.query("BEGIN");

  // 1) Auth user (existe â†’ atualiza senha/confirmaÃ§Ã£o/metadata; senÃ£o cria)
  let userId = null;
  const existente = await q(`SELECT id FROM auth.users WHERE lower(email)=lower($1) LIMIT 1`, [EMAIL]);
  if (existente.length > 0) {
    userId = existente[0].id;
    await q(
      `UPDATE auth.users SET
         encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now(),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
           || jsonb_build_object('nome', $3::text, 'nome_completo', $3::text, 'email_verified', true),
         raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
           || '{"provider":"email","providers":["email"]}'::jsonb
       WHERE id = $1`,
      [userId, SENHA, NOME],
    );
    out.auth = "atualizado (senha/confirmaÃ§Ã£o/metadata)";
  } else {
    const criado = await q(
      `INSERT INTO auth.users
        (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
       VALUES
        ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         $1, extensions.crypt($2, extensions.gen_salt('bf')), now(), now(), now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('nome', $3::text, 'nome_completo', $3::text, 'email_verified', true),
         false, false)
       RETURNING id`,
      [EMAIL, SENHA, NOME],
    );
    userId = criado[0].id;
    out.auth = "criado";
  }

  // Identidade de e-mail (garante login pelo provider email)
  await q(
    `INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
     SELECT gen_random_uuid(), u.id,
            jsonb_build_object('sub', u.id::text, 'email', u.email),
            'email', u.id::text, now(), now(), now()
       FROM auth.users u
      WHERE u.id = $1
        AND NOT EXISTS (
          SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
        )`,
    [userId],
  );
  out.user_id = userId;

  // 2) VÃ­nculo TMS com papel comercial
  await q(
    `INSERT INTO public.tenant_usuarios (tenant_id, user_id, papel, status)
     VALUES ($2, $1, 'comercial', 'ativo')
     ON CONFLICT (tenant_id, user_id)
     DO UPDATE SET papel = 'comercial', status = 'ativo', atualizado_em = now()`,
    [userId, TENANT_ID],
  );
  out.papel = "comercial";

  // 3) DDL/RLS do CRM
  const sql = readFileSync(MIGRATION, "utf8");
  await db.query(sql);
  out.migration = path.basename(MIGRATION);

  // 4) VerificaÃ§Ãµes
  const check = await q(
    `SELECT
       (SELECT count(*)::int FROM auth.users WHERE id=$1 AND email_confirmed_at IS NOT NULL) AS auth_confirmado,
       (SELECT count(*)::int FROM auth.users WHERE id=$1 AND encrypted_password LIKE '$2%') AS senha_bcrypt,
       (SELECT count(*)::int FROM auth.identities WHERE user_id=$1 AND provider='email') AS identidades,
       (SELECT papel FROM public.tenant_usuarios WHERE user_id=$1 AND tenant_id=$2) AS papel_atual,
       (SELECT count(*)::int FROM information_schema.columns
         WHERE table_schema='public' AND table_name='crm_leads'
           AND column_name IN ('responsavel_id','created_by')) AS colunas_crm,
       (SELECT count(*)::int FROM pg_policies
         WHERE schemaname='public' AND policyname LIKE '%escopo_tamiris') AS policies_escopo`,
    [userId, TENANT_ID],
  );
  out.verificacao = check[0];

  const ok = out.verificacao.auth_confirmado === 1 &&
    out.verificacao.senha_bcrypt === 1 &&
    out.verificacao.identidades >= 1 &&
    out.verificacao.papel_atual === "comercial" &&
    out.verificacao.colunas_crm === 2 &&
    out.verificacao.policies_escopo === 5;

  if (!ok) {
    await db.query("ROLLBACK");
    out.status = "INVARIANTE_FALHOU_ROLLBACK";
  } else if (APPLY) {
    await db.query("COMMIT");
    out.status = "COMMIT_OK";
  } else {
    await db.query("ROLLBACK");
    out.status = "DRY_RUN_OK";
  }

  writeFileSync("C:\\Users\\DIEGOB~1\\AppData\\Local\\Temp\\opencode\\acesso_tamiris_result.json", JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify(out, null, 2));
  await db.end();
  if (!ok) process.exit(2);
})().catch(async (e) => {
  console.error("FALHA", e.message);
  try { await db.query("ROLLBACK"); } catch {}
  try { await db.end(); } catch {}
  process.exit(1);
});

