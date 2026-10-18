import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const rpc = await c.query(`SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_buscar_operacoes_motorista'`);
  console.log('=== f_buscar_operacoes_motorista ===');
  console.log(rpc.rows[0] ? rpc.rows[0].def : 'NÃO ENCONTRADA');
  const deps = await c.query(`
    SELECT DISTINCT dependent.relname AS objeto, dependent.relkind
    FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class dependent ON dependent.oid = r.ev_class
    JOIN pg_class source ON source.oid = d.refobjid
    JOIN pg_namespace ns ON ns.oid = source.relnamespace
    WHERE source.relname = 'vw_app_motorista_operacoes' AND ns.nspname='public'
  `);
  console.log('=== Objetos dependentes da view ===');
  for (const d of deps.rows) console.log(` ${d.relkind}: ${d.objeto}`);
  await c.end();
})().catch((e)=>{console.error('ERRO:',e.message);process.exit(1);});
