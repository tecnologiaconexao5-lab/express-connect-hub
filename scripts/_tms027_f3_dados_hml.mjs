import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await c.connect();
  const r = await c.query(
    "select id, razao_social, nome_fantasia, cnpj, status from clientes where id = '3d2d079d-708b-4d4d-9c0b-1ed9b894e37e'"
  );
  console.log("CLIENTE:", JSON.stringify(r.rows));
  const p = await c.query(
    "select * from prestadores where id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'"
  );
  console.log("PRESTADOR:", JSON.stringify(p.rows));
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
