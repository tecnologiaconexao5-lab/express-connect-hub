import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const r = await pool.query(`
  SELECT column_name, data_type, udt_name, is_nullable
  FROM information_schema.columns 
  WHERE table_name = 'ordens_servico' 
  ORDER BY ordinal_position
`);
for (const c of r.rows) console.log(c.column_name.padEnd(25), c.data_type.padEnd(15), c.udt_name.padEnd(15), c.is_nullable);
await pool.end();
