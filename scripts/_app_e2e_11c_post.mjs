// APP-E2E-11C — PROVA PÓS-ROLLBACK (read-only).
import pg from "pg";
import fs from "node:fs";
const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;

const ALOC = "18d50f0b-704f-4361-8626-ed43c8000601";
const PREST = "b45890ff-454c-40a0-a89e-5333a88eb316";
const AUTHUID = "a5e51631-5ed8-430d-9041-4b185c03d821";

const out = {};
out.fixture = {
  alocacoes_escala: (await q(`select count(*)::int n from alocacoes_escala where id=$1`, [ALOC]))[0].n,
  ordens_servico: (await q(`select count(*)::int n from ordens_servico where id=$1 or numero=$2`, [ALOC, "ALOC-20260928-18D50F0B"]))[0].n,
  delivery_proofs: (await q(`select count(*)::int n from delivery_proofs where operation_id=$1`, [ALOC]))[0].n,
  entregas_protocolo: (await q(`select count(*)::int n from entregas_protocolo where alocacao_id=$1 or ordem_servico_id=$1`, [ALOC]))[0].n,
  historico_alocacoes_escala: (await q(`select count(*)::int n from historico_alocacoes_escala where alocacao_id=$1`, [ALOC]))[0].n,
  operation_timeline_events: (await q(`select count(*)::int n from operation_timeline_events where operation_id=$1`, [ALOC]))[0].n,
  portal_tracking_realtime: (await q(`select count(*)::int n from portal_tracking_realtime where alocacao_id=$1`, [ALOC]))[0].n,
  operacao_localizacao: (await q(`select count(*)::int n from operacao_localizacao where alocacao_id=$1`, [ALOC]))[0].n,
  financeiro_pagar: (await q(`select count(*)::int n from financeiro_pagar where os_id=$1`, [ALOC]))[0].n,
  pagamentos_prestadores: (await q(`select count(*)::int n from pagamentos_prestadores where os_id=$1`, [ALOC]))[0].n,
  composicao_financeira_os: (await q(`select count(*)::int n from composicao_financeira_os where os_id::text=$1`, [ALOC]))[0].n,
  portal_notificacoes: (await q(`select count(*)::int n from portal_notificacoes where origem_id=$1`, [ALOC]))[0].n,
  prestador: (await q(`select count(*)::int n from prestadores where id=$1`, [PREST]))[0].n,
};

out.auth_user_preservado = await q(
  `select id, email, last_sign_in_at from auth.users where id=$1`, [AUTHUID]);

out.storage_fixture = await q(
  `select id, name, created_at from storage.objects where bucket_id='driver-evidence' and name like '%'||$1||'%' order by name`, [ALOC]);

out.storage_total_authuid = (await q(
  `select count(*)::int n from storage.objects where bucket_id='driver-evidence' and name like $1||'%'`, [AUTHUID]))[0].n;

// Sanidade: totais globais das tabelas tocadas (não podem ficar negativos/zerados de forma suspeita)
out.totais_globais = {
  alocacoes_escala: (await q(`select count(*)::int n from alocacoes_escala`))[0].n,
  ordens_servico: (await q(`select count(*)::int n from ordens_servico`))[0].n,
  prestadores: (await q(`select count(*)::int n from prestadores`))[0].n,
  pagamentos_prestadores: (await q(`select count(*)::int n from pagamentos_prestadores`))[0].n,
  financeiro_pagar: (await q(`select count(*)::int n from financeiro_pagar`))[0].n,
  delivery_proofs: (await q(`select count(*)::int n from delivery_proofs`))[0].n,
  entregas_protocolo: (await q(`select count(*)::int n from entregas_protocolo`))[0].n,
  portal_tracking_realtime: (await q(`select count(*)::int n from portal_tracking_realtime`))[0].n,
};

console.log(JSON.stringify(out, null, 2));
await pool.end();
