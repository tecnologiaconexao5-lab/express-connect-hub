import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const defs = {};
for (const sig of [
  "f_confirmar_pagamento_prestador(uuid,date,numeric)",
  "f_confirmar_pagamento_fechamento(uuid,date)",
  "f_gerar_lote_pagamentos(uuid[])",
  "f_registrar_baixa_financeira(text,uuid,numeric,date,text,text,uuid,text,text,uuid,text)",
]) {
  try {
    const r = await c.query(`select pg_get_functiondef($1::regprocedure) as def`, [sig]);
    defs[sig] = r.rows[0]?.def || null;
  } catch (e) {
    defs[sig] = "ERRO: " + e.message;
  }
}
fs.writeFileSync("scripts/_fin03baixa_defs.sql", Object.entries(defs).map(([k, v]) => `########## ${k} ##########\n${v}`).join("\n\n"), "utf8");
console.log("defs gravadas em scripts/_fin03baixa_defs.sql");

// financeiro_baixas colunas
const fbCols = await c.query(`select column_name, data_type from information_schema.columns where table_name='financeiro_baixas' order by ordinal_position`);
console.log("\nfinanceiro_baixas cols:", fbCols.rows.map((x) => x.column_name).join(", "));
const fbCnt = await c.query(`select
   count(*)::int total,
   count(*) filter (where not estornada)::int ativas,
   count(*) filter (where titulo_tabela='financeiro_pagar')::int pagar,
   count(*) filter (where titulo_tabela='financeiro_receber')::int receber,
   count(*) filter (where conta_financeira_id is null)::int sem_conta
   from financeiro_baixas`);
console.log("financeiro_baixas resumo:", JSON.stringify(fbCnt.rows[0]));

// distribuicao status_pagamento
const dist = await c.query(`select coalesce(status_pagamento,'<null>') s, count(*)::int n from pagamentos_prestadores group by 1 order by 2 desc`);
console.log("\npagamentos_prestadores.status_pagamento:", JSON.stringify(dist.rows));

const distConf = await c.query(`select coalesce(status_conferencia,'<null>') s, coalesce(status_aprovacao,'<null>') a, count(*)::int n from pagamentos_prestadores group by 1,2 order by 3 desc`);
console.log("\nstatus_conferencia/status_aprovacao:", JSON.stringify(distConf.rows));

// lotes
const lot = await c.query(`select count(*)::int n from lotes_pagamento`);
console.log("\nlotes_pagamento:", lot.rows[0].n);

// pagos SEM baixa (financeiro_pagar)
const pagoSemBaixa = await c.query(`
  select count(*)::int n from financeiro_pagar fp
   where fp.status in ('pago','paga','baixado')
     and not exists (select 1 from financeiro_baixas fb where fb.titulo_tabela='financeiro_pagar' and fb.titulo_id=fp.id and not fb.estornada)`);
console.log("financeiro_pagar 'pago' SEM baixa:", pagoSemBaixa.rows[0].n);

// PP pago x baixa via financeiro_pagar os_id
const ppPago = await c.query(`
  select count(*)::int n,
         count(*) filter (where fp.id is null)::int sem_pagar,
         count(*) filter (where fb.id is null)::int sem_baixa
    from pagamentos_prestadores pp
    left join financeiro_pagar fp on fp.os_id = pp.os_id::text
    left join financeiro_baixas fb on fb.titulo_tabela='financeiro_pagar' and fb.titulo_id=fp.id and not fb.estornada
   where pp.status_pagamento='pago'`);
console.log("PP status_pagamento=pago:", JSON.stringify(ppPago.rows[0]));

await c.end();
