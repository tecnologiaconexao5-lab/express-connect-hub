const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
  const migrationPath = path.join(__dirname, '..', 'supabase/migrations/20260713_m111_app_integracao_tms.sql');
  
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected!\n');

  // Read file content
  const fullSql = fs.readFileSync(migrationPath, 'utf8');

  // Strategy: pg's query() sends raw SQL to the backend.
  // The issue is pg's JS parser can't handle $$ quoting.
  // Solution: Use the 'simple' query protocol by specifying 
  // multi-statement mode.
  // 
  // Actually, let me try: pg.Client.query() with a single string
  // should work with multiple statements IF the string contains
  // only complete statements. The issue is that pg's parser wants 
  // to parameterize $1, $2 etc.
  //
  // The simplest fix: replace $$ with single quotes in a way that works?
  // No, that would break functions. 
  //
  // Let me try a different approach: execute statement by statement
  // using a simple ; split that respects $$ boundaries.

  // Find all top-level statements by matching the end pattern
  const statements = [];
  let currentStmt = '';
  let inDollarFn = false;
  let inDollarStr = false;

  for (const ch of fullSql) {
    currentStmt += ch;
    // Track if we're inside a dollar-quoted string
  }

  // Better approach: don't split at all. Execute the whole file
  // but remove all newlines and collapse into one string
  try {
    console.log('Sending full migration as single query...');
    // The pg module's query() function sends the query to PostgreSQL
    // using the simple query protocol. PostgreSQL handles multi-statement
    // natively. The issue is only with pg's internal parser that tries
    // to find parameters ($1, $2).
    // 
    // Testing this...
    await client.query(fullSql);
    console.log('✅ Full migration executed successfully!');
  } catch (err) {
    console.log(`❌ Error: ${err.message.substring(0, 200)}`);
    
    // Fallback: try individual ALTER TABLE first, then CREATE OR REPLACE
    console.log('\nTrying granular approach...');
    
    // Extract ALTER TABLE statements (these are safe to split on ;)
    const alterLines = fullSql.split('\n').filter(l => l.trim().startsWith('ALTER TABLE'));
    for (const line of alterLines) {
      const stmt = line.trim().endsWith(';') ? line.trim() : line.trim() + ';';
      try {
        await client.query(stmt);
        console.log(`  ✅ ${stmt.substring(0, 80)}`);
      } catch(e) {
        if (!e.message.includes('already exists')) {
          console.log(`  ⚠️ ${e.message.substring(0, 80)}`);
        }
      }
    }
    
    // For functions and views, use CREATE OR REPLACE
    const funcBlocks = fullSql.split(/(?=CREATE OR REPLACE|CREATE INDEX|DROP|GRANT|REVOKE|COMMENT ON)/);
    let idx = 0;
    for (const block of funcBlocks) {
      idx++;
      const sql = block.trim();
      if (!sql || sql.length < 10) continue;
      if (sql.startsWith('--')) continue;
      
      try {
        await client.query(sql);
        process.stdout.write('.');
      } catch(e) {
        if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
          console.log(`\n❌ Block ${idx}: ${e.message.substring(0, 100)}`);
        }
      }
    }
    console.log('\nGranular approach done.');
  }

  // Verification
  console.log('\n=== VERIFICATION ===');
  const checks = [
    `SELECT 'os_historico.os_id' FROM information_schema.columns WHERE table_name='os_historico' AND column_name='os_id'`,
    `SELECT 'rotas.operation_mode' FROM information_schema.columns WHERE table_name='rotas' AND column_name='operation_mode'`,
    `SELECT 'f_aceitar_oportunidade_rede' FROM pg_proc WHERE proname='f_aceitar_oportunidade_rede'`,
    `SELECT 'f_calcular_financeiro_operacao' FROM pg_proc WHERE proname='f_calcular_financeiro_operacao'`,
    `SELECT 'f_buscar_operacoes_motorista' FROM pg_proc WHERE proname='f_buscar_operacoes_motorista'`,
    `SELECT 'f_atualizar_status_parada' FROM pg_proc WHERE proname='f_atualizar_status_parada'`,
    `SELECT 'vw_app_motorista_operacoes' FROM pg_views WHERE viewname='vw_app_motorista_operacoes'`,
    `SELECT 'vw_app_motorista_paradas' FROM pg_views WHERE viewname='vw_app_motorista_paradas'`,
    `SELECT 'trg_notificar_os_para_app' FROM pg_trigger WHERE tgname='trg_notificar_os_para_app' AND NOT tgisinternal`,
    `SELECT 'trg_notificar_oportunidade_rede' FROM pg_trigger WHERE tgname='trg_notificar_oportunidade_rede' AND NOT tgisinternal`,
  ];
  
  for (const check of checks) {
    try {
      const r = await client.query(check);
      console.log(`${r.rows.length > 0 ? '✅' : '❌'} ${r.rows[0]?.column_name || r.rows[0]?.proname || check.match(/'([^']+)'/)?.[1] || '?'}`);
    } catch(e) {
      console.log(`❌ ${check.match(/'([^']+)'/)?.[1]}: ${e.message.substring(0, 60)}`);
    }
  }

  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
