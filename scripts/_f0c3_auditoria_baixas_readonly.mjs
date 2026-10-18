/**
 * F0-C3 — Auditoria READ-ONLY de estruturas de BAIXA/MOVIMENTACAO financeira.
 * Apenas SELECT em information_schema/pg_catalog + COUNT(*) (leitura).
 * Uso: node scripts/_f0c3_auditoria_baixas_readonly.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL nao definida'); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // 1) Tabelas/views publicas cujo nome remete a baixa/movimentacao/conciliacao/caixa/tesouraria
  const relPattern = '^(financeiro_baixas|.*baixa.*|.*movimentac.*|.*conciliac.*|.*cnab.*|.*tesouraria.*|.*caixa.*|.*conta_bancar.*|.*extrato.*|.*fluxo.*|.*lancamentos_financeiros.*|.*saldos_financeiros.*|.*historico_pag.*|.*pagamento.*historico.*)$';
  const { rows: relRows } = await client.query(`
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name ~ $1 OR table_name IN (
        'financeiro_baixas','lancamentos_financeiros','saldos_financeiros'
      ))
    ORDER BY table_name
  `, [relPattern]);

  console.log('=== TABELAS/VIEWS RELEVANTES ENCONTRADAS ===');
  for (const r of relRows) {
    const { rows: colRows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position
    `, [r.table_name]);
    const { rows: cnt } = await client.query(`SELECT COUNT(*)::int AS n FROM public.${r.table_name}`);
    console.log(`\n[${r.table_type}] ${r.table_name}  (${cnt[0].n} registros)`);
    console.log('  colunas: ' + colRows.map(c => c.column_name).join(', '));
  }

  // 2) financeiro_baixas: ha vinculos com financeiro_pagar?
  const fbCheckResult = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE titulo_tabela='financeiro_pagar')::int AS pagar,
      COUNT(*) FILTER (WHERE estornada)::int AS estornadas,
      COUNT(DISTINCT titulo_id)::int AS titulos_distintos
    FROM public.financeiro_baixas
  `).catch(() => null);
  const fbCheck = fbCheckResult ? fbCheckResult.rows : [{ total: null }];

  if (fbCheck[0] && fbCheck[0].total !== null) {
    console.log('\n=== financeiro_baixas: resumo ===');
    console.log(`total=${fbCheck[0].total} | para financeiro_pagar=${fbCheck[0].pagar} | estornadas=${fbCheck[0].estornadas} | titulos distintos=${fbCheck[0].titulos_distintos}`);
  }

  // 3) financeiro_pagar: quantos registros, quantos com status pago/parcial
  const { rows: fpCheck } = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='pago')::int AS pago,
      COUNT(*) FILTER (WHERE status='parcial')::int AS parcial,
      COUNT(*) FILTER (WHERE status='cancelado')::int AS cancelado
    FROM public.financeiro_pagar
  `);
  console.log('\n=== financeiro_pagar: resumo ===');
  console.log(`total=${fpCheck[0].total} | pago=${fpCheck[0].pago} | parcial=${fpCheck[0].parcial} | cancelado=${fpCheck[0].cancelado}`);

  await client.end();
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });