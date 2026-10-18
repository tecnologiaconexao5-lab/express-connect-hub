/**
 * FIN-BUG-04 — Diagnóstico READ-ONLY do Lançamento Manual de Prestador.
 * Somente SELECT. Saida: scripts\_fin_bug04_diag.json
 */
import fs from "node:fs";
import { Client } from "pg";
const DB = (fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m) || [])[1];
const pg = new Client({ connectionString: DB.trim() });
await pg.connect();
const out = { ts: new Date().toISOString() };

// 0) RPC existe em produção?
out.rpc = (await pg.query(
  `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='f_criar_lancamento_manual_prestador'`)).rows;

// 1) pagamentos_prestadores manuais
out.pp_manual = (await pg.query(
  `SELECT id, prestador_id, prestador_nome, prestador_documento, os_id, os_numero,
          valor_liquido, valor_servicos, status, status_conferencia, status_aprovacao,
          status_pagamento, origem_lancamento, tipo_lancamento, tipo_pagamento,
          data_competencia, observacao, is_teste, created_at
   FROM public.pagamentos_prestadores
   WHERE origem_lancamento='manual'
   ORDER BY created_at DESC`)).rows;

// 2) colunas reais de pagamentos_prestadores (nomes e tipos)
out.colunas_pp = (await pg.query(
  `SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema='public' AND table_name='pagamentos_prestadores'
   ORDER BY ordinal_position`)).rows;

// 3) financeiro_pagar gerados pelos manuais (os_vinculada = pp.id, os_id NULL)
out.fp_manual = (await pg.query(
  `SELECT fp.id, fp.os_id, fp.os_vinculada, fp.descricao, fp.valor, fp.status,
          fp.prestador, fp.fornecedor_id, fp.fornecedor_nome, fp.categoria, fp.created_at
   FROM public.financeiro_pagar fp
   WHERE fp.os_id IS NULL AND fp.os_vinculada IS NOT NULL
     AND fp.os_vinculada IN (SELECT id::text FROM public.pagamentos_prestadores WHERE origem_lancamento='manual')
   ORDER BY fp.created_at DESC`)).rows;

// 4) colunas reais de financeiro_pagar
out.colunas_fp = (await pg.query(
  `SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema='public' AND table_name='financeiro_pagar'
   ORDER BY ordinal_position`)).rows;

console.log("RPC:", JSON.stringify(out.rpc, null, 2));
console.log("PP_MANUAL:", JSON.stringify(out.pp_manual, null, 2));
console.log("FP_MANUAL:", JSON.stringify(out.fp_manual, null, 2));
console.log("COLS_PP:", out.colunas_pp.map(c => c.column_name).join(", "));
console.log("COLS_FP:", out.colunas_fp.map(c => c.column_name).join(", "));

await pg.end();
fs.writeFileSync("scripts/_fin_bug04_diag.json", JSON.stringify(out, null, 2));
console.log("\nSalvo scripts/_fin_bug04_diag.json");
