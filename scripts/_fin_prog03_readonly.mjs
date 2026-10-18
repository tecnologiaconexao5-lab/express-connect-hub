// TMS-FIN-PROG-03 — Coleta READ-ONLY de indicadores financeiros reais.
// SOMENTE SELECT. Nenhuma escrita. Nenhuma migration. Nenhuma RLS.
import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) throw new Error("DATABASE_URL ausente");
const connectionString = m[1].trim();

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

const today = new Date().toISOString().split("T")[0];
const now = new Date();
const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}

const out = {};
out.meta = { today, mesAtual, em7dias };

// Tenants
out.tenants = await q(`select count(*)::int n from tenant_usuarios`).then(r => r[0]?.n);

// --- financeiro_pagar: por status ---
out.pagar_por_status = await q(`
  select status, count(*)::int n, coalesce(sum(valor),0)::numeric total
  from financeiro_pagar where is_teste = false
  group by status order by status`);

// --- financeiro_pagar: status usados pelo dashboard ---
const PAGAR_STATUS = ["aberto", "a vencer", "a_vencer", "pendente", "vencido"];
out.pagar_dashboard_set = await q(`
  select count(*)::int n, coalesce(sum(valor),0)::numeric total
  from financeiro_pagar
  where is_teste = false and status = any($1)`, [PAGAR_STATUS]);

out.pagar_dashboard_geral = await q(`
  select count(*)::int n, coalesce(sum(valor),0)::numeric total
  from financeiro_pagar
  where is_teste = false and status = any($1)
    and fornecedor_id is null and prestador is null`, [PAGAR_STATUS]);

out.pagar_dashboard_prestador = await q(`
  select count(*)::int n, coalesce(sum(valor),0)::numeric total
  from financeiro_pagar
  where is_teste = false and status = any($1)
    and (fornecedor_id is not null or prestador is not null)`, [PAGAR_STATUS]);

// a pagar geral vencendo em ate 7 dias (status a_vencer/vencido etc.)
out.pagar_geral_7d = await q(`
  select count(*)::int n, coalesce(sum(valor),0)::numeric total
  from financeiro_pagar
  where is_teste = false and status = any($1)
    and fornecedor_id is null and prestador is null
    and data_vencimento >= $2 and data_vencimento <= $3`, [PAGAR_STATUS, today, em7dias]);

// --- financeiro_receber (dashboard carrega tudo, is_teste=false) ---
out.receber_por_status = await q(`
  select status, count(*)::int n, coalesce(sum(valor),0)::numeric total
  from financeiro_receber where is_teste = false
  group by status order by status`);

out.receber_total = await q(`
  select count(*)::int n, coalesce(sum(valor),0)::numeric total
  from financeiro_receber where is_teste = false`);

// a receber 7 dias (status efetivo a_vencer/vence_hoje)
out.receber_7d = await q(`
  select count(*)::int n, coalesce(sum(valor),0)::numeric total
  from financeiro_receber
  where is_teste = false
    and coalesce(data_pagamento) is null
    and coalesce(data_vencimento, vencimento) >= $1
    and coalesce(data_vencimento, vencimento) <= $2`, [today, em7dias]);

// inadimplencia (status vencido/atrasado OU em aberto com vencimento < hoje)
out.receber_inadimplencia = await q(`
  select count(*)::int n, coalesce(sum(valor),0)::numeric total,
         count(distinct coalesce(cliente_id::text, cliente))::int clientes
  from financeiro_receber
  where is_teste = false
    and coalesce(data_pagamento) is null
    and (
      status in ('vencido','atrasado')
      or (status in ('aberto','pendente','a vencer','a_vencer') and coalesce(data_vencimento, vencimento) < $1)
    )`, [today]);

// recebido (baixa) — financeiro_baixas
out.baixas_receber = await q(`
  select count(*)::int n, coalesce(sum(valor_baixado),0)::numeric total
  from financeiro_baixas where titulo_tabela = 'financeiro_receber'`);
out.baixas_pagar = await q(`
  select count(*)::int n, coalesce(sum(valor_baixado),0)::numeric total
  from financeiro_baixas where titulo_tabela = 'financeiro_pagar'`);

// --- pagamentos_prestadores pendentes ---
out.pag_prest_por_status = await q(`
  select status_pagamento, count(*)::int n, coalesce(sum(valor_liquido),0)::numeric total
  from pagamentos_prestadores where is_teste = false
  group by status_pagamento order by status_pagamento`);

out.repasses_pendentes = await q(`
  select count(*)::int n, coalesce(sum(valor_liquido),0)::numeric total
  from pagamentos_prestadores
  where is_teste = false and status_pagamento = any($1)`, [["pendente", "agendado", "em_lote"]]);

// --- ordens_servico finalizada/concluida mes atual e 6 meses ---
out.os_mes_atual = await q(`
  select count(*)::int n,
         coalesce(sum(valor_cliente),0)::numeric receita,
         coalesce(sum(custo_prestador),0)::numeric custo
  from ordens_servico
  where status = any($1) and data >= $2`, [["finalizada", "concluida"], `${mesAtual}-01`]);

out.os_6m = await q(`
  select to_char(date_trunc('month', data), 'YYYY-MM') mes, count(*)::int n,
         coalesce(sum(valor_cliente),0)::numeric receita,
         coalesce(sum(custo_prestador),0)::numeric custo
  from ordens_servico
  where status = any($1) and data >= $2
  group by 1 order by 1`, [["finalizada", "concluida"], `${new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0]}`]);

// --- faturas (informativo / diferencas conhecidas) ---
out.faturas_por_status = await q(`
  select status, count(*)::int n, coalesce(sum(valor_total),0)::numeric total
  from faturas group by status order by status`);

out.faturas_emitidas_sem_ar = await q(`
  select count(*)::int n, coalesce(sum(valor_total),0)::numeric total
  from faturas where status = 'emitida' and conta_receber_id is null`);

out.receber_sem_fatura = await q(`
  select count(*)::int n from financeiro_receber where is_teste = false and fatura_id is null`);

// datas de referencia
out.datas = await q(`
  select
    (select min(data_vencimento)::text from financeiro_receber where is_teste=false) rec_min_venc,
    (select max(data_vencimento)::text from financeiro_receber where is_teste=false) rec_max_venc,
    (select min(data_vencimento)::text from financeiro_pagar where is_teste=false) pag_min_venc,
    (select max(data_vencimento)::text from financeiro_pagar where is_teste=false) pag_max_venc`);

console.log(JSON.stringify(out, (k, v) => (typeof v === "bigint" ? Number(v) : v), 2));
await pool.end();
