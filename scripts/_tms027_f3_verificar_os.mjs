import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await c.connect();
  const cols = await c.query(
    `select column_name, data_type from information_schema.columns where table_name = 'ordens_servico' order by ordinal_position`
  );
  console.log("COLS ordens_servico:", cols.rows.map((r) => `${r.column_name}(${r.data_type})`).join(", "));
  const numero = process.argv[2] || "OS-202608-429049";
  const r = await c.query(`select * from ordens_servico where numero = $1`, [numero]);
  console.log("OS:", JSON.stringify(r.rows, null, 2));
  if (r.rows.length > 0) {
    const a = await c.query(
      `select id, ordem_servico_id, prestador_id, status, placa, origem, destino, rota, data_escala, metadata
       from alocacoes_escala where ordem_servico_id = $1`,
      [r.rows[0].id]
    );
    console.log("ALOCACOES:", JSON.stringify(a.rows, null, 2));
  }
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
