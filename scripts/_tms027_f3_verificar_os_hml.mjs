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
    "OS HML criadas hoje",
     `select id, numero, status, tenant_id, cliente, prestador, observacoes,
            created_at, origem, destino, placa_alocada, enderecos
     from ordens_servico
     where observacoes ilike '%HML-APP-20260801%'
        or numero in ('OS-202608-390664','OS-202608-249843','OS-202608-429049')
     order by created_at desc limit 10`
  );
  await q(
    "total OS por marcador",
    `select count(*)::int as total from ordens_servico where observacoes ilike '%HML-APP-20260801%'`
  );
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
