import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const r = await pool.query(`SELECT prosrc FROM pg_proc WHERE proname = 'f_buscar_operacoes_motorista'`);
if (!r.rows[0]) { console.log('NAO ENCONTRADA'); process.exit(0); }
const s = r.rows[0].prosrc;
console.log(s.slice(0, 4000));

await pool.end();