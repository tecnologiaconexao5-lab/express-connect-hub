// F0-D — verificação read-only (produção) antes de aplicar a migration dos RPCs.
// Confirma: colunas reais de financeiro_receber, CHECK de status, RPCs atuais, grants.
import pg from "pg";
import "dotenv/config";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await c.connect();
  console.log("DB:", (await c.query("SELECT current_database() AS db")).rows[0].db);

  const cols = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='financeiro_receber'
     ORDER BY ordinal_position`
  );
  console.log("\nCOLUNAS financeiro_receber:", cols.rows.map(r => r.column_name).join(", "));

  const chk = await c.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = 'public.financeiro_receber'::regclass AND contype='c'`
  );
  console.log("\nCHECK constraints financeiro_receber:");
  for (const r of chk.rows) console.log(`  ${r.conname}: ${r.def}`);

  const rpc = await c.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
            p.provolatile, p.prosecdef
     FROM pg_proc p
     WHERE p.pronamespace='public'::regnamespace
       AND p.proname IN ('f_registrar_baixa_financeira','f_estornar_baixa_financeira')
     ORDER BY p.proname`
  );
  console.log("\nRPCs atuais:");
  for (const r of rpc.rows) console.log(`  ${r.proname}(${r.args}) volatile=${r.provolatile} definer=${r.prosecdef}`);

  const grants = await c.query(
    `SELECT p.proname, g.grantee, g.privilege_type
     FROM information_schema.routine_privileges g
     JOIN pg_proc p ON p.proname = g.routine_name
     WHERE g.routine_schema='public'
       AND p.pronamespace='public'::regnamespace
       AND p.proname IN ('f_registrar_baixa_financeira','f_estornar_baixa_financeira')
     ORDER BY p.proname, g.grantee`
  );
  console.log("\nGrants RPCs:");
  for (const r of grants.rows) console.log(`  ${r.proname} | ${r.grantee} | ${r.privilege_type}`);

  const baixas = await c.query(
    "SELECT COUNT(*)::int AS n FROM financeiro_baixas WHERE titulo_tabela='financeiro_receber'"
  );
  console.log("\nBaixas existentes financeiro_receber:", baixas.rows[0].n);

  await c.end();
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});