import pg from "pg";
import { DB } from "./_adm_app_02d2_env.mjs";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(
  `select conname, pg_get_constraintdef(oid) def
     from pg_constraint
    where conrelid='alocacoes_escala'::regclass and contype='c'`
);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
