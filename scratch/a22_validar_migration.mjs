import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = process.env.PROJECT_DIR;
if (PROJECT) config({ path: path.resolve(PROJECT, ".env") });

import pg from "pg";
const { Client } = pg;

const file = process.argv[2];
const sql = readFileSync(file, "utf8");

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("ROLLBACK");
  console.log("VALIDACAO_OK: SQL sintaticamente válido e executável (BEGIN/ROLLBACK). Nada foi aplicado.");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.log("VALIDACAO_ERRO: " + e.message);
  if (e.position) {
    console.log("POSICAO: " + e.position);
    const pos = Number(e.position);
    console.log("TRECHO:\n" + sql.slice(Math.max(0, pos - 200), pos + 200));
  }
  process.exit(1);
}

await client.end();
