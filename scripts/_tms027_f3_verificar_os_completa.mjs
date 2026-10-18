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
    "OS completa recém-criada",
    `select id, numero, status, cliente, cliente_id, prestador, prestador_id, tenant_id,
            instrucoes_operacionais_os, placa_alocada, data_programada, inicio_previsto,
            data, veiculo_tipo, enderecos, created_at
     from ordens_servico where numero = 'OS-202608-241511'`
  );
  await q(
    "alocacoes da OS",
    `select id, status, prestador_id, ordem_servico_id, data_escala, placa
     from alocacoes_escala where ordem_servico_id in (
       select id from ordens_servico where numero = 'OS-202608-241511'
     )`
  );
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
