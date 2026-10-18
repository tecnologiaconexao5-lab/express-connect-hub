const { Client } = require('pg');
async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const cols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name='alocacoes_escala' AND column_name LIKE 'reversa_%'
    ORDER BY ordinal_position
  `);
  console.log('alocacoes_escala reversa columns:');
  cols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

  // Also check if there's a reversa_endereco or similar columns that aren't in reversa_ prefix
  const endCols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='alocacoes_escala' 
    AND (column_name LIKE '%endereco%' OR column_name LIKE '%endere%')
  `);
  console.log('\nAddress columns:');
  endCols.rows.forEach(c => console.log(`  ${c.column_name}`));

  await client.end();
}
main().catch(err => { console.error(err); process.exit(1); });
