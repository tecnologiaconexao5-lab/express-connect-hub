import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Check identities schema
  const cols = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'auth' AND table_name = 'identities'
     ORDER BY ordinal_position`
  );
  console.log("=== auth.identities columns ===");
  cols.rows.forEach((r: any) => console.log(`  ${r.column_name} (${r.data_type})`));

  // Check our user
  const users = await client.query(
    `SELECT id, email, email_confirmed_at, raw_user_meta_data,
            encrypted_password, created_at, updated_at, is_sso_user, deleted_at
     FROM auth.users WHERE email = 'cliente.teste@conexaoexpress.com.br' LIMIT 1`
  );
  console.log("\n=== cliente.teste user ===");
  users.rows.forEach((r: any) => {
    console.log(`  id: ${r.id}`);
    console.log(`  email: ${r.email}`);
    console.log(`  confirmed: ${r.email_confirmed_at}`);
    console.log(`  metadata: ${JSON.stringify(r.raw_user_meta_data)}`);
    console.log(`  pass hash: ${r.encrypted_password?.substring(0, 40)}...`);
    console.log(`  is_sso: ${r.is_sso_user}`);
    console.log(`  deleted: ${r.deleted_at}`);
  });

  // Verify password with crypt
  const pwCheck = await client.query(
    `SELECT (encrypted_password = crypt('Teste@2026', encrypted_password)) as pw_match
     FROM auth.users WHERE email = 'cliente.teste@conexaoexpress.com.br'`,
  );
  console.log(`\nPassword check: ${pwCheck.rows[0]?.pw_match}`);

  // Check we have the right identities
  const identities = await client.query(
    `SELECT id, provider, provider_id, identity_data FROM auth.identities
     WHERE user_id = $1`,
    [users.rows[0]?.id]
  );
  console.log(`\nIdentities count: ${identities.rows.length}`);
  identities.rows.forEach((r: any) => console.log(`  ${r.provider} | ${r.provider_id} | ${JSON.stringify(r.identity_data)}`));

  // Check if there's also a different auth user by same email
  const allUsers = await client.query(
    `SELECT id, email, created_at FROM auth.users WHERE email LIKE '%teste%'`
  );
  console.log(`\nAll test users: ${allUsers.rows.length}`);
  allUsers.rows.forEach((r: any) => console.log(`  ${r.id} | ${r.email} | ${r.created_at}`));

  // Check for the correct auth_schema
  const encCheck = await client.query(
    `SELECT id, email, encrypted_password IS NOT NULL as has_pw,
            length(encrypted_password) as pw_len
     FROM auth.users WHERE email = 'tamiris.castilho@conexaoexpress.com.br' LIMIT 1`
  );
  console.log("\n=== tamiris user (for comparison) ===");
  encCheck.rows.forEach((r: any) => {
    console.log(`  id: ${r.id}`);
    console.log(`  email: ${r.email}`);
    console.log(`  has_pw: ${r.has_pw}`);
    console.log(`  pw_len: ${r.pw_len}`);
  });

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
