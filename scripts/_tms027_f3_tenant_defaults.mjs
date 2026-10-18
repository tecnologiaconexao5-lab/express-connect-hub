import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await c.connect();
  const q = async (label, sql, params) => {
    const r = await c.query(sql, params);
    console.log(`-- ${label}:`, JSON.stringify(r.rows, null, 2));
  };
  await q(
    "default tenant_id ordens_servico",
    "select column_default, is_nullable from information_schema.columns where table_name='ordens_servico' and column_name='tenant_id'"
  );
  await q(
    "triggers ordens_servico",
    "select tgname, tgrelid::regclass as tbl, pg_get_triggerdef(oid) as def from pg_trigger where tgrelid = 'ordens_servico'::regclass and not tgisinternal"
  );
  await q(
    "default tenant_id alocacoes_escala",
    "select column_default, is_nullable from information_schema.columns where table_name='alocacoes_escala' and column_name='tenant_id'"
  );
  await q(
    "current_tenant_id_safe def",
    "select pg_get_functiondef(oid) as def from pg_proc where proname='current_tenant_id_safe'"
  );
  await q(
    "default tenant_id clientes",
    "select column_default from information_schema.columns where table_name='clientes' and column_name='tenant_id'"
  );
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
