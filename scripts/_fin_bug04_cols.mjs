/**
 * FIN-BUG-04 — READ-ONLY: colunas reais + RPC. Saida: scripts\_fin_bug04_cols.json
 */
import fs from "node:fs";
import { Client } from "pg";
const DB = (fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m) || [])[1];
const pg = new Client({ connectionString: DB.trim() });
await pg.connect();
const out = { ts: new Date().toISOString() };

out.rpc = (await pg.query(
  `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('f_criar_lancamento_manual_prestador','f_aprovar_pagamento_prestadores','f_gerar_lote_pagamentos')`)).rows;

const cols = async (t) => (await pg.query(
  `SELECT column_name, data_type, is_nullable FROM information_schema.columns
   WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t])).rows;
out.pp = await cols("pagamentos_prestadores");
out.fp = await cols("financeiro_pagar");

console.log("RPC:", JSON.stringify(out.rpc, null, 2));
console.log("\nCOLS pagamentos_prestadores:\n" + out.pp.map(c => `${c.column_name} (${c.data_type}${c.is_nullable === "YES" ? "" : ", NOT NULL"})`).join("\n"));
console.log("\nCOLS financeiro_pagar:\n" + out.fp.map(c => `${c.column_name} (${c.data_type}${c.is_nullable === "YES" ? "" : ", NOT NULL"})`).join("\n"));

await pg.end();
fs.writeFileSync("scripts/_fin_bug04_cols.json", JSON.stringify(out, null, 2));
