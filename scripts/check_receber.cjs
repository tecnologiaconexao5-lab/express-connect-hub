const { Client } = require("pg");
const DB_URL = "postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";

(async () => {
  const pg = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();

  // 1. Columns
  const cols = await pg.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'financeiro_receber' ORDER BY ordinal_position"
  );
  console.log("Columns:", cols.rows.map(r => r.column_name).join(", "));

  // 2. RLS policies
  const pols = await pg.query(
    "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'financeiro_receber'"
  );
  console.log("\nRLS policies:", JSON.stringify(pols.rows, null, 2));

  // 3. Latest 3 records
  const recs = await pg.query(
    "SELECT id, valor, status, cliente, cliente_id FROM financeiro_receber ORDER BY created_at DESC LIMIT 3"
  );
  console.log("\nLatest 3:", JSON.stringify(recs.rows, null, 2));

  // 4. Check if fetchLancamentos would return data — it does: .select("*").order("data_vencimento")
  // The component uses Supabase anon client with auth — check if RLS blocks anon
  const rlsEnabled = await pg.query(
    "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'financeiro_receber'"
  );
  console.log("\nRLS enabled:", JSON.stringify(rlsEnabled.rows));

  await pg.end();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
