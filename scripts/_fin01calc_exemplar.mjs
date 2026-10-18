import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const t = await c.query(
  `select id, numero, status, data, valor_cliente, custo_prestador, pedagio, created_at
     from ordens_servico
    where numero ilike '%TEST%' or numero ilike '%HML%' or numero ilike '%GO-LIVE%' or numero ilike '%AUDIT%'
    order by created_at desc limit 15`
);
console.log("OS teste/hml/go-live:", JSON.stringify(t.rows, null, 2));

const r = await c.query(
  `select o.id, o.numero, o.status, o.data, o.valor_cliente, o.custo_prestador, o.pedagio,
          o.adicionais, o.ajudante, o.descontos, o.created_at,
          comp.margem_bruta, comp.margem_liquida, comp.imposto_valor, comp.seguro_valor,
          comp.outros_custos, comp.percentual_margem_bruta, comp.percentual_margem_liquida,
          comp.origem_calculo
     from ordens_servico o
     join composicao_financeira_os comp on comp.os_id = o.id
    order by o.created_at desc limit 8`
);
console.log("\n8 composicoes mais recentes:", JSON.stringify(r.rows, null, 2));

await c.end();
