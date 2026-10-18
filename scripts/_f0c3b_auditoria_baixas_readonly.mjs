/**
 * F0-C3b — Auditoria READ-ONLY complementar.
 * Verifica existencia em producao de:
 *  - despesas_operacionais, financeiro_baixas
 *  - funcoes de baixa/estorno/conciliacao
 *  - views financeiras (vw_relatorio_*)
 *  - quaisquer FKs que referenciem financeiro_pagar.id
 * Somente leitura.
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL nao definida'); process.exit(1); }
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const Q = async (s) => {
  try { const r = await client.query(s); return r.rows; }
  catch (e) { return [{ erro: e.message.split('\n')[0] }]; }
};

async function main() {
  await client.connect();

  console.log('=== TABELAS CANDIDATAS (existem em producao?) ===');
  const cand = ['financeiro_baixas','despesas_operacionais','lancamentos_financeiros','saldos_financeiros'];
  const { rows: tab } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY($1)`, [cand]);
  const existe = new Set(tab.map(t => t.tablename));
  for (const c of cand) {
    let extra = '';
    if (existe.has(c)) {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS n FROM public.${c}`).catch(() => ({ rows: [{ n: -1 }] }));
      extra = `  registros=${rows[0].n}`;
    }
    console.log(`${existe.has(c) ? 'SIM' : 'NAO'}  ${c}${extra}`);
  }

  console.log('\n=== FUNCOES de baixa/estorno/conciliacao (existem em producao?) ===');
  const { rows: fn } = await client.query(
    `SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
     AND (proname ILIKE '%baixa%' OR proname ILIKE '%estorno%' OR proname ILIKE '%conciliac%' OR proname ILIKE '%lancamento%') ORDER BY proname`);
  console.log(fn.length ? fn.map(f => `SIM  ${f.proname}`).join('\n') : 'nenhuma encontrada');

  console.log('\n=== VIEWS financeiras (existem em producao?) ===');
  const { rows: vw } = await client.query(
    `SELECT viewname FROM pg_views WHERE schemaname='public' AND viewname ILIKE '%financ%' ORDER BY viewname`);
  console.log(vw.length ? vw.map(v => `SIM  ${v.viewname}`).join('\n') : 'nenhuma encontrada');

  console.log('\n=== FKs que referenciam financeiro_pagar.id ===');
  const { rows: fk } = await client.query(`
    SELECT tc.table_name AS filha, kcu.column_name AS coluna_filha, ccu.table_name AS pai
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'financeiro_pagar'`);
  console.log(fk.length ? fk.map(f => `${f.filha}.${f.coluna_filha} -> financeiro_pagar.id`).join('\n') : 'nenhuma FK referenciando financeiro_pagar');

  await client.end();
}
main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });