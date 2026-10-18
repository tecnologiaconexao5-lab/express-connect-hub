import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Check current_tenant_id_safe function
const fn = await client.query(`
  SELECT prosrc FROM pg_proc
  WHERE proname = 'current_tenant_id_safe'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
`);
console.log('=== current_tenant_id_safe() ===');
if (fn.rows[0]) console.log(fn.rows[0].prosrc);

// Check tenant_usuarios for the test user
const tu = await client.query(`
  SELECT * FROM tenant_usuarios WHERE user_id = 'a5e51631-5ed8-430d-9041-4b185c03d821'
`);
console.log('\n=== tenant_usuarios for test user ===');
if (tu.rows.length === 0) console.log('  (nenhum registro)');
tu.rows.forEach(r => console.log(JSON.stringify(r, null, 2)));

// Check tenant_usuarios table structure
const cols = await client.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tenant_usuarios'
  ORDER BY ordinal_position
`);
console.log('\n=== tenant_usuarios columns ===');
cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

await client.end();
