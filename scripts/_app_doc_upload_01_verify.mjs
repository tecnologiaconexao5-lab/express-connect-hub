import pg from "pg";
import fs from "node:fs";
import { DB } from "./_adm_app_02d2_env.mjs";

const FIX = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const A = FIX.A.prestador_id;

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const rows = (await c.query(
  `select id, prestador_id, tipo, url, created_at
     from documentos_prestadores where prestador_id = $1 order by created_at`, [A]
)).rows;

const provas = [];
for (const r of rows) {
  const isSigned = /^https?:\/\//.test(r.url ?? "") || (r.url ?? "").includes("token=");
  const obj = (await c.query(
    `select count(*)::int n from storage.objects
      where bucket_id='documentos_prestadores' and name = $1`, [r.url]
  )).rows[0].n;
  const pertence =
    (r.url ?? "").startsWith(`doc_${A}_`) || (r.url ?? "").startsWith(`foto_${A}_`);
  provas.push({
    tipo: r.tipo,
    url: r.url,
    path_estavel: !isSigned && (r.url ?? "").startsWith("doc_"),
    pertence_ao_prestador: pertence,
    objeto_no_bucket: obj === 1,
  });
}

const bucketTotal = (await c.query(
  `select count(*)::int n from storage.objects where bucket_id='documentos_prestadores'`
)).rows[0].n;

console.log(JSON.stringify({ prestador_id: A, registros: rows.length, provas, bucketTotal }, null, 2));

const ok = rows.length > 0 &&
  provas.every((p) => p.path_estavel && p.pertence_ao_prestador && p.objeto_no_bucket);
console.log(ok ? "VERIFY OK" : "VERIFY FALHOU");
await c.end();
process.exit(ok ? 0 : 1);
