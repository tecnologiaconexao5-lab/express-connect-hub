import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

console.log("=== ORFAOS (pp.os_id sem OS) — por origem_lancamento/created ===");
const orf = await c.query(
  `select origem_lancamento, status_pagamento, classificacao_dado, is_teste,
          count(*)::int n, min(created_at)::date d0, max(created_at)::date d1
     from pagamentos_prestadores pp
    where pp.os_id is not null
      and not exists (select 1 from ordens_servico o where o.id = pp.os_id)
    group by 1,2,3,4 order by n desc`
);
console.log(JSON.stringify(orf.rows, null, 2));

const orf2 = await c.query(
  `select pp.os_id, pp.prestador_nome, pp.os_numero, pp.valor_servicos, pp.valor_liquido,
          pp.origem_lancamento, pp.status_pagamento, pp.created_at::date
     from pagamentos_prestadores pp
    where pp.os_id is not null
      and not exists (select 1 from ordens_servico o where o.id = pp.os_id)
    order by pp.created_at limit 10`
);
console.log("\namostra orfaos:", JSON.stringify(orf2.rows, null, 2));

console.log("\n=== OS FINALIZADAS c/ REPASSE SEM pagamentos_prestadores ===");
const semPP = await c.query(
  `select o.numero, o.status, o.custo_prestador, o.valor_cliente, o.created_at::date,
          (o.prestador_id is null) as sem_prestador_id
     from ordens_servico o
    where o.status in ('finalizada','concluida') and coalesce(o.custo_prestador,0) > 0
      and not exists (select 1 from pagamentos_prestadores pp where pp.os_id = o.id)
    order by o.created_at`
);
console.log(JSON.stringify(semPP.rows, null, 2));

console.log("\n=== DIVERGENCIAS valor_liquido OS x PP ===");
const div = await c.query(
  `select o.numero, pp.prestador_nome, o.custo_prestador, o.pedagio, o.adicionais, o.descontos,
          pp.valor_servicos, pp.valor_liquido, pp.created_at::date
     from ordens_servico o join pagamentos_prestadores pp on pp.os_id = o.id
    where abs(coalesce(pp.valor_liquido,0) - (coalesce(o.custo_prestador,0)+coalesce(o.pedagio,0)
       + coalesce((case when jsonb_typeof(o.adicionais)='number' then (o.adicionais#>>'{}')::numeric else coalesce((o.adicionais->>'valor')::numeric,0) end),0)
       - coalesce(o.descontos,0))) > 0.02
    order by o.created_at`
);
console.log(JSON.stringify(div.rows, null, 2));

console.log("\n=== CONTAGEM GERAL ===");
const g = await c.query(
  `select
     (select count(*)::int from pagamentos_prestadores) pp_total,
     (select count(*)::int from pagamentos_prestadores where os_id is not null) pp_com_os,
     (select count(*)::int from pagamentos_prestadores where origem_lancamento='manual') pp_manual,
     (select count(*)::int from pagamentos_prestadores where origem_lancamento in ('escala_direta','os_direta')) pp_operacional,
     (select count(*)::int from pagamentos_prestadores where is_teste=true) pp_teste`
);
console.log(JSON.stringify(g.rows[0], null, 2));

await c.end();
