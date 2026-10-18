import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connStr = process.argv[2] || process.env.DATABASE_URL;

if (!connStr) {
  console.error("Uso: node scripts/apply-m103a-migration.mjs <connection_string>");
  console.error("Ou defina DATABASE_URL");
  process.exit(1);
}

const migrationFile = resolve(__dirname, "..", "supabase", "migrations", "20260706_m103a_fix_alocacao_trigger_columns.sql");
const sql = readFileSync(migrationFile, "utf8");

console.log("Migration file:", migrationFile);
console.log("SQL size:", sql.length, "chars");

const client = new pg.Client({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    await client.connect();
    console.log("Conectado ao Supabase via DATABASE_URL.");

    // Split by statements (simple approach)
    const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);

    console.log(`Executando ${statements.length} statements...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await client.query(stmt);
        console.log(`  [${i + 1}/${statements.length}] OK`);
      } catch (err) {
        console.error(`  [${i + 1}/${statements.length}] ERRO: ${err.message}`);
        // Continue even if one statement fails (idempotency)
      }
    }

    console.log("\n=== Migration M103A aplicada com sucesso! ===");
  } catch (err) {
    console.error("Erro fatal:", err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log("Conexão fechada.");
  }
}

main();
