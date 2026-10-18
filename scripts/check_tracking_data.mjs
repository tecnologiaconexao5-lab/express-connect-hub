import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  console.log('=== Tracking Data Check ===\n');
  const r = await pool.query('SELECT COUNT(*) FROM portal_tracking_realtime');
  console.log('Total rows:', r.rows[0].count);
  
  if (parseInt(r.rows[0].count) > 0) {
    const r2 = await pool.query('SELECT id, alocacao_id, latitude, longitude, created_at FROM portal_tracking_realtime ORDER BY created_at DESC LIMIT 5');
    for (const row of r2.rows) {
      console.log(JSON.stringify(row));
    }
  }
  
  await pool.end();
}
main();
