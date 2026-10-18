import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;
const fin = (n) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const out = {};
out.cancelStatuses = "(cancelado,cancelada)";

// CONTAS A RECEBER (real): is_teste=false + status nao cancelado
out.contasReceber = {
  total_bruto: (await q(`select count(*)::int n, coalesce(sum(valor),0) v from financeiro_receber`))[0],
  teste_excluido: (await q(`select count(*)::int n, coalesce(sum(valor),0) v from financeiro_receber where is_teste=true`))[0],
  cancelado_excluido: (await q(`select count(*)::int n, coalesce(sum(valor),0) v from financeiro_receber where lower(status) in ('cancelado','cancelada')`))[0],
  real_exibivel: (await q(`select count(*)::int n, coalesce(sum(valor),0) v from financeiro_receber where is_teste=false and lower(status) not in ('cancelado','cancelada')`))[0],
};

// DRE (receita competencia): is_teste=false + status != cancelado
out.dre = {
  receita_bruta_total: (await q(`select coalesce(sum(valor),0) v from financeiro_receber`))[0],
  receita_real: (await q(`select coalesce(sum(valor),0) v from financeiro_receber where is_teste=false and lower(status) not in ('cancelado','cancelada')`))[0],
};

// FLUXO — previsto entrada: is_teste=false + status != cancelado
out.fluxoPrevisto = {
  antes: (await q(`select count(*)::int n, coalesce(sum(valor),0) v from financeiro_receber`))[0],
  depois: (await q(`select count(*)::int n, coalesce(sum(valor),0) v from financeiro_receber where is_teste=false and lower(status) not in ('cancelado','cancelada')`))[0],
};

// FLUXO — realizado: baixas nao estornadas cujo titulo NAO e teste
out.fluxoRealizado = {
  baixas_ativas_total: (await q(`select count(*)::int n, coalesce(sum(valor_baixado),0) v from financeiro_baixas where titulo_tabela='financeiro_receber' and not estornada`))[0],
  baixas_teste_excluidas: (await q(`select count(b.id)::int n, coalesce(sum(b.valor_baixado),0) v from financeiro_baixas b where b.titulo_tabela='financeiro_receber' and not b.estornada and exists (select 1 from financeiro_receber r where r.id=b.titulo_id and r.is_teste=true)`))[0],
  baixas_reais: (await q(`select count(b.id)::int n, coalesce(sum(b.valor_baixado),0) v from financeiro_baixas b where b.titulo_tabela='financeiro_receber' and not b.estornada and not exists (select 1 from financeiro_receber r where r.id=b.titulo_id and r.is_teste=true)`))[0],
};

// Provas especificas
out.prova_75_cancelado = await q(`select id, valor, status, os_id from financeiro_receber where id='75e0e5f0-c512-49b6-9542-716362705c08'`);
out.prova_75_fora_do_real = (await q(`select count(*)::int n from financeiro_receber where id='75e0e5f0-c512-49b6-9542-716362705c08' and is_teste=false and lower(status) not in ('cancelado','cancelada')`))[0].n === 0;
out.prova_77_testes_excluidos = (await q(`select count(*)::int n, coalesce(sum(valor),0) v from financeiro_receber where is_teste=true`))[0];
out.prova_dois_testes_pagos = await q(`select id, valor, status, data_pagamento::text dp, is_teste from financeiro_receber where id in ('cf6eea7b-4c9d-4200-b306-4d209764112f','fb30838a-fc5f-430f-9aa3-9b7892e564d4')`);
out.prova_pagos_fora_do_real = (await q(`select count(*)::int n from financeiro_receber where id in ('cf6eea7b-4c9d-4200-b306-4d209764112f','fb30838a-fc5f-430f-9aa3-9b7892e564d4') and is_teste=false and lower(status) not in ('cancelado','cancelada')`))[0].n === 0;
out.outros_cancelados = await q(`select id, valor, status from financeiro_receber where lower(status) in ('cancelado','cancelada')`);

// amostra de IDs do total real
out.amostra_real = await q(`select id, valor, status from financeiro_receber where is_teste=false and lower(status) not in ('cancelado','cancelada') order by valor desc limit 5`);

// snapshot de contagens (prova banco inalterado)
out.contagens = {
  receber_total: (await q(`select count(*)::int n from financeiro_receber`))[0].n,
  baixas_total: (await q(`select count(*)::int n from financeiro_baixas`))[0].n,
  faturas_total: (await q(`select count(*)::int n from faturas`))[0].n,
};

console.log(JSON.stringify(out, null, 2));
await p.end();
