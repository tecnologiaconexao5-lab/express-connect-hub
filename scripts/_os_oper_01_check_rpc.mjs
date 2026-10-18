import fs from "node:fs";
import { BASE, ANON } from "./_adm_app_02d2_env.mjs";

const FIX = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));

const r = await fetch(`${BASE}/rest/v1/rpc/f_buscar_operacoes_motorista`, {
  method: "POST",
  headers: {
    apikey: ANON,
    Authorization: `Bearer ${FIX.A.jwt}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({}),
});
const j = await r.json();
const ops = (j?.operacoes ?? []).map((o) => ({
  id: o.id,
  os_numero: o.os_numero,
  status: o.status,
  origem: o.origem,
  destino: o.destino,
  etapa: o.metadata?.app_motorista?.etapa_atual ?? null,
}));
console.log(JSON.stringify({ success: j?.success, total: j?.total, ops }, null, 2));
