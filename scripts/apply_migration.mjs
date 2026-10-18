import { readFileSync } from "fs";
import pg from "pg";
const { Client } = pg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const sql = readFileSync("supabase/migrations/20260710_f304a_action_engine_ferramentas.sql", "utf8");
  console.log("SQL file loaded:", sql.length, "bytes");

  const client = new Client({
    host: "aws-1-sa-east-1.pooler.supabase.com",
    port: 5432,
    user: "cli_login_postgres.uwrvzsjtpgaifkktpepn",
    password: "JmKZwjLeswfOUtmISkZWVpupEoKiLJau",
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  console.log("Connected to remote database!");

  // Execute migration
  console.log("Executing migration...");
  await client.query(sql);
  console.log("Migration executed successfully!");

  // Verify tables
  const { rows: tables } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ia_%' ORDER BY table_name"
  );
  console.log("\n=== TABLES ===");
  console.log("Tables found:", tables.length);
  for (const t of tables) console.log("  - " + t.table_name);

  // Seed data
  const { rows: count } = await client.query("SELECT COUNT(*) as c FROM ia_ferramentas");
  console.log("\n=== SEED DATA ===");
  console.log("Seed count:", count[0].c);
  if (count[0].c > 0) {
    const { rows: seeds } = await client.query("SELECT codigo_unico, nome, categoria FROM ia_ferramentas ORDER BY codigo_unico");
    for (const s of seeds) console.log("  - " + s.codigo_unico + ": " + s.nome + " [" + s.categoria + "]");
  }

  // Indexes
  const { rows: idx } = await client.query("SELECT indexname FROM pg_indexes WHERE tablename LIKE 'ia_%' ORDER BY tablename, indexname");
  console.log("\n=== INDEXES ===");
  console.log("Indexes:", idx.length);
  for (const i of idx) console.log("  - " + i.indexname);

  // RLS Policies
  const { rows: pol } = await client.query("SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE 'ia_%' ORDER BY tablename");
  console.log("\n=== RLS POLICIES ===");
  console.log("Policies:", pol.length);
  for (const p of pol) console.log("  - " + p.tablename + ": " + p.policyname);

  // ENUMs
  const { rows: enums } = await client.query(
    "SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname IN ('categoria_ferramenta','nivel_autonomia_ferramenta','status_execucao_ferramenta') ORDER BY t.typname, e.enumsortorder"
  );
  console.log("\n=== ENUMS ===");
  const emap = {};
  for (const e of enums) {
    if (!emap[e.typname]) emap[e.typname] = [];
    emap[e.typname].push(e.enumlabel);
  }
  for (const [k, v] of Object.entries(emap)) console.log("  - " + k + ": " + v.join(", "));

  await client.end();
  console.log("\n========================================");
  console.log("FASE 0 — AUDITORIA CONCLUIDA COM EXITO!");
  console.log("========================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
