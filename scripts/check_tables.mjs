process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const pg = require("pg");
const { Client } = pg;

async function main() {
  const c = new Client({
    host: "aws-1-sa-east-1.pooler.supabase.com",
    port: 5432,
    user: "cli_login_postgres.uwrvzsjtpgaifkktpepn",
    password: "JmKZwjLeswfOUtmISkZWVpupEoKiLJau",
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  await c.connect();
  console.log("Connected!\n");

  // Check tables
  const { rows: tables } = await c.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ia_%' ORDER BY table_name"
  );
  console.log("Tables:");
  for (const t of tables) console.log("  - " + t.table_name);

  // Check seed data count
  const { rows: count } = await c.query("SELECT COUNT(*) as c FROM ia_ferramentas");
  console.log("\nFerramentas count:", count[0].c);

  // Check ENUM values
  const { rows: enumVals } = await c.query(
    "SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'categoria_ferramenta' ORDER BY e.enumsortorder"
  );
  console.log("\ncategoria_ferramenta ENUM values:");
  for (const v of enumVals) console.log("  - " + v.enumlabel);

  // Check RLS policies
  const { rows: policies } = await c.query(
    "SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE 'ia_%' ORDER BY tablename"
  );
  console.log("\nRLS Policies:");
  for (const p of policies) console.log("  - " + p.tablename + ": " + p.policyname);

  // Check indexes
  const { rows: indexes } = await c.query(
    "SELECT indexname FROM pg_indexes WHERE tablename LIKE 'ia_%' ORDER BY tablename, indexname"
  );
  console.log("\nIndexes:");
  for (const i of indexes) console.log("  - " + i.indexname);

  await c.end();
  process.exit(0);
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
