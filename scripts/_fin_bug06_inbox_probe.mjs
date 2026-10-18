import fs from "node:fs";
import { Client } from "pg";
const DB = (fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.+)$/m)||[])[1];
const pg = new Client({ connectionString: DB.trim() });
await pg.connect();
const rows = (await pg.query(`SELECT id, prestador_nome, valor_liquido, valor_servicos, status, status_pagamento, status_aprovacao, data_competencia, created_at
  FROM public.pagamentos_prestadores
  WHERE is_teste = false AND status_aprovacao = 'aguardando_aprovacao'
  ORDER BY data_competencia DESC NULLS LAST`)).rows;
console.log("INBOX (sem filtro de periodo) => " + rows.length + " registro(s)");
for (const r of rows) console.log(` - ${r.id.slice(0,8)} | ${r.prestador_nome ?? "(sem nome)"} | R$ ${r.valor_liquido} | comp ${String(r.data_competencia).slice(0,10)} | ${r.status_pagamento}`);
// quantos seriam escondidos pelo filtro do mes atual (out/2026)
const mes = (await pg.query(`SELECT count(*)::int AS qtd FROM public.pagamentos_prestadores
  WHERE is_teste=false AND status_aprovacao='aguardando_aprovacao'
    AND periodo_inicio BETWEEN '2026-10-01' AND '2026-10-31'`)).rows[0].qtd;
console.log("Somente no periodo padrao (2026-10) => " + mes + " registro(s) — o restante estava oculto.");
await pg.end();
