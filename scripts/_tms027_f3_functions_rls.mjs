import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await c.connect();
  const q = async (label, sql, params) => {
    const r = await c.query(sql, params);
    console.log(`-- ${label}:`, JSON.stringify(r.rows));
  };
  await q(
    "tenant_usuarios tamiris",
    "select id, tenant_id, user_id, papel from tenant_usuarios limit 20"
  );
  await q(
    "functions texto",
    "select p.proname, pg_get_functiondef(p.oid) as def from pg_proc p where p.proname in ('f_obter_cliente_id_do_usuario','f_usuario_pode_acessar_cliente')"
  );
  await q(
    "todas policies clientes",
    "select policyname, cmd, with_check, qual from pg_policies where tablename in ('clientes','prestadores') order by tablename, cmd"
  );
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
