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
    "OS-202608-981024",
    `select id, numero, status, cliente_id, prestador, prestador_id, tenant_id,
            instrucoes_operacionais_os, placa_alocada, data_programada,
            inicio_previsto, veiculo_tipo, created_at
     from ordens_servico where numero = 'OS-202608-981024'`
  );
  await q(
    "alocação da OS",
    `select a.id, a.status, a.prestador_id, a.ordem_servico_id, a.data_escala,
            a.tipo_veiculo, a.placa, a.horario_saida, a.rota, a.metadata
     from alocacoes_escala a
     where a.ordem_servico_id = (select id from ordens_servico where numero = 'OS-202608-981024')`
  );
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
