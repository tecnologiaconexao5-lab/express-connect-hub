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

  const emails = ["tamiris.castilho@conexaoexpress.com.br", "cliente.teste@conexaoexpress.com.br"];

  for (const email of emails) {
    console.log(`\n========== ${email} ==========`);

    const users = await client.query(
      `SELECT * FROM auth.users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (users.rows.length === 0) {
      console.log("  USER NOT FOUND");
      continue;
    }

    const u = users.rows[0];
    // List all columns and values
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'auth' AND table_name = 'users'
       ORDER BY ordinal_position`
    );

    for (const col of cols.rows) {
      const val = u[col.column_name];
      if (col.column_name === "encrypted_password") {
        console.log(`  ${col.column_name}: ${val?.substring(0, 30)}...`);
      } else if (val === null) {
        // Skip nulls
      } else if (typeof val === "object") {
        console.log(`  ${col.column_name}: ${JSON.stringify(val).substring(0, 100)}`);
      } else {
        console.log(`  ${col.column_name}: ${String(val).substring(0, 100)}`);
      }
    }

    // Check identities
    const identities = await client.query(
      `SELECT * FROM auth.identities WHERE user_id = $1`,
      [u.id]
    );
    console.log(`\n  Identities: ${identities.rows.length}`);
    for (const ident of identities.rows) {
      console.log(`    provider: ${ident.provider}`);
      console.log(`    provider_id: ${ident.provider_id}`);
      console.log(`    identity_data: ${JSON.stringify(ident.identity_data)}`);
    }
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
