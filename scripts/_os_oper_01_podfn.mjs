import pg from "pg";
import { DB } from "./_adm_app_02d2_env.mjs";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(
  `select pg_get_functiondef(p.oid) def from pg_proc p
   where p.proname='f_validar_pod_operacao' limit 1`
);
console.log(r.rows[0]?.def ?? "NAO ENCONTRADA");
await c.end();
