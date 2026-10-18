/**
 * F0-B — Confirmação READ-ONLY do schema financeiro de produção.
 * Apenas SELECT em information_schema/pg_catalog. Nenhuma escrita.
 * Uso: node scripts/_f0b_schema_financeiro_readonly.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL nao definida'); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const TARGETS = {
  financeiro_receber: [
    'competencia', 'saldo', 'origem', 'origem_id', 'parcela', 'total_parcelas',
    'tenant_id', 'fatura_numero', 'quantidade_itens', 'fatura_id'
  ],
  financeiro_pagar: [
    'descricao', 'competencia', 'saldo', 'prestador_id', 'prestador_nome',
    'alocacao_id', 'parcela', 'total_parcelas', 'tenant_id', 'forma_pagamento',
    'recorrencia', 'recorrente', 'quantidade_parcelas', 'parcela_atual'
  ],
  pagamentos_prestadores: [
    'arquivo', 'observacao', 'conta_pagamento', 'elegivel_lote', 'conta_contabil',
    'quantidade_os', 'periodo_inicio', 'periodo_fim', 'valor_liquido'
  ]
};

async function main() {
  await client.connect();

  const { rows } = await client.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position
  `, [Object.keys(TARGETS)]);

  const cols = {};
  for (const r of rows) {
    if (!cols[r.table_name]) cols[r.table_name] = new Set();
    cols[r.table_name].add(r.column_name);
  }

  console.log('TABELA | COLUNA | EXISTE EM PRODUCAO? | OBSERVACAO');
  for (const [table, targetList] of Object.entries(TARGETS)) {
    const existentes = cols[table] ? new Set(cols[table]) : new Set();
    console.log(`--- ${table} (${existentes.size} colunas totais) ---`);
    for (const col of targetList) {
      const ok = existentes.has(col);
      console.log(`${table} | ${col} | ${ok ? 'SIM' : 'NAO'} | ${ok ? '--' : 'AUSENTE EM PRODUCAO'}`);
    }
  }

  console.log('\n=== LISTA COMPLETA DE COLUNAS POR TABELA ===');
  for (const [table, set] of Object.entries(cols)) {
    console.log(`\n${table}:`);
    console.log([...set].join(', '));
  }

  await client.end();
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
