import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// SOMENTE LEITURA — confirmar search_path e segurança do RPC aplicado
const r = await pool.query(`
  SELECT p.proconfig, p.prosecdef
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
`);
console.log('proconfig (search_path):', JSON.stringify(r.rows[0].proconfig));
console.log('prosecdef (SECURITY DEFINER):', r.rows[0].prosecdef);
await pool.end();
