const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  for (const t of ['financeiro_receber','financeiro_pagar','pagamentos_prestadores','composicao_financeira_os','fiscal_documentos_vinculados']) {
    const cols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
    console.log(`\n### ${t}`);
    cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
  }
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });