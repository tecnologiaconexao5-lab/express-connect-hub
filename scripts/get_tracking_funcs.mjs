import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  const r = await pool.query(`
    SELECT proname, pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname IN ('f_trg_tracking_iniciado', 'f_trg_atualizar_status_alocacao_tracking')
  `);
  for (const row of r.rows) {
    console.log(`\n=== ${row.proname} ===`);
    console.log(row.pg_get_functiondef);
  }
  await pool.end();
}
main();
