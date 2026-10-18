import pg from "pg";
import fs from "node:fs";

const arq = process.argv[2];
if (!arq) { console.error("uso: node _adm_app_02c2_apply.mjs <arquivo.sql>"); process.exit(1); }
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const sql = fs.readFileSync(arq, "utf8");
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log(JSON.stringify({ arquivo: arq, bytes: Buffer.byteLength(sql), ok: true }, null, 2));
} catch (e) {
  console.error(JSON.stringify({ arquivo: arq, ok: false, erro: e.message, sqlstate: e.code, linha: e.line }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end();
}
