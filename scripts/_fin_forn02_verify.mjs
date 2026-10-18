import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const fk = await c.query("SELECT conname FROM pg_constraint WHERE conrelid='financeiro_pagar'::regclass AND confrelid='fornecedores'::regclass");
  console.log("FK:", fk.rows.map(r => r.conname).join(", "));
  const rls = await c.query("SELECT relrowsecurity FROM pg_class WHERE relname='fornecedores'");
  console.log("RLS:", rls.rows[0].relrowsecurity);
  const p = await c.query("SELECT policyname, cmd FROM pg_policies WHERE tablename='fornecedores'");
  p.rows.forEach(r => console.log("Policy:", r.policyname, r.cmd));
  const a = await c.query("SELECT has_table_privilege('anon','public.fornecedores','SELECT')");
  console.log("Anon SELECT:", a.rows[0].has_table_privilege);
  const t = await c.query("SELECT count(*) as total, count(fornecedor_id) as legado, count(fornecedor_cadastro_id) as novo FROM financeiro_pagar");
  console.log("Titulos:", JSON.stringify(t.rows[0]));
  await c.end();
})();
