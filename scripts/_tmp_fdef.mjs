import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
const root = process.env.ROOT;
const env = readFileSync(`${root}/.env`, "utf8");
const db = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL=")).slice("DATABASE_URL=".length).trim();
const c = new pg.Client({ connectionString: db, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(`SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_aceitar_oportunidade_rede'`);
if (!rows.length) { console.log("NAO ENCONTRADA"); }
else {
  writeFileSync(`${process.env.TEMP}/opencode/f_aceitar_remota.sql`, rows[0].def, "utf8");
  console.log("bytes:", rows[0].def.length);
  console.log(rows[0].def.slice(0, 300));
}
await c.end();
