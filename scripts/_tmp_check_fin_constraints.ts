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

  const constraints = await client.query(`
    SELECT con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = 'financeiro_receber'::regclass
  `);
  for (const c of constraints.rows) {
    console.log(`${c.conname}: ${c.def}`);
  }

  const defaults = await client.query(`
    SELECT column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financeiro_receber'
    ORDER BY ordinal_position
  `);
  console.log("\nDefaults:");
  for (const d of defaults.rows) {
    if (d.column_default) console.log(`  ${d.column_name}: ${d.column_default}`);
  }

  await client.end();
}

main().catch(e => console.error(e));
