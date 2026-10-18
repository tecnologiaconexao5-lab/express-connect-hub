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

  // 1. Check if there are any clientes
  const clientes = await client.query(`SELECT id, razao_social, cnpj, email FROM clientes LIMIT 5`);
  console.log("=== CLIENTES ===");
  for (const c of clientes.rows) {
    console.log(`  ${c.id} | ${c.razao_social} | ${c.cnpj} | ${c.email}`);
  }

  // 2. Check if there are any existing usuarios_cliente
  const uc = await client.query(`SELECT * FROM usuarios_cliente LIMIT 5`);
  console.log("\n=== USUARIOS_CLIENTE ===");
  for (const r of uc.rows) {
    console.log(`  ${r.id} | auth_user=${r.auth_user_id} | cliente_id=${r.cliente_id} | ativo=${r.ativo}`);
  }

  // 3. Check tenant_usuarios column structure again
  const tuCols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_usuarios'
    ORDER BY ordinal_position
  `);
  console.log("\n=== TENANT_USUARIOS columns ===");
  for (const c of tuCols.rows) {
    console.log(`  ${c.column_name}`);
  }

  // 4. Check existing tenant_usuarios
  const tu = await client.query(`SELECT * FROM tenant_usuarios LIMIT 5`);
  console.log("\n=== TENANT_USUARIOS records ===");
  for (const r of tu.rows) {
    console.log(`  ${r.id} | tenant=${r.tenant_id} | user=${r.user_id} | papel=${r.papel}`);
  }

  // 5. Check tenant ID
  const tenants = await client.query(`SELECT * FROM tenants LIMIT 5`);
  console.log("\n=== TENANTS ===");
  if (tenants.rows.length === 0) {
    console.log("  No tenants found!");
    const hasTable = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants')
    `);
    console.log(`  tenants table exists: ${hasTable.rows[0].exists}`);
  } else {
    for (const r of tenants.rows) {
      console.log(`  ${r.id} | ${r.nome || r.name || '(no name)'}`);
    }
  }

  await client.end();
}

main().catch(e => console.error(e));
