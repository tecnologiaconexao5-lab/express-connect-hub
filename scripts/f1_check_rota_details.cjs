const pg = require('pg');
const client = new pg.Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  
  const checks = [
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'rota_paradas' ORDER BY ordinal_position`,
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'route_stops' ORDER BY ordinal_position`,
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'portal_notificacoes' ORDER BY ordinal_position`,
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'os_historico' ORDER BY ordinal_position`,
  ];
  
  for (const q of checks) {
    const tbl = q.match(/table_name = '(\w+)'/)?.[1];
    console.log(`\n=== ${tbl} ===`);
    const r = await client.query(q);
    r.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  }

  await client.end();
}
main().catch(err => { console.error('FATAL:', err); process.exit(1); });
