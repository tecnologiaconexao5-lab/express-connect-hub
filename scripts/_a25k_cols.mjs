import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const cols = await pool.query(`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_name IN ('prestadores','veiculos','alocacoes_escala','clientes','ordens_servico')
  ORDER BY table_name, ordinal_position
`);
for (const c of cols.rows) console.log(c.table_name.padEnd(20), c.column_name);

await pool.end();