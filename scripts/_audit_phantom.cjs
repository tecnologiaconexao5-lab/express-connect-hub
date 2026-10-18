const pg = require('pg');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await c.connect();

  // Check actual columns of financeiro_receber
  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'financeiro_receber'
    ORDER BY ordinal_position
  `);
  console.log('=== financeiro_receber columns ===');
  console.table(cols.rows);

  // Check actual columns of financeiro_pagar
  const cols2 = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'financeiro_pagar'
    ORDER BY ordinal_position
  `);
  console.log('=== financeiro_pagar columns ===');
  console.table(cols2.rows);

  // Phantom RECEBER without metadata
  const phantoms = await c.query(`
    SELECT fr.*
    FROM financeiro_receber fr
    WHERE fr.status = 'pago'
    AND NOT EXISTS (SELECT 1 FROM financeiro_baixas fb WHERE fb.titulo_tabela = 'financeiro_receber' AND fb.titulo_id = fr.id)
    ORDER BY fr.created_at DESC
  `);

  console.log(`\n=== PHANTOM RECEBER: ${phantoms.rows.length} records ===\n`);

  for (const row of phantoms.rows) {
    console.log(`--- ${row.id} ---`);
    console.log(`  fatura: ${row.fatura}`);
    console.log(`  descricao: ${row.descricao}`);
    console.log(`  cliente_id: ${row.cliente_id}`);
    console.log(`  valor: ${row.valor}`);
    console.log(`  valor_bruto: ${row.valor_bruto}`);
    console.log(`  valor_liquido: ${row.valor_liquido}`);
    console.log(`  status: ${row.status}`);
    console.log(`  data_pagamento: ${row.data_pagamento}`);
    console.log(`  data_vencimento: ${row.data_vencimento}`);
    console.log(`  os_id: ${row.os_id}`);
    console.log(`  created_at: ${row.created_at}`);
    console.log(`  updated_at: ${row.updated_at}`);
    console.log(`  ALL fields: ${JSON.stringify(row, null, 2).substring(0, 500)}`);
    console.log('');
  }

  // NULL records
  console.log('\n=== NULL RECEBER ===\n');
  const nulls = await c.query(`
    SELECT fr.*
    FROM financeiro_receber fr
    WHERE fr.valor IS NULL OR fr.status IS NULL
    ORDER BY fr.created_at DESC
  `);
  for (const row of nulls.rows) {
    console.log(`--- ${row.id} ---`);
    console.log(`  fatura: ${row.fatura}, valor: ${row.valor}, status: ${row.status}`);
    console.log(`  cliente_id: ${row.cliente_id}, created_at: ${row.created_at}`);
    console.log(`  ALL: ${JSON.stringify(row, null, 2).substring(0, 500)}`);
    console.log('');
  }

  console.log('\n=== NULL PAGAR ===\n');
  const nullPagar = await c.query(`
    SELECT fp.*
    FROM financeiro_pagar fp
    WHERE fp.valor IS NULL OR fp.status IS NULL
    ORDER BY fp.created_at DESC
  `);
  for (const row of nullPagar.rows) {
    console.log(`--- ${row.id} ---`);
    console.log(`  descricao: ${row.descricao}, valor: ${row.valor}, status: ${row.status}`);
    console.log(`  fornecedor_id: ${row.fornecedor_id}, created_at: ${row.created_at}`);
    console.log(`  ALL: ${JSON.stringify(row, null, 2).substring(0, 500)}`);
    console.log('');
  }

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
