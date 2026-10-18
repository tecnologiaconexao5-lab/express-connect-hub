// [READ-ONLY] TMS-FIN-DATA-04D3C4 — somente SELECT; credencial via env; sem fallback PROD.
import pg from 'pg';
const { Client } = pg;

// TMS-FIN-DATA-04D3C4 — READ-ONLY. Credencial SOMENTE via env explicita; sem fallback para .env PROD.
const DATABASE_URL = process.env.AUDIT_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[FAIL-CLOSED] Defina AUDIT_DATABASE_URL (ou DATABASE_URL). Nenhuma conexao foi feita.');
  process.exit(1);
}
const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  
  const db = await client.query('SELECT current_database() as db');
  const ver = await client.query('SELECT version() as ver');
  const user = await client.query('SELECT current_user as user');
  const tables = await client.query("SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public'");
  
  console.log('DATABASE:', db.rows[0].db);
  console.log('VERSION:', ver.rows[0].ver);
  console.log('USER:', user.rows[0].user);
  console.log('TABLES IN PUBLIC:', tables.rows[0].cnt);
  
  await client.end();
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}