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

  // Check ordens_servico table
  console.log("=== ordens_servico ===");
  const exists = await client.query(`
    SELECT EXISTS (SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'ordens_servico')
  `);
  console.log(`Table exists: ${exists.rows[0].exists}`);

  if (exists.rows[0].exists) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ordens_servico'
      ORDER BY ordinal_position
    `);
    console.log(`Columns (${cols.rows.length}):`);
    for (const c of cols.rows) {
      console.log(`  ${c.column_name}: ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}${c.column_default ? ' DEFAULT ' + c.column_default : ''}`);
    }

    const constraints = await client.query(`
      SELECT conname, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint WHERE conrelid = 'ordens_servico'::regclass
    `);
    console.log("\nConstraints:");
    for (const c of constraints.rows) {
      console.log(`  ${c.conname}: ${c.def}`);
    }
  }

  // Check financeiro_receber columns more carefully
  console.log("\n=== financeiro_receber columns ===");
  const finCols = await client.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financeiro_receber'
    ORDER BY ordinal_position
  `);
  for (const c of finCols.rows) {
    console.log(`  ${c.column_name} (${c.data_type})${c.column_default ? ' = ' + c.column_default : ''}`);
  }

  // Check existing data in ordens_servico
  if (exists.rows[0].exists) {
    const count = await client.query(`SELECT COUNT(*) FROM ordens_servico`);
    console.log(`\nTotal ordens_servico: ${count.rows[0].count}`);
    if (parseInt(count.rows[0].count) > 0) {
      const sample = await client.query(`SELECT id, numero, cliente_id, status FROM ordens_servico LIMIT 3`);
      for (const r of sample.rows) {
        console.log(`  ${r.id} | ${r.numero} | cliente=${r.cliente_id} | ${r.status}`);
      }
    }
  }

  await client.end();
}

main().catch(e => console.error(e));
