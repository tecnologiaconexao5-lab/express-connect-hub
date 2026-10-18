import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  const r = await pool.query(`
    SELECT column_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'eventos_oficiais'
    ORDER BY ordinal_position
  `);
  for (const c of r.rows) {
    console.log(c.column_name.padEnd(25), (c.column_default || '---').padEnd(30), c.is_nullable);
  }
  await pool.end();
}
main();
