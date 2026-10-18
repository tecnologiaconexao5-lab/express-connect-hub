// Aplicador da migration F0-D (RPCs de baixa/estorno p/ financeiro_receber)
// Uso: node scripts/_f0d_aplicar.mjs
import pg from "pg";
import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationFile = resolve(__dirname, "..", "supabase", "migrations", "20260818_f0d_receber_baixas_rpc.sql");
const sql = readFileSync(migrationFile, "utf8");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log("Conectado. Aplicando migration F0-D (RPCs receber)...");
  await client.query(sql);
  console.log("Migration F0-D aplicada com sucesso!");
  await client.end();
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});