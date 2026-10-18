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
  await q("total ordens_servico", "select count(*) as total from ordens_servico");
  await q(
    "amostra OS com tenant",
    "select numero, status, cliente_id, prestador_id, tenant_id, created_at from ordens_servico order by created_at desc limit 5"
  );
  await q(
    "func current_tenant_id_safe existe",
    "select p.proname, p.provolatile from pg_proc p where p.proname in ('current_tenant_id_safe','f_obter_cliente_id_do_usuario')"
  );
  await q(
    "prestadores com auth vinculado (liberado_app)",
    "select id, nome_completo, auth_user_id, liberado_app from prestadores where liberado_app = true limit 5"
  );
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
