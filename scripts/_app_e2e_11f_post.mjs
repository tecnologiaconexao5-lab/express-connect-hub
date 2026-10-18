// APP-E2E-11F — PROVA PÓS-LIMPEZA + regressão de estado (read-only).
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
out.fixture11e = {
  alocacoes_escala: (await q(`select count(*)::int n from alocacoes_escala where id=$1`, [A11E]))[0].n,
  ordens_servico: (await q(`select count(*)::int n from ordens_servico where id=$1 or numero='ALOC-20260928-9314C8F8'`, [A11E]))[0].n,
  prestadores: (await q(`select count(*)::int n from prestadores where id=$1`, [P11E]))[0].n,
  historico_alocacoes_escala: (await q(`select count(*)::int n from historico_alocacoes_escala where alocacao_id=$1`, [A11E]))[0].n,
  operation_timeline_events: (await q(`select count(*)::int n from operation_timeline_events where operation_id=$1`, [A11E]))[0].n,
  portal_notificacoes: (await q(`select count(*)::int n from portal_notificacoes where origem_id=$1 or prestador_id=$2`, [A11E, P11E]))[0].n,
  financeiro_pagar: (await q(`select count(*)::int n from financeiro_pagar where os_id=$1 or fornecedor_id=$2`, [A11E, P11E]))[0].n,
  pagamentos_prestadores: (await q(`select count(*)::int n from pagamentos_prestadores where os_id=$1 or prestador_id=$2`, [A11E, P11E]))[0].n,
};

out.fixture11c = {
  alocacoes_escala: (await q(`select count(*)::int n from alocacoes_escala where id=$1`, [A11C]))[0].n,
  ordens_servico: (await q(`select count(*)::int n from ordens_servico where id=$1`, [A11C]))[0].n,
  prestadores: (await q(`select count(*)::int n from prestadores where id=$1`, [P11C]))[0].n,
};

out.auth_user_preservado = await q(`select id, email, last_sign_in_at from auth.users where id=$1`, [AUTH]);
out.storage_11c = await q(`select id, name from storage.objects where bucket_id='driver-evidence' and name like '%'||$1||'%' order by name`, [A11C]);
out.storage_11e = await q(`select id, name from storage.objects where name like '%'||$1||'%' or name like '%'||$2||'%'`, [A11E, P11E]);
out.storage_total_auth = (await q(`select count(*)::int n from storage.objects where bucket_id='driver-evidence' and name like $1||'%'`, [AUTH]))[0].n;
out.buckets = await q(`select id, public from storage.buckets where id in ('driver-evidence','comprovantes-entrega') order by id`);

// Sanidade global (sem exclusão em massa)
out.totais = {
  alocacoes_escala: (await q(`select count(*)::int n from alocacoes_escala`))[0].n,
  ordens_servico: (await q(`select count(*)::int n from ordens_servico`))[0].n,
  prestadores: (await q(`select count(*)::int n from prestadores`))[0].n,
  financeiro_pagar: (await q(`select count(*)::int n from financeiro_pagar`))[0].n,
  pagamentos_prestadores: (await q(`select count(*)::int n from pagamentos_prestadores`))[0].n,
};

console.log(JSON.stringify(out, null, 2));
await pool.end();
