/**
 * FIN-03-BAIXA — Validacao da liquidacao/baixa financeira de prestadores.
 * SOMENTE LEITURA. Saida: scripts/_fin03baixa_validacao.json
 */
import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const out = { ts: new Date().toISOString(), checks: [], pago_pp: [] };
const add = (n, ok, d) => { out.checks.push({ name: n, ok: !!ok, detail: d }); console.log(`${ok ? "OK  " : "FAIL"} ${n} — ${d}`); };

// 0. RPCs/triggers presentes
const procs = await c.query(`select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`);
const names = new Set(procs.rows.map((r) => r.proname));
add("rpc_confirmar_prestador", names.has("f_confirmar_pagamento_prestador"), "f_confirmar_pagamento_prestador presente");
add("rpc_confirmar_fechamento", names.has("f_confirmar_pagamento_fechamento"), "f_confirmar_pagamento_fechamento presente");
add("rpc_gerar_lote", names.has("f_gerar_lote_pagamentos"), "f_gerar_lote_pagamentos presente");
add("rpc_registrar_baixa", names.has("f_registrar_baixa_financeira"), "f_registrar_baixa_financeira presente");
add("rpc_estornar", names.has("f_estornar_pagamento_prestador"), "f_estornar_pagamento_prestador presente");

const trg = await c.query(
  `select c.relname tabela, t.tgname, p.proname funcao
     from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid
    where not t.tgisinternal and p.proname in ('trg_guardar_pagar_pago_sem_baixa','trg_guardar_receber_pago_sem_baixa')`
);
out.guardas = trg.rows;
add("guarda_pagar_sem_baixa", trg.rows.some((r) => r.tabela === "financeiro_pagar"), JSON.stringify(trg.rows));

// 1. financeiro_pagar 'pago' sem baixa (violacao da guarda)
const v1 = await c.query(
  `select count(*)::int n from financeiro_pagar fp
    where fp.status in ('pago','paga','baixado')
      and not exists (select 1 from financeiro_baixas fb where fb.titulo_tabela='financeiro_pagar' and fb.titulo_id=fp.id and not coalesce(fb.estornada,false))`
);
add("financeiro_pagar_pago_com_baixa", v1.rows[0].n === 0, `${v1.rows[0].n} titulos 'pago' SEM baixa`);

// 2. integridade das baixas
const v2 = await c.query(
  `select count(*)::int total,
          count(*) filter (where abs((valor_original - valor_baixado) - saldo_restante) > 0.02)::int saldo_errado,
          count(*) filter (where valor_baixado > valor_original + 0.02)::int excede,
          count(*) filter (where valor_baixado <= 0)::int zerada,
          count(*) filter (where conta_financeira_id is null)::int sem_conta,
          count(*) filter (where titulo_tabela='financeiro_pagar')::int pagar,
          count(*) filter (where estornada)::int estornadas
     from financeiro_baixas`
);
out.baixas = v2.rows[0];
add("baixa_saldo_integra", v2.rows[0].saldo_errado === 0, `${v2.rows[0].saldo_errado} baixas com saldo inconsistente`);
add("baixa_nao_excede", v2.rows[0].excede === 0, `${v2.rows[0].excede} baixas excedem o titulo`);

// 3. PP status_pagamento=pago -> vinculo a baixa
const v3 = await c.query(
  `select pp.id, pp.prestador_nome, pp.os_id, pp.valor_liquido, pp.status, pp.status_pagamento,
          pp.data_pagamento, pp.origem_lancamento, pp.created_at::date,
          fp.id as fp_id, fp.status as fp_status, fp.valor as fp_valor,
          fb.id as fb_id, fb.valor_baixado, fb.conta_financeira_id, fb.data_baixa
     from pagamentos_prestadores pp
     left join financeiro_pagar fp on fp.os_id = pp.os_id::text
     left join financeiro_baixas fb on fb.titulo_tabela='financeiro_pagar' and fb.titulo_id=fp.id and not coalesce(fb.estornada,false)
    where pp.status_pagamento='pago'`
);
out.pago_pp = v3.rows;
const comBaixa = v3.rows.filter((r) => r.fb_id).length;
add("pp_pago_com_baixa", comBaixa === v3.rows.length, `${comBaixa}/${v3.rows.length} PP 'pago' com baixa vinculada`);

// 4. ciclo: PP pago -> financeiro_pagar pago + data_pagamento preenchida
const v4 = await c.query(
  `select count(*)::int n,
          count(*) filter (where fp.status in ('pago','paga'))::int fp_pago,
          count(*) filter (where pp.data_pagamento is null)::int sem_data
     from pagamentos_prestadores pp
     left join financeiro_pagar fp on fp.os_id = pp.os_id::text
    where pp.status_pagamento='pago'`
);
add("ciclo_pagar_pago", v4.rows[0].fp_pago === v4.rows[0].n, `${v4.rows[0].fp_pago}/${v4.rows[0].n} com financeiro_pagar 'pago'`);

// 5. elegiveis a lote
const v5 = await c.query(
  `select
     count(*) filter (where status_conferencia='conferido' and status_aprovacao='aprovado')::int conferido_aprovado,
     count(*) filter (where elegivel_lote is true)::int elegivel,
     count(*) filter (where status_pagamento='em_lote')::int em_lote,
     count(*) filter (where lote_id is not null)::int com_lote
     from pagamentos_prestadores`
);
out.elegibilidade = v5.rows[0];
console.log("elegibilidade lote:", JSON.stringify(v5.rows[0]));

// 6. distribuicao status_pagamento
const v6 = await c.query(`select coalesce(status_pagamento,'<null>') s, count(*)::int n from pagamentos_prestadores group by 1 order by 2 desc`);
out.distribuicao = v6.rows;
console.log("status_pagamento:", JSON.stringify(v6.rows));

await c.end();
fs.writeFileSync("scripts/_fin03baixa_validacao.json", JSON.stringify(out, null, 2));
const falhas = out.checks.filter((x) => !x.ok).length;
console.log(`\nCHECKSUM: ${out.checks.length - falhas}/${out.checks.length} OK`);
console.log("EVIDENCIA: scripts/_fin03baixa_validacao.json");
