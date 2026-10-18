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
  await client.query("COMMIT");
  console.log("APLICADO_OK: migration executada e COMMITADA em PRODUÇÃO.");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.log("APLICACAO_ERRO: " + e.message);
  process.exit(1);
}

await client.end();
