import pg from "pg";
import fs from "node:fs";
import { DB } from "./_adm_app_02d2_env.mjs";

const F = JSON.parse(fs.readFileSync("scripts/_os_oper_01_fixture.json", "utf8"));
const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const aloc = (await c.query(
  `select status, metadata->'app_motorista'->>'etapa_atual' etapa from alocacoes_escala where id=$1`,
  [F.alocacao_id]
)).rows[0] ?? null;

const track = (await c.query(
  `select id, alocacao_id, prestador_id, latitude, longitude, precisao, status, captured_at, origem, metadata
     from portal_tracking_realtime where alocacao_id=$1 order by captured_at desc limit 5`,
  [F.alocacao_id]
)).rows;

const proofs = (await c.query(
  `select id, status, receiver_name, signature_url, photo_url, foto_canhoto_url, operation_id
     from delivery_proofs where operation_id=$1`,
  [F.alocacao_id]
)).rows;

console.log(JSON.stringify({ alocacao: aloc, tracking_count: track.length, tracking: track, proofs }, null, 2));
await c.end();
