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
    "OS OS-202608-390664 detalhe",
    `select id, numero, status, cliente, prestador, prestador_id, tenant_id,
            observacoes, observacao_torre, observacoes_gerais, placa_alocada,
            data_programada, inicio_previsto, created_at
     from ordens_servico where numero = 'OS-202608-390664'`
  );
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
