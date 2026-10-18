import pg from "pg";
import fs from "node:fs";
import { DB } from "./_adm_app_02d2_env.mjs";

const FIX = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const A = FIX.A.prestador_id;

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const before = (await c.query(
  `select count(*)::int n from veiculos where prestador_vinculado = $1`, [A]
)).rows[0].n;
const totalBefore = (await c.query(`select count(*)::int n from veiculos`)).rows[0].n;

const del = await c.query(
  `delete from veiculos where prestador_vinculado = $1`, [A]
);

const after = (await c.query(
  `select count(*)::int n from veiculos where prestador_vinculado = $1`, [A]
)).rows[0].n;
const totalAfter = (await c.query(`select count(*)::int n from veiculos`)).rows[0].n;

console.log(JSON.stringify({
  veiculo_fixture_antes: before,
  removidos: del.rowCount,
  veiculo_fixture_depois: after,
  veiculos_total_antes: totalBefore,
  veiculos_total_depois: totalAfter,
}, null, 2));
await c.end();
console.log("CAD-PERSIST-01 CLEANUP OK");
