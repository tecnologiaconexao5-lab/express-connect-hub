/* MISSÃO 1 — aplica (ou simula) a migration aditiva de RLS de clientes_contratos.
 * Uso: node scripts/_apply_missao01_rls.cjs          (dry-run + ROLLBACK)
 *      node scripts/_apply_missao01_rls.cjs --apply  (COMMIT + verificação)
 */
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
require("dotenv").config();

const MIGRATION = path.resolve(process.cwd(), "supabase/migrations/20261103000001_missao01_clientes_contratos_rls.sql");
const APPLY = process.argv.includes("--apply");

(async () => {
  if (!fs.existsSync(MIGRATION)) throw new Error(`Migration não encontrada: ${MIGRATION}`);
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const verificar = async () => {
    const { rows } = await client.query(
      "select policyname, cmd from pg_policies where schemaname='public' and tablename='clientes_contratos' order by policyname",
    );
    return rows;
  };

  try {
    await client.query("BEGIN");
    await client.query(sql);
    const policies = await verificar();
    const esperadas = ["cc_delete_access", "cc_insert_access", "cc_select_access", "cc_update_access"];
    const nomes = policies.map((p) => p.policyname);
    const ok = esperadas.every((n) => nomes.includes(n));
    console.log("Policies após migration:", JSON.stringify(policies));
    console.log(ok ? "PROVA: 4/4 policies criadas" : "FALHA: policies ausentes");

    if (!APPLY) {
      await client.query("ROLLBACK");
      console.log("DRY-RUN concluído — transação revertida (nada alterado). Use --apply para efetivar.");
      return;
    }

    await client.query("COMMIT");
    const depois = await verificar();
    console.log("COMMIT efetuado. Policies no banco:", JSON.stringify(depois));
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERRO — transação revertida:", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
