import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Check clientes columns
  const cols = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'clientes'
     ORDER BY ordinal_position`
  );
  console.log("=== clientes columns ===");
  cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

  // Check existing clients
  const existing = await client.query(`SELECT id, nome_fantasia, razao_social, email FROM clientes LIMIT 5`);
  console.log("\n=== Existing clients ===");
  existing.rows.forEach(r => console.log(`  ${r.id} | ${r.nome_fantasia} | ${r.razao_social} | ${r.email}`));

  // Check usuarios_cliente
  const uc = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'usuarios_cliente'
     ORDER BY ordinal_position`
  );
  console.log("\n=== usuarios_cliente columns ===");
  uc.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

  // Check existing usuarios_cliente
  const ucData = await client.query(`SELECT * FROM usuarios_cliente LIMIT 5`);
  console.log("\n=== Existing usuarios_cliente ===");
  ucData.rows.forEach(r => console.log(`  ${JSON.stringify(r)}`));

  // Check ordens_servico
  const osCols = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ordens_servico'
     ORDER BY ordinal_position`
  );
  console.log("\n=== ordens_servico columns ===");
  osCols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

  // Check financeiro_receber
  const frCols = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'financeiro_receber'
     ORDER BY ordinal_position`
  );
  console.log("\n=== financeiro_receber columns ===");
  frCols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
