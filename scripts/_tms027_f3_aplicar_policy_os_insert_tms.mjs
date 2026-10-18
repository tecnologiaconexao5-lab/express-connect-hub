import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });

const POLICY_SQL = `
CREATE POLICY "os_insert_tms" ON public.ordens_servico FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
    AND tenant_id = current_tenant_id_safe()
  );
`;

async function main() {
  await c.connect();
  const q = async (label, sql) => {
    const r = await c.query(sql);
    console.log(`-- ${label}:`, JSON.stringify(r.rows, null, 2));
  };

  const exists = await c.query(
    `SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ordens_servico' AND policyname='os_insert_tms'`
  );
  if (exists.rowCount > 0) {
    console.log("-- policy os_insert_tms JÁ EXISTE — nada a aplicar");
  } else {
    await c.query("BEGIN");
    await c.query(POLICY_SQL);
    await c.query("COMMIT");
    console.log("-- policy os_insert_tms APLICADA em produção");
  }

  await q(
    "policies ordens_servico (após)",
    "select policyname, cmd, qual, with_check from pg_policies where schemaname='public' and tablename='ordens_servico' order by cmd, policyname"
  );

  await q(
    "grant check — tabela habilitada?",
    "select relrowsecurity from pg_class where relname='ordens_servico'"
  );

  await c.end();
}

main().catch(async (e) => {
  console.error("ERRO:", e.message);
  try {
    await c.query("ROLLBACK");
  } catch (_) {}
  process.exit(1);
});
