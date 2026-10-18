// FIX-CRITICO-FINANCEIRO-E-COTACOES (C3) — aplicador pontual + verificação
// Aplica 20261013000001_fix_critico_grants_aceitar_rede.sql e mostra
// proacl antes/depois de f_aceitar_oportunidade_rede. Read-only + grants.
import pg from "pg";
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const url = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="))?.slice("DATABASE_URL=".length).trim();
if (!url) { console.error("DATABASE_URL ausente no .env"); process.exit(1); }

const sql = readFileSync("supabase/migrations/20261013000001_fix_critico_grants_aceitar_rede.sql", "utf8");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const verSql = `
  SELECT p.oid::regprocedure::text AS fn, p.proacl
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'f_aceitar_oportunidade_rede';`;

async function main() {
  await client.connect();
  console.log("=== ANTES ===");
  const antes = await client.query(verSql);
  for (const r of antes.rows) console.log(r.fn, "|", r.proacl);

  console.log("\n=== APLICANDO MIGRATION (grants) ===");
  await client.query(sql);
  console.log("OK");

  console.log("\n=== DEPOIS ===");
  const depois = await client.query(verSql);
  for (const r of depois.rows) console.log(r.fn, "|", r.proacl);

  // Gate: nenhum grant para anon/PUBLIC no proacl
  const ruins = depois.rows.filter((r) => r.proacl && /(\banon\b|\bPUBLIC\b)/.test(r.proacl));
  console.log(ruins.length === 0 ? "\nGATE PASS: sem grants para anon/PUBLIC" : `\nGATE FAIL: ${ruins.length} função(ões) ainda com anon/PUBLIC`);
  await client.end();
  process.exit(ruins.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
