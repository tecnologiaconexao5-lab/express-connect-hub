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
    "todas OS com marcador",
    `select id, numero, status, tenant_id, created_at
     from ordens_servico where instrucoes_operacionais_os ilike '%HML-APP-20260801%'`
  );
  await q(
    "alocacoes das OS HML",
    `select a.id, a.status, a.prestador_id, a.ordem_servico_id, a.data_escala, a.placa, a.tipo_veiculo
     from alocacoes_escala a
     where a.ordem_servico_id in (
       select id from ordens_servico where instrucoes_operacionais_os ilike '%HML-APP-20260801%'
     )`
  );
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
