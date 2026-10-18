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

  // Check constraints on alocacoes_escala
  const constraints = await client.query(`
    SELECT con.conname, con.contype,
           pg_get_constraintdef(con.oid) AS def
    FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = 'alocacoes_escala'::regclass
    ORDER BY con.contype
  `);
  for (const c of constraints.rows) {
    console.log(`\n${c.conname} (${c.contype}):`);
    console.log(`  ${c.def}`);
  }

  // Check the default values
  const defaults = await client.query(`
    SELECT column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'alocacoes_escala'
  `);
  console.log("\n--- Defaults ---");
  for (const d of defaults.rows) {
    if (d.column_default) {
      console.log(`  ${d.column_name}: ${d.column_default}`);
    }
  }

  // Check what the trigger row looks like after a simple insert
  // Let me just insert a quick test with all the defaults
  console.log("\n--- Attempting minimal insert ---");
  try {
    await client.query(`
      INSERT INTO alocacoes_escala (cliente_id, data_escala, tipo_veiculo, origem, destino)
      VALUES ('34ed2cd5-efc2-41e0-9d2b-5a91b20924bd', '2026-07-02', 'VUC', 'SP', 'RJ')
    `);
    console.log("Minimal insert SUCCESS");
  } catch (e: any) {
    console.log(`Minimal insert FAILED: ${e.message}`);
    
    // Try with all NOT NULL fields that might be missing
    console.log("\n--- Checking NOT NULL columns ---");
    const nn = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'alocacoes_escala'
        AND is_nullable = 'NO'
        AND column_default IS NULL
    `);
    for (const c of nn.rows) {
      console.log(`  ${c.column_name} (${c.data_type}) NOT NULL, no default`);
    }
  }

  await client.end();
}

main().catch(e => console.error(e));
