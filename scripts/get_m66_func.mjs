import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  const r = await pool.query(`
    SELECT proname, pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname IN ('f_trg_propagar_financeiro_alocacao', 'f_trg_propagar_financeiro_os')
  `);
  for (const row of r.rows) {
    console.log(`\n=== ${row.proname} ===`);
    console.log(row.pg_get_functiondef);
  }
  await pool.end();
}
main();
