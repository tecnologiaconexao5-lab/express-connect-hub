import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  console.log('=== VIEW completa ===');
  const v = await c.query("SELECT definition FROM pg_views WHERE schemaname='public' AND viewname='vw_app_motorista_operacoes'");
  console.log(v.rows[0]?.definition || 'não encontrada');
  await c.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });