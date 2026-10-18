import pg from "pg";
import "dotenv/config";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await c.connect();
  const r = await c.query(
    "SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('financeiro_pagar','financeiro_receber') ORDER BY tablename, policyname"
  );
  for (const p of r.rows) {
    console.log(`${p.tablename} | ${p.policyname} | roles=${p.roles} | cmd=${p.cmd}`);
  }
  const f = await c.query(
    "SELECT proname, prosecdef, provolatile FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('update_updated_at_column','current_tenant_id_safe','fn_estornar_baixa')"
  );
  console.log("FUNCOES:", JSON.stringify(f.rows));
  const tb = await c.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('financeiro_baixas','lancamentos_financeiros','saldos_financeiros','contas_financeiras') ORDER BY table_name"
  );
  console.log("TABELAS:", JSON.stringify(tb.rows));
  const ref = await c.query("SELECT current_database(), current_setting('app.settings.project_ref') AS ref");
  console.log("DB:", ref.rows[0].current_database());
  const fnp = await c.query("SELECT COUNT(*)::int AS n FROM financeiro_pagar");
  console.log("financeiro_pagar COUNT:", fnp.rows[0].n);
  await c.end();
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});