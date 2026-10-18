/**
 * F0-E2 — Auditoria READ-ONLY do schema real de `pagamentos_prestadores`.
 * Apenas SELECT em information_schema / pg_catalog. Nenhuma escrita.
 * Uso: node scripts/f0e2_audit_schema_pagamentos.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL nao definida'); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const COLUNAS_ALVO = [
  'valor', 'valor_total', 'valor_liquido', 'valor_servicos',
  'pedagio', 'reembolsos', 'adicionais', 'descontos',
  'adiantamentos', 'multas', 'ajustes',
];

const TABELAS_HOMONIMAS = ['pagamento_prestadores', 'pagamentos_prestadores', 'pagamentos_prestadores_itens'];

async function main() {
  await client.connect();

  // 1) Schema completo da tabela oficial
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamentos_prestadores'
    ORDER BY ordinal_position
  `);

  console.log('=== public.pagamentos_prestadores — SCHEMA REAL (informatiOn_schema.columns) ===');
  if (!cols.rows.length) {
    console.log('>> TABELA NAO EXISTE em information_schema.columns (schema public)');
  } else {
    console.log(`Total de colunas: ${cols.rows.length}\n`);
    const colunas = new Set();
    for (const r of cols.rows) {
      colunas.add(r.column_name);
      console.log(`  ${r.column_name}: ${r.data_type}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}${r.column_default ? ` DEFAULT ${r.column_default}` : ''}`);
    }

    console.log('\n=== COLUNAS-ALVO (F0-E2) ===');
    for (const c of COLUNAS_ALVO) {
      const ok = colunas.has(c);
      const row = cols.rows.find((x) => x.column_name === c);
      console.log(`  ${c.padEnd(18)} -> ${ok ? 'EXISTE' : 'NAO EXISTE'}${row ? `  (${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}${row.column_default ? ` DEFAULT ${row.column_default}` : ''})` : ''}`);
    }
  }

  // 2) Tabelas homônimas / paralelas existentes
  console.log('\n=== TABELAS HOMONIMAS / PARALELAS (procura engano) ===');
  for (const t of TABELAS_HOMONIMAS) {
    const exist = await client.query(
      `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [t]
    );
    if (exist.rows.length) {
      console.log(`  ${t} -> EXISTE (${exist.rows[0].table_type})`);
    } else {
      console.log(`  ${t} -> NAO EXISTE em public`);
    }
  }

  // 3) Views que referenciam pagamentos_prestadores (fonte alternativa)
  console.log('\n=== VIEWS que referenciam pagamentos_prestadores ===');
  const views = await client.query(`
    SELECT viewname AS view, definition
    FROM pg_views
    WHERE schemaname = 'public'
      AND definition ILIKE '%pagamentos_prestadores%'
  `);
  if (!views.rows.length) {
    console.log('  nenhuma view em public referencia pagamentos_prestadores');
  } else {
    for (const v of views.rows) {
      console.log(`  VIEW: ${v.view}`);
      console.log(`    ${v.definition.replace(/\s+/g, ' ').slice(0, 220)}...`);
    }
  }

  await client.end();
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });