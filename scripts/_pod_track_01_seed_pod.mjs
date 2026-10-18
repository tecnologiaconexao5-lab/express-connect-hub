import pg from "pg";
import fs from "node:fs";
import { BASE, SR, DB } from "./_adm_app_02d2_env.mjs";

const F = JSON.parse(fs.readFileSync("scripts/_os_oper_01_fixture.json", "utf8"));
const FIX = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const AUTH = FIX.A.user_id;
const TENANT = FIX.tenant || "00000000-0000-0000-0000-000000000001";

const img = fs.readFileSync("scripts/_adm_app_02d2r1_doc_teste.png");
const now = new Date();
const d = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(now.getUTCDate()).padStart(2, "0")}`;
const podPath = `${AUTH}/pod/${F.alocacao_id}/${d}/pod_teste_${Date.now()}.png`;
const sigPath = `${AUTH}/pod/${F.alocacao_id}/${d}/assinatura_teste_${Date.now()}.png`;

async function upload(path, bytes) {
  const r = await fetch(`${BASE}/storage/v1/object/driver-evidence/${path}`, {
    method: "POST",
    headers: {
      apikey: SR,
      Authorization: `Bearer ${SR}`,
      "Content-Type": "image/png",
      "x-upsert": "true",
    },
    body: bytes,
  });
  console.log("upload", path, r.status);
  if (!r.ok) console.log(await r.text());
}

await upload(podPath, img);
await upload(sigPath, img);

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

await c.query(`delete from delivery_proofs where operation_id = $1`, [F.alocacao_id]);
await c.query(
  `insert into delivery_proofs
     (operation_id, driver_id, receiver_name, receiver_document, status,
      photo_url, signature_url, delivered_at, created_at, updated_at, tenant_id)
   values ($1,$2,'RECEBEDOR TESTE POD','12345678900','delivered',
      $3,$4, now(), now(), now(), $5)`,
  [F.alocacao_id, AUTH, podPath, sigPath, TENANT]
);

await c.query(
  `update alocacoes_escala
      set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
            'app_motorista', coalesce(metadata->'app_motorista','{}'::jsonb) || jsonb_build_object(
              'etapa_atual','pod_registrado',
              'pod_registrado', true,
              'assinatura_capturada', true,
              'romaneio','340612',
              'km_inicial', 52400,
              'km_final', 52480,
              'servico_finalizado', false
            )),
          updated_at = now()
    where id = $1`,
  [F.alocacao_id]
);

const proof = (await c.query(
  `select id, status, receiver_name, photo_url, signature_url from delivery_proofs where operation_id=$1`,
  [F.alocacao_id]
)).rows;
console.log(JSON.stringify({ pod_path: podPath, sig_path: sigPath, delivery_proofs: proof }, null, 2));
await c.end();
console.log("POD-TRACK-01 SEED POD OK");
