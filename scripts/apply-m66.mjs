import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sql = readFileSync(resolve(__dirname, "..", "supabase", "migrations", "20260704_m66_fix_propagacao_financeira.sql"), "utf8");
const connStr = process.env.DATABASE_URL;

if (!connStr) {
  console.error("ERRO: Defina DATABASE_URL no .env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log("Conectado. Aplicando migration M66...");
  await client.query(sql);
  console.log("Migration M66 aplicada com sucesso!");
} catch (err) {
  console.error("Erro:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
