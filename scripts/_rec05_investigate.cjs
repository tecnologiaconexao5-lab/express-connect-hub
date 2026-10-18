const { Client } = require('pg');

const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  // Find prestadores with liberado_app=true and no documents
  const result = await c.query(`
    SELECT p.id, p.nome_completo, p.status, p.liberado_app, p.created_at, p.origem_cadastro
    FROM public.prestadores p
    WHERE p.liberado_app = true
    AND NOT EXISTS (
      SELECT 1 FROM public.documentos_prestadores dp
      WHERE dp.prestador_id = p.id
    )
    ORDER BY p.created_at DESC
  `);

  console.log('=== Prestadores liberados SEM documentos ===');
  console.log('Count:', result.rows.length);
  result.rows.forEach(r => {
    console.log('  ID:', r.id);
    console.log('  Nome:', r.nome_completo);
    console.log('  Status:', r.status);
    console.log('  liberado_app:', r.liberado_app);
    console.log('  origem_cadastro:', r.origem_cadastro);
    console.log('  created_at:', r.created_at);
    console.log('  ---');
  });

  // Also check total prestadores with liberado_app=true
  const total = await c.query('SELECT COUNT(*) as cnt FROM public.prestadores WHERE liberado_app = true');
  console.log('\nTotal prestadores com liberado_app=true:', total.rows[0].cnt);

  // And total prestadores
  const totalAll = await c.query('SELECT COUNT(*) as cnt FROM public.prestadores');
  console.log('Total prestadores:', totalAll.rows[0].cnt);

  await c.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
