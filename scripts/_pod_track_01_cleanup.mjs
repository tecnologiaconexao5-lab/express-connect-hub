import pg from "pg";
import fs from "node:fs";
import { BASE, SR, DB } from "./_adm_app_02d2_env.mjs";

const F = JSON.parse(fs.readFileSync("scripts/_os_oper_01_fixture.json", "utf8"));
const FIX = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const AUTH = FIX.A.user_id;
const OP = F.alocacao_id;

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const bucketBefore = (await c.query(
  `select count(*)::int n from storage.objects where bucket_id='driver-evidence'`
)).rows[0].n;

// Objetos de teste no bucket driver-evidence (pod/km/manifest da operacao)
const objs = (await c.query(
  `select name from storage.objects
    where bucket_id='driver-evidence'
      and (name like $1 or name like $2 or name like $3)`,
  [`${AUTH}/pod/${OP}/%`, `${AUTH}/km/${OP}/%`, `${AUTH}/manifest/${OP}/%`]
)).rows;
for (const o of objs) {
  const r = await fetch(`${BASE}/storage/v1/object/driver-evidence/${o.name}`, {
    method: "DELETE", headers: { apikey: SR, Authorization: `Bearer ${SR}` } });
  console.log("delete object:", o.name, r.status);
}

const dProofs = await c.query(`delete from delivery_proofs where operation_id=$1`, [OP]);
const dTrack = await c.query(`delete from portal_tracking_realtime where alocacao_id=$1`, [OP]);
let dTimeline = { rowCount: 0 };
try {
  dTimeline = await c.query(`delete from operation_timeline_events where operation_id=$1`, [OP]);
} catch (e) { console.log("timeline delete:", e.message); }
const dAloc = await c.query(`delete from alocacoes_escala where id=$1`, [OP]);
const dOs = await c.query(`delete from ordens_servico where id=$1`, [F.os_id]);

const bucketAfter = (await c.query(
  `select count(*)::int n from storage.objects where bucket_id='driver-evidence'`
)).rows[0].n;

console.log(JSON.stringify({
  objetos_removidos: objs.length,
  delivery_proofs: dProofs.rowCount,
  tracking: dTrack.rowCount,
  timeline: dTimeline.rowCount,
  alocacao: dAloc.rowCount,
  os: dOs.rowCount,
  bucket_driver_evidence: { antes: bucketBefore, depois: bucketAfter },
}, null, 2));
await c.end();
console.log("POD-TRACK-01 CLEANUP OK");
