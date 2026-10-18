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
    "OS HML-APP-001 pré-existente",
    `select id, numero, status, observacoes, observacao_torre, observacoes_gerais,
            cliente, prestador, prestador_id, data_programada
     from ordens_servico where numero like '%HML%' or observacoes like '%HOMOLOGA%' limit 5`
  );
  await q(
    "alocacoes da OS HML-APP-001",
    `select a.id, a.status, a.prestador_id, a.ordem_servico_id, a.data_escala, a.placa
     from alocacoes_escala a
     join ordens_servico o on o.id = a.ordem_servico_id
     where o.numero like '%HML%' limit 10`
  );
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
