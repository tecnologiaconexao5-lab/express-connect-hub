import { createClient } from "@supabase/supabase-js";
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

  // Check the existing auth user e123a9ec
  const user = await client.query(
    `SELECT id, email, email_confirmed_at, encrypted_password IS NOT NULL AS has_pw,
            raw_user_meta_data, raw_app_meta_data, created_at
     FROM auth.users WHERE id = 'e123a9ec-ec1c-49b3-837b-3549467fa5d3'`
  );
  console.log("=== EXISTING CLIENT USER ===");
  if (user.rows.length === 0) {
    console.log("User e123a9ec NOT FOUND in auth.users");
  } else {
    const u = user.rows[0];
    console.log(`Email: ${u.email}`);
    console.log(`Confirmed: ${u.email_confirmed_at}`);
    console.log(`Has password: ${u.has_pw}`);
    console.log(`User meta: ${JSON.stringify(u.raw_user_meta_data)}`);
    console.log(`App meta: ${JSON.stringify(u.raw_app_meta_data)}`);
    console.log(`Created: ${u.created_at}`);
  }

  // Check identities
  const idents = await client.query(
    `SELECT * FROM auth.identities WHERE user_id = 'e123a9ec-ec1c-49b3-837b-3549467fa5d3'`
  );
  console.log(`\nIdentities: ${idents.rows.length}`);
  for (const i of idents.rows) {
    console.log(`  Provider: ${i.provider}, provider_id: ${i.provider_id}`);
    console.log(`  Data: ${JSON.stringify(i.identity_data)}`);
  }

  // Check the cliente record
  const ucliente = await client.query(
    `SELECT uc.*, c.razao_social, c.cnpj FROM usuarios_cliente uc
     LEFT JOIN clientes c ON c.id = uc.cliente_id
     WHERE uc.auth_user_id = 'e123a9ec-ec1c-49b3-837b-3549467fa5d3'`
  );
  console.log(`\nusuarios_cliente: ${ucliente.rows.length} records`);
  for (const r of ucliente.rows) {
    console.log(`  ID: ${r.id}, cliente_id: ${r.cliente_id}, ativo: ${r.ativo}`);
    console.log(`  Cliente: ${r.razao_social}, CNPJ: ${r.cnpj}`);
  }

  // Check if there's a way to find the password for e123a9ec
  // Try to find if this user was created by any seed or migration
  const allUsers = await client.query(
    `SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 20`
  );
  console.log("\n=== RECENT USERS ===");
  for (const u of allUsers.rows) {
    console.log(`  ${u.id} | ${u.email} | ${u.created_at}`);
  }

  await client.end();
}

main().catch(e => console.error(e));
