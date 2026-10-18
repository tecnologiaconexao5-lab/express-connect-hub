// Helper script para aplicar a migration via pg
// Uso: node scripts/apply-migration-pg.js <connection_string>
import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connStr = process.argv[2] || process.env.DATABASE_URL;

if (!connStr) {
  console.error("Uso: node scripts/apply-migration-pg.js <connection_string>");
  console.error("Ou defina DATABASE_URL");
  console.error("Formato Supabase: postgresql://postgres.[ref]:[senha]@aws-0-[regiao].pooler.supabase.com:6543/postgres");
  process.exit(1);
}

const migrationFile = resolve(__dirname, "..", "supabase", "migrations", "20260728_missao50_auth_real.sql");
const sql = readFileSync(migrationFile, "utf8");

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    await client.connect();
    console.log("Conectado. Aplicando migration...");
    await client.query(sql);
    console.log("Migration aplicada com sucesso!");
  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
