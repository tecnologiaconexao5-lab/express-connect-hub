/**
 * MISSÃO 127-E.1-TMS-B — APLICAR MIGRATION DO CONTRATO APP OPERAÇÃO
 *
 * Uso: node -r dotenv/config scripts/m127e1b_apply_migration.mjs
 *
 * Lê o arquivo de migration e executa no Supabase TMS via DATABASE_URL.
 */

import pg from "pg";
import fs from "fs";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não definida no .env");
  process.exit(1);
}

const MIGRATION_FILE = path.resolve(
  "supabase/migrations/20260715_m127e1_tms_contrato_app_operacao.sql"
);

if (!fs.existsSync(MIGRATION_FILE)) {
  console.error(`❌ Migration não encontrada: ${MIGRATION_FILE}`);
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function main() {
  console.log("=".repeat(72));
  console.log("  APLICAR MIGRATION — MISSÃO 127-E.1-TMS");
  console.log("  CONTRATO OFICIAL DE DADOS DA OPERAÇÃO PARA O APP MOTORISTA");
  console.log("=".repeat(72));

  // Ler arquivo de migration
  const sqlRaw = fs.readFileSync(MIGRATION_FILE, "utf8");

  // Remover linhas de comentário e linhas SELECT '...' que são apenas validação
  const sql = sqlRaw
    .split("\n")
    .filter((line) => !line.trim().startsWith("-- SELECT"))
    .join("\n");

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`\n📋 Executando ${statements.length} comandos SQL...\n`);

  let ok = 0,
    err = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ";";
    // Mostrar preview
    const preview = stmt.split("\n").slice(0, 3).join(" ").trim().substring(0, 120);
    try {
      const client = await pool.connect();
      try {
        await client.query(stmt);
        console.log(`  ✅ [${i + 1}/${statements.length}] ${preview}...`);
        ok++;
      } finally {
        client.release();
      }
    } catch (e) {
      // Ignorar erros de "already exists" para comandos idempotentes
      const msg = e.message || "";
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate") ||
        msg.includes("already has")
      ) {
        console.log(`  ⚠️  [${i + 1}/${statements.length}] ${preview} — (já existe, ignorado)`);
        ok++;
      } else {
        console.log(`  ❌ [${i + 1}/${statements.length}] ${preview}`);
        console.log(`     ${msg.substring(0, 200)}`);
        err++;
      }
    }
  }

  console.log(`\n${"=".repeat(72)}`);
  console.log(`  RESULTADO: ${ok} ok, ${err} erros`);
  console.log(`${"=".repeat(72)}`);

  await pool.end();
  process.exit(err > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
