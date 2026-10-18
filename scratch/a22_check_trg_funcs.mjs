import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = process.env.PROJECT_DIR;
if (PROJECT) config({ path: path.resolve(PROJECT, ".env") });

import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const res = await client.query(
  `SELECT proname, pg_get_functiondef(p.oid) AS def
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('trg_evento_alocacao_criada','registrar_historico_alocacao','trg_evento_prestador_aceitou');`
);
for (const r of res.rows) {
  console.log("\n===== " + r.proname + " =====");
  console.log(r.def);
}
await client.end();
