// APP-E2E-11C — auditoria READ-ONLY parte 4 (cadeia financeira/derivados + storage config).
import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;

const ALOC = "18d50f0b-704f-4361-8626-ed43c8000601";
const PREST = "b45890ff-454c-40a0-a89e-5333a88eb316";
const AUTHUID = "a5e51631-5ed8-430d-9041-4b185c03d821";

const cols = async (t) => (await q(`select column_name from information_schema.columns where table_schema='public' and table_name=$1`, [t])).map(r => r.column_name);
const out = {};

// ids dos títulos
const pagar = await q(`select id, os_id, valor from financeiro_pagar where os_id=$1`, [ALOC]);
const pag = await q(`select p.id, p.os_id, p.origem_lancamento from pagamentos_prestadores p where p.os_id=$1`, [ALOC]);
const ids = [ALOC, ...pagar.map(r => r.id), ...pag.map(r => r.id)];
out.ids_financeiros = ids;

// financeiro_baixas por titulo_id
try {
  out.financeiro_baixas = await q(`select * from financeiro_baixas where titulo_id::text = any($1) or titulo_id::text=$2`, [ids, ALOC]);
} catch (e) { out.financeiro_baixas = { erro: e.message }; }

// tabelas singulares
for (const t of ["pagamento_prestadores", "pagamentos_prestadores_itens", "composicao_financeira", "composicao_financeira_os", "os_pod", "reembolsos_prestador", "portal_notificacoes"]) {
  const c = await cols(t);
  if (!c.length) { out[t] = { nao_existe: true }; continue; }
  const w = [];
  if (c.includes("os_id")) w.push("os_id::text=$1");
  if (c.includes("ordem_servico_id")) w.push("ordem_servico_id::text=$1");
  if (c.includes("prestador_id")) w.push("prestador_id::text=$2");
  if (c.includes("alocacao_id")) w.push("alocacao_id::text=$1");
  try {
    out[t] = w.length ? await q(`select * from ${t} where ${w.join(" or ")}`, [ALOC, PREST]) : { cols: c, sem_vinculo: true };
  } catch (e) { out[t] = { erro: e.message }; }
}

// qualquer OS do prestador
out.os_do_prestador = await q(`select id, numero, status from ordens_servico where prestador=$1 or id=$2`, [PREST, ALOC]);

// bucket privado?
out.storage_buckets = await q(`select id, name, public, file_size_limit, allowed_mime_types from storage.buckets where id in ('driver-evidence','comprovantes-entrega')`);

// contagens globais antes do rollback (para comparação pós) — somente tabelas da fixture
out.antes = {
  alocacoes_escala: (await q(`select count(*)::int n from alocacoes_escala where id=$1`, [ALOC]))[0].n,
  ordens_servico: (await q(`select count(*)::int n from ordens_servico where id=$1`, [ALOC]))[0].n,
  delivery_proofs: (await q(`select count(*)::int n from delivery_proofs where operation_id=$1`, [ALOC]))[0].n,
  entregas_protocolo: (await q(`select count(*)::int n from entregas_protocolo where alocacao_id=$1`, [ALOC]))[0].n,
  historico_alocacoes_escala: (await q(`select count(*)::int n from historico_alocacoes_escala where alocacao_id=$1`, [ALOC]))[0].n,
  operation_timeline_events: (await q(`select count(*)::int n from operation_timeline_events where operation_id=$1`, [ALOC]))[0].n,
  portal_tracking_realtime: (await q(`select count(*)::int n from portal_tracking_realtime where alocacao_id=$1`, [ALOC]))[0].n,
  operacao_localizacao: (await q(`select count(*)::int n from operacao_localizacao where alocacao_id=$1`, [ALOC]))[0].n,
  financeiro_pagar: (await q(`select count(*)::int n from financeiro_pagar where os_id=$1`, [ALOC]))[0].n,
  pagamentos_prestadores: (await q(`select count(*)::int n from pagamentos_prestadores where os_id=$1`, [ALOC]))[0].n,
  composicao_financeira_os: (await q(`select count(*)::int n from composicao_financeira_os where os_id::text=$1`, [ALOC]).catch(() => [{ n: "n/a" }]))[0].n,
  prestadores: (await q(`select count(*)::int n from prestadores where id=$1`, [PREST]))[0].n,
  storage_fixture: (await q(`select count(*)::int n from storage.objects where bucket_id='driver-evidence' and name like '%'||$1||'%'`, [ALOC]))[0].n,
};

console.log(JSON.stringify(out, null, 2));
await pool.end();
