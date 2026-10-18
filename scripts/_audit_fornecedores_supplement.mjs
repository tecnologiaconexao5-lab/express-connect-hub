/**
 * SUPPLEMENTARY AUDIT — Deep dive into supplier/payable tables
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function header(t) { console.log(`\n${'='.repeat(80)}\n${t}\n${'='.repeat(80)}`); }

async function main() {
  await client.connect();
  console.log('Conectado (read-only)\n');

  // 1. contas_financeiras schema
  header('CONTAS FINANCEIRAS — Schema');
  const { rows: cf } = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns WHERE table_name = 'contas_financeiras' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  for (const c of cf) console.log(`  ${c.column_name} ${c.data_type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}${c.column_default ? ' DEFAULT ' + c.column_default : ''}`);

  // 2. composicao_financeira_os schema
  header('COMPOSICAO FINANCEIRA OS — Schema');
  const { rows: cfo } = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns WHERE table_name = 'composicao_financeira_os' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  for (const c of cfo) console.log(`  ${c.column_name} ${c.data_type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}${c.column_default ? ' DEFAULT ' + c.column_default : ''}`);

  // 3. financiero_pagar — sample data (first 5 rows, important columns)
  header('FINANCEIRO_PAGAR — Sample Data (fornecedor columns)');
  const { rows: fpSample } = await client.query(`
    SELECT id, fornecedor_id, fornecedor_nome, fornecedor, fornecedor_documento,
           prestador, os_id, valor, status, categoria, plano_contas, centro_resultado,
           is_teste
    FROM financeiro_pagar ORDER BY created_at DESC LIMIT 10;
  `);
  for (const r of fpSample) {
    console.log(`  id=${String(r.id).slice(0,8)} | forn_id=${r.fornecedor_id || 'NULL'} | forn_nome=${r.fornecedor_nome || 'NULL'} | forn=${r.fornecedor || 'NULL'} | forn_doc=${r.fornecedor_documento || 'NULL'} | prest=${r.prestador || 'NULL'} | os=${r.os_id || 'NULL'} | val=${r.valor} | st=${r.status} | cat=${r.categoria} | plano=${r.plano_contas} | centro=${r.centro_resultado} | teste=${r.is_teste}`);
  }

  // 4. financeiro_pagar — distinct categorias
  header('FINANCEIRO_PAGAR — Distinct Categorias');
  const { rows: cats } = await client.query(`
    SELECT categoria, count(*) as cnt FROM financeiro_pagar GROUP BY categoria ORDER BY cnt DESC;
  `);
  for (const c of cats) console.log(`  ${c.categoria || 'NULL'}: ${c.cnt}`);

  // 5. financeiro_pagar — distinct centro_resultado
  header('FINANCEIRO_PAGAR — Distinct Centro Resultado');
  const { rows: cr } = await client.query(`
    SELECT centro_resultado, count(*) as cnt FROM financeiro_pagar GROUP BY centro_resultado ORDER BY cnt DESC;
  `);
  for (const r of cr) console.log(`  ${r.centro_resultado || 'NULL'}: ${r.cnt}`);

  // 6. financeiro_pagar — distinct plano_contas
  header('FINANCEIRO_PAGAR — Distinct Plano Contas');
  const { rows: pc } = await client.query(`
    SELECT plano_contas, count(*) as cnt FROM financeiro_pagar GROUP BY plano_contas ORDER BY cnt DESC;
  `);
  for (const p of pc) console.log(`  ${p.plano_contas || 'NULL'}: ${p.cnt}`);

  // 7. financeiro_pagar — distinct fornecedor_id values
  header('FINANCEIRO_PAGAR — Distinct Fornecedor IDs');
  const { rows: fids } = await client.query(`
    SELECT fornecedor_id, count(*) as cnt, 
           array_agg(DISTINCT fornecedor_nome) as nomes,
           array_agg(DISTINCT fornecedor) as fornecedores
    FROM financeiro_pagar GROUP BY fornecedor_id ORDER BY cnt DESC;
  `);
  for (const f of fids) console.log(`  ${f.fornecedor_id || 'NULL'}: ${f.cnt} rows | nomes=${f.nomes} | fornecedores=${f.fornecedores}`);

  // 8. financeiro_pagar — prestador values
  header('FINANCEIRO_PAGAR — Distinct Prestador');
  const { rows: prest } = await client.query(`
    SELECT prestador, count(*) as cnt FROM financeiro_pagar GROUP BY prestador ORDER BY cnt DESC;
  `);
  for (const p of prest) console.log(`  ${p.prestador || 'NULL'}: ${p.cnt}`);

  // 9. contas_financeiras — full data
  header('CONTAS FINANCEIRAS — Full Data');
  const { rows: cfData } = await client.query(`SELECT * FROM contas_financeiras;`);
  for (const r of cfData) console.log(`  ${JSON.stringify(r)}`);

  // 10. centros_custo — schema check
  header('CENTROS CUSTO — Check for unique constraints');
  const { rows: ccUniq } = await client.query(`
    SELECT conname, contype FROM pg_constraint 
    WHERE conrelid = 'centros_custo'::regclass;
  `);
  if (ccUniq.length === 0) console.log('  No constraints found');
  for (const c of ccUniq) console.log(`  ${c.conname} [${c.contype}]`);

  // 11. financeiro_pagar — check unique constraints
  header('FINANCEIRO_PAGAR — Constraints');
  const { rows: fpConstr } = await client.query(`
    SELECT conname, contype, 
           pg_get_constraintdef(oid) as def
    FROM pg_constraint 
    WHERE conrelid = 'financeiro_pagar'::regclass;
  `);
  if (fpConstr.length === 0) console.log('  No constraints found');
  for (const c of fpConstr) console.log(`  ${c.conname} [${c.contype}]: ${c.def}`);

  // 12. Check trigger functions for financeiro_pagar
  header('TRIGGER FUNCTION — trg_guardar_pagar_pago_sem_baixa');
  const { rows: trigFunc } = await client.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'trg_guardar_pagar_pago_sem_baixa';
  `);
  if (trigFunc.length > 0) console.log(trigFunc[0].prosrc.substring(0, 1000));
  else console.log('  Function not found');

  // 13. Check f_registrar_baixa_financeira function source
  header('RPC — f_registrar_baixa_financeira');
  const { rows: baixaFunc } = await client.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_registrar_baixa_financeira';
  `);
  if (baixaFunc.length > 0) console.log(baixaFunc[0].prosrc.substring(0, 2000));
  else console.log('  Function not found');

  // 14. Enum types
  header('ENUM TYPES');
  const { rows: enums } = await client.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder;
  `);
  let currentEnum = '';
  for (const e of enums) {
    if (e.typname !== currentEnum) {
      if (currentEnum) console.log('');
      currentEnum = e.typname;
      process.stdout.write(`  ${e.typname}: [`);
    } else {
      process.stdout.write(', ');
    }
    process.stdout.write(e.enumlabel);
  }
  if (currentEnum) console.log(']');

  // 15. financeiro_baixas — sample data
  header('FINANCEIRO_BAIXAS — Sample Data');
  const { rows: fbSample } = await client.query(`
    SELECT id, titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
           data_baixa, forma_pagamento, conta_financeira, conta_financeira_id, estornada
    FROM financeiro_baixas ORDER BY created_at DESC LIMIT 5;
  `);
  for (const r of fbSample) console.log(`  ${r.titulo_tabela} | ${String(r.titulo_id).slice(0,8)} | orig=${r.valor_original} | baix=${r.valor_baixado} | saldo=${r.saldo_restante} | conta=${r.conta_financeira} | conta_id=${r.conta_financeira_id || 'NULL'} | estornada=${r.estornada}`);

  // 16. financeiro_baixas — distinct titulo_tabela
  header('FINANCEIRO_BAIXAS — Distinct titulo_tabela');
  const { rows: fbTabelas } = await client.query(`
    SELECT titulo_tabela, count(*) as cnt FROM financeiro_baixas GROUP BY titulo_tabela;
  `);
  for (const t of fbTabelas) console.log(`  ${t.titulo_tabela}: ${t.cnt}`);

  // 17. Views related to financeiro
  header('VIEWS RELATED TO FINANCEIRO');
  const { rows: finViews } = await client.query(`
    SELECT viewname, definition FROM pg_views 
    WHERE schemaname = 'public' AND (viewname ILIKE '%financ%' OR viewname ILIKE '%pagamento%' OR viewname ILIKE '%receber%' OR viewname ILIKE '%pagar%');
  `);
  for (const v of finViews) {
    console.log(`  ${v.viewname}`);
    console.log(`    ${v.definition.substring(0, 300)}...`);
  }

  // 18. Check if there's a "fornecedor" table anywhere
  header('CHECK FOR "fornecedor" ANYWHERE');
  const { rows: fornSearch } = await client.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name ILIKE '%fornecedor%'
    ORDER BY table_name, column_name;
  `);
  for (const r of fornSearch) console.log(`  ${r.table_name}.${r.column_name}`);

  // 19. Check for "favorecido" anywhere
  header('CHECK FOR "favorecido" ANYWHERE');
  const { rows: favSearch } = await client.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name ILIKE '%favorecid%'
    ORDER BY table_name, column_name;
  `);
  for (const r of favSearch) console.log(`  ${r.table_name}.${r.column_name}`);
  if (favSearch.length === 0) console.log('  (none found)');

  // 20. Check prestadores schema (since fornecedor_id FK points there)
  header('PRESTADORES — Schema');
  const { rows: prestSchema } = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_name = 'prestadores' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  for (const c of prestSchema) console.log(`  ${c.column_name} ${c.data_type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);

  // 21. prestadores — sample data
  header('PRESTADORES — Sample Data');
  const { rows: prestSample } = await client.query(`
    SELECT id, nome_completo, cpf_cnpj, tipo_pessoa, status, auth_user_id
    FROM prestadores LIMIT 5;
  `);
  for (const r of prestSample) console.log(`  ${r.id} | ${r.nome_completo} | doc=${r.cpf_cnpj} | tipo=${r.tipo_pessoa} | status=${r.status} | auth=${r.auth_user_id || 'NULL'}`);

  // 22. All foreign keys referencing financeiro_pagar
  header('FKs REFERENCING financeiro_pagar');
  const { rows: refFk } = await client.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'financeiro_pagar' AND tc.constraint_type = 'FOREIGN KEY';
  `);
  for (const r of refFk) console.log(`  ${r.table_name}.${r.column_name} → financeiro_pagar.${r.ref_col}`);
  if (refFk.length === 0) console.log('  (none found)');

  // 23. All foreign keys referencing contas_financeiras
  header('FKs REFERENCING contas_financeiras');
  const { rows: refCf } = await client.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'contas_financeiras' AND tc.constraint_type = 'FOREIGN KEY';
  `);
  for (const r of refCf) console.log(`  ${r.table_name}.${r.column_name} → contas_financeiras.${r.ref_col}`);
  if (refCf.length === 0) console.log('  (none found)');

  // 24. financeiro_pagar — is_teste breakdown
  header('FINANCEIRO_PAGAR — is_teste Breakdown');
  const { rows: teste } = await client.query(`
    SELECT is_teste, count(*) as cnt FROM financeiro_pagar GROUP BY is_teste;
  `);
  for (const t of teste) console.log(`  is_teste=${t.is_teste}: ${t.cnt}`);

  // 25. financeiro_receber — is_teste breakdown
  header('FINANCEIRO_RECEBER — is_teste Breakdown');
  const { rows: testeR } = await client.query(`
    SELECT is_teste, count(*) as cnt FROM financeiro_receber GROUP BY is_teste;
  `);
  for (const t of testeR) console.log(`  is_teste=${t.is_teste}: ${t.cnt}`);

  console.log('\n' + '='.repeat(80));
  console.log('SUPPLEMENTARY AUDIT COMPLETE');
  console.log('='.repeat(80));

  await client.end();
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(2); });
