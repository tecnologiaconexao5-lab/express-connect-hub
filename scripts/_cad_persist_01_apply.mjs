import pg from "pg";
import fs from "node:fs";
import { DB } from "./_adm_app_02d2_env.mjs";

const sql = fs.readFileSync(
  "supabase/migrations/20261004000000_cad_persist_01_veiculos_select_prestador.sql",
  "utf8"
);

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query(sql);

const pol = (await c.query(
  `select policyname, cmd, roles::text as roles, qual
     from pg_policies where tablename='veiculos' and policyname='veiculos_select_prestador'`
)).rows;

console.log(JSON.stringify({ aplicado: true, policy: pol }, null, 2));
await c.end();
console.log("CAD-PERSIST-01 MIGRATION OK");
