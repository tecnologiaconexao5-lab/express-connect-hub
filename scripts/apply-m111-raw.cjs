const pg = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
  const migrationPath = path.join(__dirname, '..', 'supabase/migrations/20260713_m111_app_integracao_tms.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Method: Execute each ALTER TABLE / CREATE / DROP / GRANT / REVOKE as individual statements
  // but for function/trigger bodies use pragma-based approach
  // 
  // The key insight: pg.Client.query() with multiple statements needs to 
  // handle $$ quoting correctly. PostgreSQL natively does, but pg's parser
  // splits on ; which breaks dollar-quoted function bodies.
  //
  // Solution: Use pg's Executor with direct protocol access.
  // Alternative: use supabase client's rpc() approach.

  // Let's use the pg Client's query() method but handle the batching ourselves
  // by extracting function bodies properly.
  
  // Actually, the simplest approach is to execute the whole file as a single query
  // using the 'PG' client directly without the javascript driver splitting statements.
  // 
  // pg.Client.sendQuery can handle it, but the issue is the JS driver's parse().
  //
  // Let's try a different approach: use psql-like execution via supabase management API
  
  const https = require('https');
  
  // Supabase Management API approach
  const token = process.env.SUPABASE_ACCESS_TOKEN || '';
  if (!token) {
    console.log('No SUPABASE_ACCESS_TOKEN. Trying pg directly with raw query...');
    return await executeViaPG(connStr, sql);
  }
  
  await executeViaManagementAPI(token, sql);
}

async function executeViaPG(connStr, sql) {
  const { Client } = pg;
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected!');

  // Split by top-level blocks that start with CREATE/ALTER/DROP/GRANT/REVOKE
  // This is more reliable than splitting by ;
  const blocks = [];
  const lines = sql.split('\n');
  let current = [];
  let inDollar = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Track dollar-quoting
    if (trimmed.startsWith('$$') || trimmed.endsWith('$$') || trimmed.includes('$$')) {
      // Toggle state when we see $$
      const matches = trimmed.match(/\$\$/g);
      if (matches && matches.length % 2 === 1) {
        inDollar = !inDollar;
      }
    }
    
    current.push(line);
    
    // End block at ; when not in dollar quote, AND the line is the last of a statement
    if (!inDollar && trimmed.endsWith(';') && !trimmed.startsWith('--')) {
      blocks.push(current.join('\n'));
      current = [];
    }
  }
  
  // Handle remaining
  const remaining = current.join('\n').trim();
  if (remaining && !remaining.startsWith('--')) {
    blocks.push(remaining);
  }
  
  console.log(`Total blocks: ${blocks.length}`);
  
  let success = 0;
  let error = 0;
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block || block.startsWith('--')) continue;
    
    try {
      await client.query(block);
      success++;
    } catch (err) {
      const msg = err.message;
      if (msg.includes('already exists') || msg.includes('duplicate key') || msg.includes('duplicate_object')) {
        success++;
        continue;
      }
      console.log(`[${i}] ERR: ${msg.substring(0, 150)}`);
      console.log(`  SQL: ${block.substring(0, 100)}...`);
      error++;
    }
  }
  
  console.log(`\nDone: ${success} OK, ${error} errors`);
  
  // Verification
  console.log('\n=== VERIFICATION ===');
  const checks = [
    `SELECT '1. os_historico acao' c, count(*) i FROM information_schema.columns WHERE table_name='os_historico' AND column_name='acao'`,
    `SELECT '2. rotas os_id' c, count(*) i FROM information_schema.columns WHERE table_name='rotas' AND column_name='os_id'`,
    `SELECT '3. rotas operation_mode' c, count(*) i FROM information_schema.columns WHERE table_name='rotas' AND column_name='operation_mode'`,
    `SELECT '4. rota_paradas fotos' c, count(*) i FROM information_schema.columns WHERE table_name='rota_paradas' AND column_name='fotos'`,
    `SELECT '5. portal_notificacoes prestador_id' c, count(*) i FROM information_schema.columns WHERE table_name='portal_notificacoes' AND column_name='prestador_id'`,
    `SELECT '6. RPC f_aceitar_oportunidade_rede' c, count(*) i FROM pg_proc WHERE proname='f_aceitar_oportunidade_rede'`,
    `SELECT '7. RPC f_calcular_financeiro_operacao' c, count(*) i FROM pg_proc WHERE proname='f_calcular_financeiro_operacao'`,
    `SELECT '8. RPC f_buscar_operacoes_motorista' c, count(*) i FROM pg_proc WHERE proname='f_buscar_operacoes_motorista'`,
    `SELECT '9. RPC f_atualizar_status_parada' c, count(*) i FROM pg_proc WHERE proname='f_atualizar_status_parada'`,
    `SELECT '10. View vw_app_motorista_operacoes' c, count(*) i FROM pg_views WHERE viewname='vw_app_motorista_operacoes'`,
    `SELECT '11. View vw_app_motorista_paradas' c, count(*) i FROM pg_views WHERE viewname='vw_app_motorista_paradas'`,
    `SELECT '12. View vw_app_notificacoes_pendentes' c, count(*) i FROM pg_views WHERE viewname='vw_app_notificacoes_pendentes'`,
    `SELECT '13. Trigger trg_notificar_os_para_app' c, count(*) i FROM pg_trigger WHERE tgname='trg_notificar_os_para_app' AND NOT tgisinternal`,
    `SELECT '14. Trigger trg_notificar_oportunidade_rede' c, count(*) i FROM pg_trigger WHERE tgname='trg_notificar_oportunidade_rede' AND NOT tgisinternal`,
    `SELECT '15. Policy rotas_select_anon_suas' c, count(*) i FROM pg_policies WHERE policyname='rotas_select_anon_suas'`,
  ];
  
  for (const check of checks) {
    try {
      const r = await client.query(check);
      const row = r.rows[0];
      console.log(`${parseInt(row.i) > 0 ? '✅' : '❌'} ${row.c}: ${parseInt(row.i) > 0 ? 'OK' : 'NOT FOUND'}`);
    } catch(e) {
      console.log(`❌ ${check.substring(0, 50)}...: ${e.message.substring(0, 80)}`);
    }
  }
  
  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
