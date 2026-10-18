import pg from 'pg';
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000});

// Get trigger function source
const r = await pool.query("SELECT pg_get_functiondef('trg_evento_portal_pedido_criado'::regproc)");
console.log('=== TRIGGER FUNCTION ===');
console.log(r.rows[0]?.pg_get_functiondef?.substring(0, 1500));

// Check if tipo_servico column exists
const col = await pool.query(`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'portal_pedidos' AND column_name = 'tipo_servico'
`);
console.log('\n=== tipo_servico column? ===');
console.log(col.rows.length > 0 ? 'YES' : 'NO');

// Try creating pedido - first without extra fields
// The issue might be the trigger expecting tipo_servico
// Let me try inserting without metadata first
const testInsert = await pool.query(`
  INSERT INTO portal_pedidos (numero_pedido, status, coleta_cidade, entrega_cidade, descricao)
  VALUES ('TMP-TEST-135B', 'enviado', 'SP', 'RJ', 'test')
  ON CONFLICT (numero_pedido) DO NOTHING
  RETURNING id, numero_pedido, status
`);
if (testInsert.rows.length > 0) {
  console.log('\n=== Simple insert OK ===');
  console.log(JSON.stringify(testInsert.rows[0]));
  // Cleanup
  await pool.query("DELETE FROM portal_pedidos WHERE numero_pedido LIKE 'TMP-%'");
} else {
  console.log('\n=== Simple insert failed (or duplicate skipped) ===');
}

// Look at existing pedidos to find the trigger pattern
const sample = await pool.query("SELECT * FROM portal_pedidos LIMIT 1");
if (sample.rows.length > 0) {
  console.log('\n=== Sample pedido columns ===');
  console.log(Object.keys(sample.rows[0]).join(', '));
}

await pool.end();
