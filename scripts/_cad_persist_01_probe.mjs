import pg from "pg";
import fs from "node:fs";
import { DB } from "./_adm_app_02d2_env.mjs";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const cols = (await c.query(
  `select column_name from information_schema.columns
    where table_name='prestadores' order by ordinal_position`
)).rows.map((r) => r.column_name);

let fix = null;
try { fix = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8")); } catch { /* noop */ }

let profile = null;
let veiculos = [];
if (fix?.A?.prestador_id) {
  profile = (await c.query(
    `select id, nome_completo, status, liberado_app, metadata
       from prestadores where id = $1`, [fix.A.prestador_id]
  )).rows[0] ?? null;

  const veiculoCols = (await c.query(
    `select column_name from information_schema.columns where table_name='veiculos'`
  )).rows.map((r) => r.column_name);
  console.log("veiculos columns:", JSON.stringify(veiculoCols));
  try {
    veiculos = (await c.query(
      `select * from veiculos where prestador_id = $1`, [fix.A.prestador_id]
    )).rows;
  } catch (e) { veiculos = ["erro: " + e.message]; }
}

const policies = (await c.query(
  `select tablename, policyname, cmd, roles::text as roles, qual, with_check
     from pg_policies where tablename in ('veiculos','prestadores') order by tablename, cmd`
)).rows;

console.log(JSON.stringify({ prestadores_cols: cols, fixture_A_prestador: fix?.A?.prestador_id, profile, veiculos, policies }, null, 2));
await c.end();
