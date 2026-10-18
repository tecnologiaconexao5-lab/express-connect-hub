// APP-E2E-11F — inventário READ-ONLY (11E + revalidação 11C/11D).
import pg from "pg";
import fs from "node:fs";

const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;

const A11E = "9314c8f8-1698-4bc9-b227-6c313c226b0b";
const P11E = "f35841b4-5fec-4bf1-961d-35d8f7e93e51";
const A11C = "18d50f0b-704f-4361-8626-ed43c8000601";
const P11C = "b45890ff-454c-40a0-a89e-5333a88eb316";
const AUTH = "a5e51631-5ed8-430d-9041-4b185c03d821";

const out = {};

// ---------- 11E ----------
out.aloc11e = await q(`select * from alocacoes_escala where id=$1`, [A11E]);
out.prest11e = await q(`select * from prestadores where id=$1`, [P11E]);
out.os11e = await q(`select id, numero, status, prestador, cliente, is_teste, created_at from ordens_servico where id=$1 or prestador::text=$2`, [A11E, P11E]);

for (const [t, where] of [
  ["delivery_proofs", `operation_id=$1 or driver_id=$3`],
  ["entregas_protocolo", `alocacao_id=$1 or ordem_servico_id=$1 or prestador_id=$3`],
  ["portal_tracking_realtime", `alocacao_id=$1 or os_id=$1 or prestador_id=$3`],
  ["operacao_localizacao", `alocacao_id=$1 or os_id=$1 or prestador_id=$3`],
  ["historico_alocacoes_escala", `alocacao_id=$1`],
  ["operation_timeline_events", `operation_id=$1 or driver_id=$4`],
  ["financeiro_pagar", `os_id=$1 or fornecedor_id=$3`],
  ["financeiro_receber", `os_id=$1`],
  ["pagamentos_prestadores", `os_id=$1 or prestador_id=$3`],
  ["pagamento_prestadores", `os_id=$1`],
  ["composicao_financeira_os", `os_id::text=$1 or prestador_id::text=$3`],
  ["composicao_financeira", `os_id::text=$1`],
  ["portal_notificacoes", `origem_id=$1 or prestador_id=$3`],
  ["os_pod", `ordem_servico_id=$1`],
  ["reembolsos_prestador", `os_id=$1`],
  ["rotas", `alocacao_id=$1 or os_id=$1`],
  ["rota_paradas", `alocacao_id=$1 or os_id=$1`],
  ["ocorrencias", `alocacao_id=$1 or os_id=$1 or prestador_id=$3`],
  ["os_ocorrencias", `ordem_servico_id=$1`],
  ["fatura_itens", `alocacao_id=$1 or os_id=$1`],
  ["communication_events", `alocacao_id=$1 or os_id=$1 or prestador_id=$3`],
  ["contratos_operacao_execucao", `alocacao_id=$1 or os_id=$1`],
  ["rede_oportunidades", `os_id=$1 or prestador_aceite_id=$3`],
  ["tracking_public_links", `os_id=$1`],
  ["pending_uploads", `operation_id=$1`],
  ["driver_incidents", `operation_id=$1`],
  ["operation_km", `operation_id=$1`],
  ["route_stops", `operation_id=$1`],
  ["prestador_os", `ordem_servico_id=$1 or prestador_id=$3`],
  ["motorista_checkins", `escala_id=$1`],
  ["patio_checkins", `ordem_servico_id=$1`],
  ["sinistros", `os_id=$1`],
  ["fiscal_documentos_vinculados", `ordem_servico_id=$1`],
  ["fiscal_ctes", `ordem_servico_id=$1`],
  ["fiscal_mdfes", `ordem_servico_id=$1`],
  ["fiscal_nfse", `ordem_servico_id=$1`],
  ["escala_operacional", `os_id=$1`],
]) {
  try {
    out[`x_${t}`] = await q(`select * from ${t} where ${where}`, [A11E, P11E, P11E, AUTH]);
  } catch (e) { out[`x_${t}`] = { erro: e.message }; }
}

// Contagens por prestador 11E em colunas uuid/text de vínculo
out.contagens_prest11e = {};
const colsP = await q(
  `select table_name, column_name from information_schema.columns
    where table_schema='public' and column_name in ('prestador_id','driver_id','fornecedor_id','fornecedor_cadastro_id','motorista_id','prestador_vinculado','prestador_aceite_id')
      and table_name not like 'ia_%' order by 1`);
for (const r of colsP) {
  try {
    const n = (await q(`select count(*)::int n from "${r.table_name}" where "${r.column_name}"::text=$1`, [P11E]))[0].n;
    if (n > 0) out.contagens_prest11e[`${r.table_name}.${r.column_name}`] = n;
  } catch { /* tipo incompatível */ }
}

// ---------- Storage ----------
out.storage_11e = await q(
  `select id, bucket_id, name, owner, created_at from storage.objects
    where name like '%'||$1||'%' or name like '%'||$2||'%' order by created_at`, [A11E, P11E]);

out.storage_11c = await q(
  `select id, bucket_id, name, owner, created_at from storage.objects
    where bucket_id='driver-evidence' and name like '%'||$1||'%' order by created_at`, [A11C]);

out.storage_total_auth = (await q(
  `select count(*)::int n from storage.objects where bucket_id='driver-evidence' and name like $1||'%'`, [AUTH]))[0].n;

// ---------- Revalidação 11C (deve permanecer 0 em banco) ----------
out.revalida_11c = {
  alocacoes_escala: (await q(`select count(*)::int n from alocacoes_escala where id=$1`, [A11C]))[0].n,
  ordens_servico: (await q(`select count(*)::int n from ordens_servico where id=$1`, [A11C]))[0].n,
  delivery_proofs: (await q(`select count(*)::int n from delivery_proofs where operation_id=$1`, [A11C]))[0].n,
  entregas_protocolo: (await q(`select count(*)::int n from entregas_protocolo where alocacao_id=$1`, [A11C]))[0].n,
  financeiro_pagar: (await q(`select count(*)::int n from financeiro_pagar where os_id=$1`, [A11C]))[0].n,
  pagamentos_prestadores: (await q(`select count(*)::int n from pagamentos_prestadores where os_id=$1`, [A11C]))[0].n,
  prestador: (await q(`select count(*)::int n from prestadores where id=$1`, [P11C]))[0].n,
};

out.buckets = await q(`select id, public from storage.buckets where id in ('driver-evidence','comprovantes-entrega') order by id`);

console.log(JSON.stringify(out, null, 2));
await pool.end();
