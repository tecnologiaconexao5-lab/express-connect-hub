import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const r = await pool.query(`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'prestadores'
  ORDER BY ordinal_position
`);
for (const c of r.rows) console.log(c.column_name);
await pool.end();
