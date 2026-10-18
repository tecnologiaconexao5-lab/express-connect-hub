// APP-E2E-11C — auditoria READ-ONLY parte 2 (colunas + fixture), defensiva.
import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;

const ALOC = "18d50f0b-704f-4361-8626-ed43c8000601";
const PREST = "b45890ff-454c-40a0-a89e-5333a88eb316";
const AUTHUID = "a5e51631-5ed8-430d-9041-4b185c03d821";

const cols = async (t) => (await q(
  `select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`, [t]
)).map(r => r.column_name);

const out = {};
const tables = ["delivery_proofs", "entregas_protocolo", "portal_tracking_realtime",
  "operacao_localizacao", "financeiro_pagar", "financeiro_receber",
  "pagamentos_prestadores", "portal_protocolos", "prestador_indicadores",
  "prestador_engajamento", "prestador_reembolsos"];
const colmap = {};
for (const t of tables) { colmap[t] = await cols(t); out[`cols_${t}`] = colmap[t]; }

// Fixture por tabela: monta WHERE com as colunas de vínculo disponíveis.
const linkSelect = (t) => {
  const c = colmap[t] || [];
  const parts = [];
  if (c.includes("operation_id")) parts.push("operation_id=$1");
  if (c.includes("alocacao_id")) parts.push("alocacao_id=$1");
  if (c.includes("ordem_servico_id")) parts.push("ordem_servico_id=$1");
  if (c.includes("os_id")) parts.push("os_id=$1");
  return parts;
};

for (const t of tables) {
  if (!colmap[t].length) { out[t] = { nao_existe: true }; continue; }
  const parts = linkSelect(t);
  try {
    if (parts.length) {
      out[t] = await q(`select * from ${t} where ${parts.join(" or ")}`, [ALOC]);
    } else if (colmap[t].includes("prestador_id") && t.startsWith("prestador_")) {
      out[t] = await q(`select * from ${t} where prestador_id::text=$1`, [PREST]);
    } else {
      out[t] = { sem_vinculo: true };
    }
  } catch (e) { out[t] = { erro: e.message }; }
}

// financeiro_pagar/receber podem vincular por prestador/fornecedor também
try {
  const c = colmap.financeiro_pagar;
  const w = [];
  if (c.includes("prestador_id")) w.push("prestador_id::text=$1");
  if (c.includes("prestador")) w.push("prestador::text=$1");
  if (c.includes("fornecedor_id")) w.push("fornecedor_id::text=$1");
  if (w.length) out.financeiro_pagar_por_prestador = await q(`select * from financeiro_pagar where ${w.join(" or ")}`, [PREST]);
} catch (e) { out.financeiro_pagar_por_prestador = { erro: e.message }; }

// Storage: objetos do prestador auth uid no bucket driver-evidence
try {
  out.storage_objects = await q(
    `select id, bucket_id, name, owner, created_at, updated_at, (metadata->>'size') size
       from storage.objects
      where bucket_id in ('driver-evidence','comprovantes-entrega')
        and (name like '%'||$1||'%' or name like '%'||$2||'%' or name like '%'||$3||'%')
      order by created_at`,
    [AUTHUID, ALOC, PREST]);
} catch (e) { out.storage_objects = { erro: e.message }; }

console.log(JSON.stringify(out, null, 2));
await pool.end();
