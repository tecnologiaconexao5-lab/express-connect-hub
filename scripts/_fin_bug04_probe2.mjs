/**
 * FIN-BUG-04 — READ-ONLY (2): natureza + função de produção. Saida: scripts\_fin_bug04_probe2.json
 */
import fs from "node:fs";
import { Client } from "pg";
const DB = (fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m) || [])[1];
const pg = new Client({ connectionString: DB.trim() });
await pg.connect();
const out = { ts: new Date().toISOString() };

out.natureza_dist = (await pg.query(
  `SELECT COALESCE(natureza,'<NULL>') AS natureza, count(*)::int AS qtd
   FROM public.pagamentos_prestadores GROUP BY 1 ORDER BY 2 DESC`)).rows;

out.natureza_manual = (await pg.query(
  `SELECT COALESCE(natureza,'<NULL>') AS natureza, count(*)::int AS qtd
   FROM public.pagamentos_prestadores WHERE origem_lancamento='manual' GROUP BY 1`)).rows;

out.fn = (await pg.query(
  `SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='f_criar_lancamento_manual_prestador'`)).rows;

// view oficial do relatório (se existir)
out.views = (await pg.query(
  `SELECT table_name FROM information_schema.views
   WHERE table_schema='public' AND table_name LIKE '%relatorio%pagamento%'`)).rows;

console.log("NATUREZA (todas):", JSON.stringify(out.natureza_dist, null, 2));
console.log("NATUREZA (manual):", JSON.stringify(out.natureza_manual, null, 2));
console.log("VIEWS:", JSON.stringify(out.views, null, 2));
console.log("\n===== FUNCAO PRODUCAO =====\n" + (out.fn[0]?.prosrc || "(nao encontrada)"));

await pg.end();
fs.writeFileSync("scripts/_fin_bug04_probe2.json", JSON.stringify(out, null, 2));
