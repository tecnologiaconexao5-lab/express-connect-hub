import pg from "pg";
import fs from "node:fs";
import { DB } from "./_adm_app_02d2_env.mjs";

const F = JSON.parse(fs.readFileSync("scripts/_os_oper_01_fixture.json", "utf8"));
const FIX = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const AUTH = FIX.A.user_id;
const TENANT = FIX.tenant || "00000000-0000-0000-0000-000000000001";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

// Avanca o metadata (test data) ate 'pod_registrado' para isolar a prova do
// ULTIMO passo de status (servico_finalizado) executado pelo APP.
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

await c.query(
  `delete from delivery_proofs where operation_id = $1`, [F.alocacao_id]
);
await c.query(
  `insert into delivery_proofs
     (operation_id, driver_id, receiver_name, receiver_document, status,
      signature_url, photo_url, delivered_at, created_at, updated_at, tenant_id)
   values ($1,$2,'RECEBEDOR TESTE OSOPER01','12345678900','delivered',
      'pod/osoper01_signature_teste.png','pod/osoper01_photo_teste.png',
      now(), now(), now(), $3)`,
  [F.alocacao_id, AUTH, TENANT]
);

const st = (await c.query(
  `select status, metadata->'app_motorista' as app_meta from alocacoes_escala where id=$1`,
  [F.alocacao_id]
)).rows[0];
console.log(JSON.stringify({ status: st.status, app_meta: st.app_meta }, null, 2));
await c.end();
console.log("OS-OPER-01 SEED POD OK");
