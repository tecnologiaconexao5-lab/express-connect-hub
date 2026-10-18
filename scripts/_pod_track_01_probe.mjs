import pg from "pg";
import { DB } from "./_adm_app_02d2_env.mjs";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const rpc = (await c.query(
  `select pg_get_functiondef(p.oid) def from pg_proc p
   where p.proname='registrar_posicao_motorista' limit 1`
)).rows[0]?.def ?? "NAO ENCONTRADA";

const tabs = (await c.query(
  `select table_name from information_schema.tables
    where table_schema='public'
      and (table_name ilike '%posico%' or table_name ilike '%track%'
           or table_name ilike '%localiza%' or table_name ilike '%rastre%')
    order by table_name`
)).rows.map((r) => r.table_name);

const buckets = (await c.query(
  `select id, name, public from storage.buckets order by name`
)).rows;

console.log(JSON.stringify({ rpc, tabelas: tabs, buckets }, null, 2));
await c.end();
