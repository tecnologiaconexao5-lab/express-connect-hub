import pg from "pg";
import { DB } from "./_adm_app_02d2_env.mjs";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const cols = await c.query(
  `select column_name, data_type, is_nullable
     from information_schema.columns
    where table_name='documentos_prestadores' order by ordinal_position`
);
const cons = await c.query(
  `select conname, pg_get_constraintdef(oid) as def
     from pg_constraint where conrelid='documentos_prestadores'::regclass`
);
console.log(JSON.stringify({ cols: cols.rows, cons: cons.rows }, null, 2));
await c.end();
