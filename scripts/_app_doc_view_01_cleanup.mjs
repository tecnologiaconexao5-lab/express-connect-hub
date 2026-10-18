import pg from "pg";
import fs from "node:fs";
import { BASE, SR, DB } from "./_adm_app_02d2_env.mjs";

const FIX = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const A = FIX.A.prestador_id;

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const before = (await c.query(
  `select count(*)::int n from documentos_prestadores where prestador_id = $1`, [A]
)).rows[0].n;
const beforeBucket = (await c.query(
  `select count(*)::int n from storage.objects where bucket_id='documentos_prestadores'`
)).rows[0].n;

const objs = await c.query(
  `select name from storage.objects where bucket_id='documentos_prestadores' and name like $1`,
  [`doc_${A}_%`]
);
for (const o of objs.rows) {
  const r = await fetch(`${BASE}/storage/v1/object/documentos_prestadores/${o.name}`, {
    method: "DELETE", headers: { apikey: SR, Authorization: `Bearer ${SR}` } });
  console.log("delete object:", o.name, r.status);
}

const delRows = await c.query(
  `delete from documentos_prestadores where prestador_id = $1`, [A]
);
console.log("delete rows:", delRows.rowCount);

const after = (await c.query(
  `select count(*)::int n from documentos_prestadores where prestador_id = $1`, [A]
)).rows[0].n;
const afterBucket = (await c.query(
  `select count(*)::int n from storage.objects where bucket_id='documentos_prestadores'`
)).rows[0].n;

console.log(JSON.stringify({ before, after, beforeBucket, afterBucket }, null, 2));
await c.end();
console.log("APP-DOC-VIEW-01 CLEANUP OK");
