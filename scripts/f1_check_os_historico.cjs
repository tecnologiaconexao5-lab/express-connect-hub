const pg = require('pg');
const client = new pg.Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  
  const queries = [
    `SELECT column_name, data_type, is_nullable, column_default 
     FROM information_schema.columns WHERE table_name = 'os_historico' ORDER BY ordinal_position`,
    `SELECT column_name, data_type, is_nullable, column_default 
     FROM information_schema.columns WHERE table_name = 'alerta_os' ORDER BY ordinal_position`,
    `SELECT column_name, data_type, is_nullable, column_default 
     FROM information_schema.columns WHERE table_name = 'prestador_notificacoes' ORDER BY ordinal_position`,
  ];
  
  for (const q of queries) {
    const tbl = q.match(/table_name = '(\w+)'/)?.[1];
    console.log(`\n=== ${tbl} ===`);
    try {
      const r = await client.query(q);
      if (r.rows.length === 0) {
        console.log('  (table not found)');
      } else {
        r.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} nullable=${c.is_nullable} default=${c.column_default || 'none'}`));
      }
    } catch(e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  await client.end();
}
main().catch(err => { console.error('FATAL:', err); process.exit(1); });
