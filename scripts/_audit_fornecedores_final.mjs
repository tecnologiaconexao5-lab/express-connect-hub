/**
 * FINAL AUDIT — prestadores data + financeiro_pagar detail + receitas views
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function header(t) { console.log(`\n${'='.repeat(80)}\n${t}\n${'='.repeat(80)}`); }

async function main() {
  await client.connect();
  console.log('Conectado (read-only)\n');

  // 1. prestadores sample
  header('PRESTADORES — Sample Data (top 10)');
  const { rows: prest } = await client.query(`
    SELECT id, nome_completo, cpf_cnpj, tipo_parceiro, status, auth_user_id, 
           favorecido, cpf_cnpj_favorecido, centro_custo
    FROM prestadores LIMIT 10;
  `);
  for (const r of prest) console.log(`  ${String(r.id).slice(0,8)} | ${r.nome_completo} | doc=${r.cpf_cnpj} | tipo=${r.tipo_parceiro} | status=${r.status} | fav=${r.favorecido || 'NULL'} | fav_doc=${r.cpf_cnpj_favorecido || 'NULL'} | centro=${r.centro_custo || 'NULL'}`);

  // 2. prestadores count
  header('PRESTADORES — Count');
  const { rows: prestCount } = await client.query(`SELECT count(*) as total FROM prestadores;`);
  console.log(`  Total prestadores: ${prestCount[0].total}`);

  // 3. financeiro_pagar — all rows with fornecedor info
  header('FINANCEIRO_PAGAR — All rows with fornecedor info (non-test)');
  const { rows: fpReal } = await client.query(`
    SELECT id, fornecedor_id, fornecedor_nome, fornecedor, fornecedor_documento,
           prestador, os_id, valor, status, categoria, plano_contas, centro_resultado,
           data_vencimento, data_pagamento, is_teste
    FROM financeiro_pagar 
    WHERE is_teste = false
    ORDER BY created_at DESC LIMIT 20;
  `);
  for (const r of fpReal) console.log(`  ${String(r.id).slice(0,8)} | forn_id=${r.fornecedor_id || 'NULL'} | forn_nome=${r.fornecedor_nome || 'NULL'} | forn=${r.fornecedor || 'NULL'} | forn_doc=${r.fornecedor_documento || 'NULL'} | prest=${r.prestador || 'NULL'} | os=${r.os_id || 'NULL'} | val=${r.valor} | st=${r.status} | cat=${r.categoria || 'NULL'} | venc=${r.data_vencimento} | pgto=${r.data_pagamento}`);

  // 4. financeiro_pagar — distinct status values
  header('FINANCEIRO_PAGAR — Distinct Status');
  const { rows: fpStatus } = await client.query(`
    SELECT status, count(*) as cnt FROM financeiro_pagar GROUP BY status ORDER BY cnt DESC;
  `);
  for (const s of fpStatus) console.log(`  ${s.status || 'NULL'}: ${s.cnt}`);

  // 5. vw_motorista_financeiro full definition
  header('VIEW vw_motorista_financeiro — Full Definition');
  const { rows: vwDef } = await client.query(`
    SELECT definition FROM pg_views WHERE viewname = 'vw_motorista_financeiro';
  `);
  if (vwDef.length > 0) console.log(vwDef[0].definition);

  // 6. vw_relatorio_pagamento_detalhado full definition
  header('VIEW vw_relatorio_pagamento_detalhado — Full Definition');
  const { rows: vwDef2 } = await client.query(`
    SELECT definition FROM pg_views WHERE viewname = 'vw_relatorio_pagamento_detalhado';
  `);
  if (vwDef2.length > 0) console.log(vwDef2[0].definition);

  // 7. Check all tables that have "fornecedor" as FK target
  header('ALL TABLES WITH FK TO PRESTADORES (fornecedor)');
  const { rows: fkPrest } = await client.query(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'prestadores' AND ccu.column_name = 'id' AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name;
  `);
  for (const r of fkPrest) console.log(`  ${r.table_name}.${r.column_name} → prestadores.id`);
  if (fkPrest.length === 0) console.log('  (none found)');

  // 8. All tables with FK to contas_financeiras
  header('ALL TABLES WITH FK TO contas_financeiras');
  const { rows: fkCF } = await client.query(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'contas_financeiras' AND ccu.column_name = 'id' AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name;
  `);
  for (const r of fkCF) console.log(`  ${r.table_name}.${r.column_name} → contas_financeiras.id`);
  if (fkCF.length === 0) console.log('  (none found)');

  // 9. Check recibos table
  header('RECIBOS — Schema');
  const { rows: recCols } = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns WHERE table_name = 'recibos' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  for (const c of recCols) console.log(`  ${c.column_name} ${c.data_type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);

  // 10. recibos count
  header('RECIBOS — Count');
  const { rows: recCount } = await client.query(`SELECT count(*) as total FROM recibos;`);
  console.log(`  Total recibos: ${recCount[0].total}`);

  // 11. Check all foreign keys in the entire database that reference any table
  header('ALL FOREIGN KEYS IN DATABASE (grouped by source table)');
  const { rows: allFks } = await client.query(`
    SELECT 
      tc.table_name as source_table,
      kcu.column_name as source_column,
      ccu.table_name as target_table,
      ccu.column_name as target_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
  `);
  
  let currentTable = '';
  for (const fk of allFks) {
    if (fk.source_table !== currentTable) {
      if (currentTable) console.log('');
      currentTable = fk.source_table;
      console.log(`  ${fk.source_table}:`);
    }
    console.log(`    ${fk.source_column} → ${fk.target_table}.${fk.target_column}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('FINAL AUDIT COMPLETE');
  console.log('='.repeat(80));

  await client.end();
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(2); });
