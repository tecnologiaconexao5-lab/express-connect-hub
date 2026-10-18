import pg from "pg";
import { DB } from "./_adm_app_02d2_env.mjs";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const fn = (await c.query(
  `select pg_get_functiondef(p.oid) def from pg_proc p
   where p.proname='f_pod_referencia_remota' limit 1`
)).rows[0]?.def ?? "NAO ENCONTRADA";

const dpCols = (await c.query(
  `select column_name, data_type from information_schema.columns
    where table_name='delivery_proofs' order by ordinal_position`
)).rows;

const rpCols = (await c.query(
  `select column_name, data_type from information_schema.columns
    where table_name='rota_paradas' order by ordinal_position`
)).rows;

const osSample = (await c.query(
  `select id, numero, cliente, prestador, status, origem, destino, carga_descricao, tipo_carga, peso, volumes
     from ordens_servico order by created_at desc nulls last limit 3`
)).rows;

console.log(JSON.stringify({ f_pod_referencia_remota: fn, delivery_proofs_cols: dpCols, rota_paradas_cols: rpCols, os_sample: osSample }, null, 2));
await c.end();
