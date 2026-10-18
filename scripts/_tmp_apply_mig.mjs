import { readFileSync } from "node:fs";
import pg from "pg";
const root = process.env.ROOT;
const env = readFileSync(`${root}/.env`, "utf8");
const db = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL=")).slice("DATABASE_URL=".length).trim();
const sql = readFileSync(`${root}/supabase/migrations/20261010000010_rede_seed_etapa_viagem_aceita.sql`, "utf8");
const c = new pg.Client({ connectionString: db, ssl: { rejectUnauthorized: false } });
await c.connect();
console.log("== ANTES ==");
const before = await c.query(`SELECT count(*)::int n FROM alocacoes_escala WHERE COALESCE(metadata->>'origem','')='rede_prestadores' AND (metadata->'app_motorista'->>'etapa_atual') IS NULL`);
console.log("alocacoes rede sem etapa_atual:", before.rows[0].n);
try {
  await c.query("BEGIN");
  await c.query(sql);
  await c.query("COMMIT");
  console.log("MIGRATION APLICADA OK");
} catch (e) {
  await c.query("ROLLBACK");
  console.error("FALHA (rollback):", e.message);
  await c.end();
  process.exit(1);
}
console.log("== DEPOIS ==");
const after = await c.query(`SELECT count(*)::int n FROM alocacoes_escala WHERE COALESCE(metadata->>'origem','')='rede_prestadores' AND (metadata->'app_motorista'->>'etapa_atual') IS NULL`);
console.log("alocacoes rede sem etapa_atual:", after.rows[0].n);
const def = await c.query(`SELECT position('viagem_aceita' in pg_get_functiondef(p.oid))>0 AS tem FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_aceitar_oportunidade_rede'`);
console.log("funcao contem viagem_aceita:", def.rows[0].tem);
const amostra = await c.query(`SELECT id, metadata->'app_motorista'->>'etapa_atual' AS etapa, metadata->>'os_numero' AS os FROM alocacoes_escala WHERE COALESCE(metadata->>'origem','')='rede_prestadores' ORDER BY created_at DESC LIMIT 5`);
console.log(JSON.stringify(amostra.rows, null, 2));
await c.end();
