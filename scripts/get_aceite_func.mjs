import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  const r = await pool.query(`
    SELECT proname, pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname = 'trg_evento_prestador_aceitou'
  `);
  console.log(r.rows[0]?.pg_get_functiondef || 'NOT FOUND');
  await pool.end();
}
main();
