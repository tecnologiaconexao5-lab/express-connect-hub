import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  try {
    const r = await pool.query("SELECT DISTINCT status FROM alocacoes_escala WHERE status IS NOT NULL");
    console.log('Status values found:', r.rows.length);
    for (const row of r.rows) console.log('  - "' + row.status + '"');
  } catch(e) {
    console.error('Query failed:', e.message);
  }
  await pool.end();
}
main();
