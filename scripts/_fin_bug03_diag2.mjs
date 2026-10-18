/**
 * FIN-BUG-03 — Diagnóstico READ-ONLY (2): itens das faturas travadas + fonte dos triggers de guarda.
 * Somente SELECT. Saida: scripts\_fin_bug03_diag2.json
 */
import fs from "node:fs";
import { Client } from "pg";
const DB = (fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m) || [])[1];
const pg = new Client({ connectionString: DB.trim() });
await pg.connect();

const out = { ts: new Date().toISOString() };

// 1) Itens das 2 faturas manuais criadas HOJE (aguardando/aprovada)
const alvo = ["c4e74e94-3482-4a7f-911d-15dc1feadeeb", "bb645429-b75b-49bb-be55-a612fec08947"];
out.itens = (await pg.query(
  `SELECT fatura_id, status, count(*)::int AS qtd, sum(valor_total)::numeric AS total
   FROM public.fatura_itens WHERE fatura_id = ANY($1::uuid[]) GROUP BY 1,2 ORDER BY 1,2`,
  [alvo])).rows;
console.log("ITENS:", JSON.stringify(out.itens, null, 2));

// 2) Detalhe completo das 2 faturas (numero, cliente, conta_receber, metadata)
out.faturas = (await pg.query(
  `SELECT id, status, numero, numero_cliente, cliente_id, conta_receber_id, valor_total,
          metadata, criado_em, atualizado_em
   FROM public.faturas WHERE id = ANY($1::uuid[])`, [alvo])).rows;
console.log("FATURAS:", JSON.stringify(out.faturas, null, 2));

// 3) Fonte dos 2 triggers de guarda
out.triggers = (await pg.query(
  `SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN
   ('f_trg_faturas_bloqueio_emissao_sem_ar','f_trg_faturas_protege_status')`)).rows;
for (const t of out.triggers) {
  console.log(`\n===== ${t.proname} =====\n${t.prosrc}`);
}

// 4) Itens de TODAS as faturas manuais (confirma se criarFaturaManual cria item)
out.itens_manuais = (await pg.query(
  `SELECT f.id, f.status, f.numero, f.metadata->>'origem' AS origem,
          (SELECT count(*)::int FROM public.fatura_itens i WHERE i.fatura_id=f.id AND i.status='ativo') AS itens_ativos
   FROM public.faturas f
   WHERE f.metadata->>'origem'='manual' ORDER BY f.criado_em DESC`)).rows;
console.log("ITENS_POR_FATURA_MANUAL:", JSON.stringify(out.itens_manuais, null, 2));

await pg.end();
fs.writeFileSync("scripts/_fin_bug03_diag2.json", JSON.stringify(out, null, 2));
console.log("\nSalvo scripts/_fin_bug03_diag2.json");
