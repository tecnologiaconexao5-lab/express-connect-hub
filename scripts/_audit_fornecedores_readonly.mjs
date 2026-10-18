/**
 * AUDITORIA READ-ONLY — Tabelas de Fornecedores/Favorecidos/Financeiro Pagar
 *
 * NENHUM INSERT/UPDATE/DELETE. Apenas SELECT.
 * Lista todas as tabelas, schema, RLS, triggers, FKs e contagens.
 *
 * Uso: node scripts/_audit_fornecedores_readonly.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL não definida'); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

function header(t) { console.log(`\n${'='.repeat(80)}\n${t}\n${'='.repeat(80)}`); }
function subheader(t) { console.log(`\n--- ${t} ---`); }

async function main() {
  await client.connect();
  console.log('Conectado (read-only)\n');

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. LIST ALL TABLES IN PUBLIC SCHEMA
  // ═══════════════════════════════════════════════════════════════════════════════
  header('1. ALL TABLES IN PUBLIC SCHEMA');
  const { rows: allTables } = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
  `);
  console.log(`Total tables: ${allTables.length}\n`);
  for (const t of allTables) {
    console.log(`  ${t.tablename}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. SEARCH FOR RELEVANT TABLES
  // ═══════════════════════════════════════════════════════════════════════════════
  header('2. SEARCH FOR RELEVANT TABLES');
  const keywords = [
    'fornec', 'supplier', 'vendor', 'payab', 'despes', 'categor', 'plano',
    'centro', 'favorecid', 'pessoa', 'contas_pagar', 'financeiro_pagar',
    'conta_financeira', 'financeiro', 'pagamento', 'baixa', 'receber'
  ];
  
  const searchTerms = keywords.map(k => `tablename LIKE '%${k}%'`).join(' OR ');
  const { rows: relevantTables } = await client.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' AND (${searchTerms})
    ORDER BY tablename;
  `);
  
  console.log(`Tables matching keywords (${keywords.join(', ')}): ${relevantTables.length}\n`);
  for (const t of relevantTables) {
    console.log(`  ${t.tablename}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. FULL SCHEMA FOR EACH RELEVANT TABLE
  // ═══════════════════════════════════════════════════════════════════════════════
  header('3. FULL SCHEMA FOR RELEVANT TABLES');
  
  const relevantTableNames = relevantTables.map(t => t.tablename);
  
  for (const tableName of relevantTableNames) {
    subheader(`Schema: ${tableName}`);
    const { rows: cols } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position;
    `, [tableName]);
    
    if (cols.length === 0) {
      console.log('  (no columns found - table may not exist in information_schema)');
      continue;
    }
    
    console.log(`  Columns: ${cols.length}`);
    for (const c of cols) {
      const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = c.column_default ? ` DEFAULT ${c.column_default}` : '';
      console.log(`    ${c.column_name} ${c.data_type} ${nullable}${defaultVal}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. RLS POLICIES FOR RELEVANT TABLES
  // ═══════════════════════════════════════════════════════════════════════════════
  header('4. RLS POLICIES FOR RELEVANT TABLES');
  
  for (const tableName of relevantTableNames) {
    const { rows: policies } = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
      FROM pg_policies WHERE tablename = $1;
    `, [tableName]);
    
    if (policies.length === 0) {
      console.log(`  ${tableName}: NO RLS POLICIES`);
    } else {
      console.log(`  ${tableName}: ${policies.length} policies`);
      for (const p of policies) {
        console.log(`    ${p.policyname} [${p.cmd}] roles=${p.roles} permissive=${p.permissive}`);
        if (p.qual) console.log(`      USING: ${p.qual.substring(0, 200)}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. TRIGGERS ON RELEVANT TABLES
  // ═══════════════════════════════════════════════════════════════════════════════
  header('5. TRIGGERS ON RELEVANT TABLES');
  
  for (const tableName of relevantTableNames) {
    const { rows: triggers } = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement 
      FROM information_schema.triggers WHERE event_object_table = $1;
    `, [tableName]);
    
    if (triggers.length === 0) {
      console.log(`  ${tableName}: NO TRIGGERS`);
    } else {
      console.log(`  ${tableName}: ${triggers.length} triggers`);
      for (const t of triggers) {
        console.log(`    ${t.trigger_name} [${t.event_manipulation}] → ${t.action_statement.substring(0, 120)}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. FOREIGN KEYS ON RELEVANT TABLES
  // ═══════════════════════════════════════════════════════════════════════════════
  header('6. FOREIGN KEYS ON RELEVANT TABLES');
  
  for (const tableName of relevantTableNames) {
    const { rows: fks } = await client.query(`
      SELECT tc.constraint_name, kcu.column_name, 
             ccu.table_name AS foreign_table_name, 
             ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY';
    `, [tableName]);
    
    if (fks.length === 0) {
      console.log(`  ${tableName}: NO FOREIGN KEYS`);
    } else {
      console.log(`  ${tableName}: ${fks.length} foreign keys`);
      for (const fk of fks) {
        console.log(`    ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name} (${fk.constraint_name})`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. ROW COUNTS FOR KEY TABLES
  // ═══════════════════════════════════════════════════════════════════════════════
  header('7. ROW COUNTS');
  
  // Build dynamic count query for all relevant tables
  const countQueries = relevantTableNames.map(t => 
    `SELECT '${t}' as table_name, count(*) as row_count FROM "${t}"`
  ).join(' UNION ALL ');
  
  if (countQueries) {
    try {
      const { rows: counts } = await client.query(countQueries);
      for (const c of counts) {
        console.log(`  ${c.table_name}: ${c.row_count} rows`);
      }
    } catch (err) {
      console.log(`  Error counting rows: ${err.message}`);
      // Try one by one
      for (const t of relevantTableNames) {
        try {
          const { rows } = await client.query(`SELECT count(*) as cnt FROM "${t}"`);
          console.log(`  ${t}: ${rows[0].cnt} rows`);
        } catch (e) {
          console.log(`  ${t}: ERROR - ${e.message}`);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. ADDITIONAL KEYWORDS SEARCH
  // ═══════════════════════════════════════════════════════════════════════════════
  header('8. ADDITIONAL KEYWORD SEARCH');
  const additionalKeywords = ['fornec', 'supplier', 'vendor', 'payab', 'despes', 'categor', 'plano', 'centro'];
  
  for (const kw of additionalKeywords) {
    const { rows } = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename ILIKE $1
      ORDER BY tablename;
    `, [`%${kw}%`]);
    
    if (rows.length > 0) {
      console.log(`  Keyword "${kw}": ${rows.map(r => r.tablename).join(', ')}`);
    } else {
      console.log(`  Keyword "${kw}": (no matches)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 9. CHECK VIEWS RELATED TO SUPPLIERS
  // ═══════════════════════════════════════════════════════════════════════════════
  header('9. VIEWS IN PUBLIC SCHEMA');
  const { rows: views } = await client.query(`
    SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;
  `);
  console.log(`Total views: ${views.length}\n`);
  for (const v of views) {
    console.log(`  ${v.viewname}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 10. CHECK FUNCTIONS RELATED TO SUPPLIERS/PAYABLE
  // ═══════════════════════════════════════════════════════════════════════════════
  header('10. FUNCTIONS RELATED TO PAYABLE/SUPPLIER');
  const { rows: functions } = await client.query(`
    SELECT p.proname, pg_get_function_result(p.oid) AS return_type,
           pg_get_function_arguments(p.oid) AS args,
           p.provolatile AS volatility
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname ILIKE '%fornecedor%' 
           OR p.proname ILIKE '%favorecid%'
           OR p.proname ILIKE '%pagar%'
           OR p.proname ILIKE '%despesa%'
           OR p.proname ILIKE '%baixa%'
           OR p.proname ILIKE '%supplier%'
           OR p.proname ILIKE '%payab%')
    ORDER BY p.proname;
  `);
  
  if (functions.length === 0) {
    console.log('  No functions matching supplier/payable keywords');
  } else {
    for (const f of functions) {
      console.log(`  ${f.proname}(${f.args}) → ${f.return_type} [${f.volatility}]`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 11. CHECK RLS STATUS FOR ALL TABLES
  // ═══════════════════════════════════════════════════════════════════════════════
  header('11. RLS STATUS FOR ALL TABLES');
  const { rows: rlsStatus } = await client.query(`
    SELECT tablename, rowsecurity AS rls_enabled
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  
  const withRLS = rlsStatus.filter(t => t.rls_enabled);
  const withoutRLS = rlsStatus.filter(t => !t.rls_enabled);
  
  console.log(`Tables WITH RLS: ${withRLS.length}`);
  for (const t of withRLS) {
    console.log(`  [RLS ON] ${t.tablename}`);
  }
  
  console.log(`\nTables WITHOUT RLS: ${withoutRLS.length}`);
  for (const t of withoutRLS) {
    console.log(`  [RLS OFF] ${t.tablename}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 12. CHECK FOR TABLES WITH "conta" OR "financeir" IN NAME
  // ═══════════════════════════════════════════════════════════════════════════════
  header('12. TABLES WITH "conta" OR "financeir" IN NAME');
  const { rows: contaTables } = await client.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
      AND (tablename ILIKE '%conta%' OR tablename ILIKE '%financeir%')
    ORDER BY tablename;
  `);
  
  if (contaTables.length === 0) {
    console.log('  No tables found');
  } else {
    for (const t of contaTables) {
      // Get row count
      try {
        const { rows } = await client.query(`SELECT count(*) as cnt FROM "${t.tablename}"`);
        console.log(`  ${t.tablename}: ${rows[0].cnt} rows`);
      } catch (e) {
        console.log(`  ${t.tablename}: ERROR - ${e.message}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 13. CHECK "configuracoes_sistema" FOR FINANCIAL CONFIG
  // ═══════════════════════════════════════════════════════════════════════════════
  header('13. configuracoes_sistema — FINANCIAL CONFIG KEYS');
  try {
    const { rows: configs } = await client.query(`
      SELECT chave, valor 
      FROM configuracoes_sistema 
      WHERE chave ILIKE '%conta%' 
         OR chave ILIKE '%fornecedor%'
         OR chave ILIKE '%financeir%'
         OR chave ILIKE '%pagar%'
         OR chave ILIKE '%despesa%'
         OR chave ILIKE '%centro%'
         OR chave ILIKE '%plano%'
      ORDER BY chave;
    `);
    
    if (configs.length === 0) {
      console.log('  No matching configuration keys');
    } else {
      for (const c of configs) {
        console.log(`  ${c.chave}: ${c.valor?.substring(0, 200)}`);
      }
    }
  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 14. CHECK ENUM TYPES
  // ═══════════════════════════════════════════════════════════════════════════════
  header('14. ENUM TYPES');
  const { rows: enums } = await client.query(`
    SELECT t.typname, 
           array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname;
  `);
  
  for (const e of enums) {
    const vals = e.values.join(', ');
    console.log(`  ${e.typname}: [${vals}]`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(80));
  
  await client.end();
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(2); });
