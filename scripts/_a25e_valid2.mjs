import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const r = await pool.query(`
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='registrar_posicao_motorista'
`);
const def = r.rows[0].def;
const m = def.match(/VALIDAÇÃO 2:[\s\S]*?END IF;/);
console.log('--- VALIDAÇÃO 2 (prestador) ---');
console.log(m ? m[0].slice(0, 800) : 'não isolou');
console.log('\nSELECT id, tenant_id INTO ... FROM public.prestadores presente?', /SELECT\s+id,\s*tenant_id\s+INTO[\s\S]*?FROM public\.prestadores/.test(def));
await pool.end();
