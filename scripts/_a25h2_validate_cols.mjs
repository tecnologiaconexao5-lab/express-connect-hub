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

// Extrair lista de colunas do INSERT INTO public.portal_tracking_realtime
const m = def.match(/INSERT INTO public\.portal_tracking_realtime\s*\(([\s\S]*?)\)\s*VALUES/);
const colsText = m ? m[1] : '';
const cols = colsText.split(',').map(c => c.trim()).filter(Boolean);
console.log('=== COLUNAS NO INSERT ===');
console.log(cols.join('\n'));

// Colunas reais
const rc = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='portal_tracking_realtime'
`);
const realCols = new Set(rc.rows.map(r => r.column_name));

console.log('\n=== VALIDAÇÃO COLUNA × REAL ===');
let ok = true;
for (const c of cols) {
  const exists = realCols.has(c);
  if (!exists) ok = false;
  console.log(`  ${c}: ${exists ? 'EXISTE ✓' : 'NÃO EXISTE ✗'}`);
}
console.log('\nTODAS AS COLUNAS EXISTEM:', ok ? 'SIM ✓' : 'NÃO');

await pool.end();