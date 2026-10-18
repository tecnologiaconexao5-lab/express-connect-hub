import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const cols = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='historico_alocacoes_escala' ORDER BY ordinal_position
`);
console.log('historico_alocacoes_escala cols:', cols.rows.map(c=>c.column_name).join(', '));
await pool.end();