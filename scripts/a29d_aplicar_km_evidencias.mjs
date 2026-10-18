// A29-D — aplicar migration de KM evidências em PRODUÇÃO (autorizada).
// Uso: node scripts/a29d_aplicar_km_evidencias.mjs
// Pré-requisito: DATABASE_URL no .env.
import "dotenv/config";
import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationFile = resolve(__dirname, "..", "supabase", "migrations", "20260817_a29d_km_evidencias_operacao.sql");
const sql = readFileSync(migrationFile, "utf8");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // Verificação pré
  const pre = await client.query(`
    SELECT COUNT(*) AS total, COUNT(DISTINCT operation_id) AS distintos
    FROM public.operation_km;`);
  console.log("PRÉ-DEDUP:", JSON.stringify(pre.rows[0]));

  // Aplica em transação (o arquivo já tem BEGIN/COMMIT)
  console.log("Aplicando migration...");
  await client.query(sql);
  console.log("Migration aplicada com sucesso!");

  // Verificação pós
  const pos = await client.query(`
    SELECT COUNT(*) AS total, COUNT(DISTINCT operation_id) AS distintos
    FROM public.operation_km;`);
  console.log("PÓS-DEDUP:", JSON.stringify(pos.rows[0]));

  const idx = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname='public' AND tablename='operation_km';`);
  console.log("ÍNDICES operation_km:", JSON.stringify(idx.rows, null, 2));

  const fn = await client.query(`
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
           p.prosecdef, p.provolatile,
           (SELECT COALESCE(array_agg(DISTINCT g.grantee ORDER BY g.grantee), '{}')
              FROM information_schema.role_routine_grants g
             WHERE g.specific_name = p.oid::regprocedure::text) AS grantees
    FROM pg_proc p WHERE p.proname='f_km_evidencias_operacao';`);
  console.log("FUNÇÃO:", JSON.stringify(fn.rows, null, 2));

  await client.end();
}
main().catch(async (e) => {
  console.error("Erro:", e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
