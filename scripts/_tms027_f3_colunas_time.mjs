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
    "colunas time alocacoes_escala",
    `select column_name, data_type from information_schema.columns
     where table_name='alocacoes_escala' and data_type in ('time without time zone','timestamp with time zone','timestamp without time zone','date')`
  );
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
