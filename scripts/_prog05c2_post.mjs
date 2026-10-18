import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;
const D_IDS = JSON.parse(fs.readFileSync("temp/prog05c2_snapshot_pre.json", "utf8").replace(/^\uFEFF/, "")).d_ids.map((d) => d.id);
const out = {
  receber_total: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber`))[0],
  teste_true: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber where is_teste=true`))[0],
  real_false: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber where is_teste=false or is_teste is null`))[0],
  cancelados: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber where lower(status) in ('cancelado','cancelada')`))[0],
  ar_oficial_fatura: (await q(`select count(*)::int n, coalesce(sum(valor),0) total from financeiro_receber where fatura_id is not null`))[0],
  por_os: (await q(`select count(*)::int n from financeiro_receber where os_id is not null`))[0].n,
  sem_ambos: (await q(`select count(*)::int n from financeiro_receber where os_id is null and fatura_id is null`))[0].n,
  baixas_total: (await q(`select count(*)::int n from financeiro_baixas`))[0].n,
  d_marcados_test: (await q(`select count(*)::int n from financeiro_receber where id=any($1) and is_teste=true`, [D_IDS]))[0].n,
  ar_75: (await q(`select id, valor, status, os_id, observacoes from financeiro_receber where id='75e0e5f0-c512-49b6-9542-716362705c08'`))[0],
  ar_oficial_346687cf: (await q(`select id, valor, status from financeiro_receber where id='346687cf-f35d-4cde-8a26-47bdcff46de1'`))[0],
  anti_dup_sha: null,
};
const def = (await q(`select pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='f_trg_fatura_itens_anti_duplicidade'`))[0].def;
out.anti_dup_sha = (await import("node:crypto")).createHash("sha256").update(def).digest("hex").slice(0, 16);
out.anti_dup_tem_alocacao = /alocacao_id/.test(def);
const pagos = await q(`select id, valor, status, data_pagamento::text dp, is_teste from financeiro_receber where id in ('fb30838a-fc5f-430f-9aa3-9b7892e564d4') or (is_teste=true and lower(status) in ('pago','parcial')) order by id`);
out.pagos_teste = pagos;
console.log(JSON.stringify(out, null, 2));
await p.end();
