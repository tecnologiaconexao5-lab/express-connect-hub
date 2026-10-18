import pg from "pg";
import fs from "node:fs";
import { BASE, SR, DB } from "./_adm_app_02d2_env.mjs";

const ROW = "7546f61c-4d0d-49c4-bbc8-734ef3767c4a";
const FIX = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const OBJ = "doc_4601ed1f-45f5-4f2d-b276-56da75ad7777_Outros_1790901553460.png";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

async function snap(label) {
  const row = (await c.query(`select id, prestador_id, tipo, url, created_at
      from documentos_prestadores where id = $1`, [ROW])).rows;
  const obj = (await c.query(`select name, created_at from storage.objects
      where bucket_id='documentos_prestadores' and name = $1`, [OBJ])).rows;
  const bucketTotal = (await c.query(`select count(*)::int n from storage.objects
      where bucket_id='documentos_prestadores'`)).rows[0].n;
  const rowsFixA = (await c.query(`select count(*)::int n from documentos_prestadores
      where prestador_id = $1`, [FIX.A.prestador_id])).rows[0].n;
  const rowsOutras = (await c.query(`select count(*)::int n from documentos_prestadores
      where prestador_id <> $1`, [FIX.A.prestador_id])).rows[0].n;
  const prestadoresTotal = (await c.query(`select count(*)::int n from prestadores`)).rows[0].n;
  const prestadoresFixture = (await c.query(`select count(*)::int n from prestadores
      where nome_completo like '02D2 FIXTURE %'`)).rows[0].n;
  const tenantUsuariosTotal = (await c.query(`select count(*)::int n from tenant_usuarios`)).rows[0].n;
  const snap = { label, row: row.length, obj: obj.length, bucketTotal, rowsFixA, rowsOutras,
    prestadoresTotal, prestadoresFixture, tenantUsuariosTotal };
  console.log(JSON.stringify(snap));
  return snap;
}

const antes = await snap("ANTES");

if (antes.row !== 1 || antes.obj !== 1) throw new Error("estado inesperado antes da limpeza");

const delObj = await fetch(`${BASE}/storage/v1/object/documentos_prestadores/${OBJ}`, {
  method: "DELETE", headers: { apikey: SR, Authorization: `Bearer ${SR}` } });
console.log("delete object:", delObj.status, delObj.status === 200 ? "OK" : await delObj.text());

const delRow = await c.query(`delete from documentos_prestadores where id = $1`, [ROW]);
console.log("delete row:", delRow.rowCount);

const depois = await snap("DEPOIS");

const provas = {
  row_removida: depois.row === 0,
  obj_removido: depois.obj === 0,
  bucket_total_igual_menos_1: depois.bucketTotal === antes.bucketTotal - 1,
  nenhuma_row_fixture_restou: depois.rowsFixA === 0,
  rows_outros_prestadores_intactas: depois.rowsOutras === antes.rowsOutras,
  prestadores_intactos: depois.prestadoresTotal === antes.prestadoresTotal &&
    depois.prestadoresFixture === antes.prestadoresFixture,
  tenant_usuarios_intactos: depois.tenantUsuariosTotal === antes.tenantUsuariosTotal,
};
console.log(JSON.stringify({ antes, depois, provas }, null, 2));

const falhas = Object.entries(provas).filter(([, v]) => !v).map(([k]) => k);
if (falhas.length) { console.error("FALHAS:", falhas.join(",")); process.exit(1); }
await c.end();
console.log(`CLEANUP DOC TESTE OK (${Object.keys(provas).length}/${Object.keys(provas).length} provas)`);
fs.writeFileSync("scripts/_adm_app_02d2r2_cleanup_doc.json",
  JSON.stringify({ ts: new Date().toISOString(), antes, depois, provas }, null, 2));

