import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  const r = await pool.query(`
    SELECT tgname, pg_get_triggerdef(oid) AS def
    FROM pg_trigger
    WHERE tgrelid::regclass::text = 'portal_tracking_realtime'
    AND NOT tgisinternal
  `);
  for (const row of r.rows) {
    console.log(`\n=== ${row.tgname} ===`);
    console.log(row.def);
  }
  
  console.log('\n=== eventos_oficiais columns ===');
  const cols = await pool.query(`
    SELECT column_name, udt_name, is_nullable FROM information_schema.columns
    WHERE table_name = 'eventos_oficiais'
    ORDER BY ordinal_position
  `);
  for (const c of cols.rows) {
    console.log(c.column_name.padEnd(25), c.udt_name.padEnd(15), c.is_nullable);
  }
  await pool.end();
}
main();
