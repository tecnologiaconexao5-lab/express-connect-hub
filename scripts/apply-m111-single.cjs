const pg = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
  
  // Method 1: Use pg with ssl
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected!\n');

  const migrationPath = path.join(__dirname, '..', 'supabase/migrations/20260713_m111_app_integracao_tms.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split into top-level blocks by looking for CREATE/ALTER/DROP/etc at start of line
  // But preserve dollar-quoted function bodies
  const lines = sql.split('\n');
  const blocks = [];
  let currentBlock = [];
  let inDollarQuote = false;

  for (const line of lines) {
    currentBlock.push(line);
    
    // Track dollar-quote state
    if (line.includes('$$') && !inDollarQuote) {
      inDollarQuote = true;
      // Could be the opening $$
      if (line.trimEnd().endsWith('$$')) {
        inDollarQuote = false;
      }
    } else if (line.includes('$$') && inDollarQuote) {
      inDollarQuote = false;
    }

    // If not in dollar quote and we hit a semicolon, end the block
    if (!inDollarQuote && line.trim().endsWith(';')) {
      blocks.push(currentBlock.join('\n'));
      currentBlock = [];
    }
  }

  // Push any remaining content
  if (currentBlock.length > 0) {
    const remaining = currentBlock.join('\n').trim();
    if (remaining) {
      blocks.push(remaining);
    }
  }

  console.log(`Total statements to execute: ${blocks.length}`);
  
  let success = 0;
  let errors = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block || block.startsWith('--')) continue;

    try {
      await client.query(block);
      process.stdout.write('.');
      success++;
    } catch (err) {
      const msg = err.message;
      if (msg.includes('already exists') || msg.includes('duplicate key') || msg.includes('duplicate_object')) {
        process.stdout.write('s');
        success++;
        continue;
      }
      console.log(`\n[${i}] ERROR: ${msg.substring(0, 200)}`);
      console.log(`  SQL: ${block.substring(0, 120)}...`);
      errors++;
    }
  }

  console.log(`\n\nDone! ${success} OK, ${errors} errors.`);
  
  // Verify the migration
  console.log('\n=== VERIFICATION ===');
  const checks = [
    `SELECT '1. os_historico os_id' AS check_name, COUNT(*) FROM information_schema.columns WHERE table_name='os_historico' AND column_name='os_id'`,
    `SELECT '2. rotas os_id' AS check_name, COUNT(*) FROM information_schema.columns WHERE table_name='rotas' AND column_name='os_id'`,
    `SELECT '3. rotas operation_mode' AS check_name, COUNT(*) FROM information_schema.columns WHERE table_name='rotas' AND column_name='operation_mode'`,
    `SELECT '4. rota_paradas os_id' AS check_name, COUNT(*) FROM information_schema.columns WHERE table_name='rota_paradas' AND column_name='os_id'`,
    `SELECT '5. rota_paradas fotos' AS check_name, COUNT(*) FROM information_schema.columns WHERE table_name='rota_paradas' AND column_name='fotos'`,
    `SELECT '6. portal_notificacoes prestador_id' AS check_name, COUNT(*) FROM information_schema.columns WHERE table_name='portal_notificacoes' AND column_name='prestador_id'`,
    `SELECT '7. RPC f_aceitar_oportunidade_rede' AS check_name, COUNT(*) FROM pg_proc WHERE proname='f_aceitar_oportunidade_rede' AND pronamespace='public'::regnamespace`,
    `SELECT '8. RPC f_calcular_financeiro_operacao' AS check_name, COUNT(*) FROM pg_proc WHERE proname='f_calcular_financeiro_operacao'`,
    `SELECT '9. RPC f_buscar_operacoes_motorista' AS check_name, COUNT(*) FROM pg_proc WHERE proname='f_buscar_operacoes_motorista'`,
    `SELECT '10. RPC f_atualizar_status_parada' AS check_name, COUNT(*) FROM pg_proc WHERE proname='f_atualizar_status_parada'`,
    `SELECT '11. View vw_app_motorista_operacoes' AS check_name, COUNT(*) FROM pg_views WHERE viewname='vw_app_motorista_operacoes'`,
    `SELECT '12. View vw_app_motorista_paradas' AS check_name, COUNT(*) FROM pg_views WHERE viewname='vw_app_motorista_paradas'`,
    `SELECT '13. Index idx_rotas_os_id' AS check_name, COUNT(*) FROM pg_indexes WHERE indexname='idx_rotas_os_id'`,
    `SELECT '14. Index idx_rotas_operation_mode' AS check_name, COUNT(*) FROM pg_indexes WHERE indexname='idx_rotas_operation_mode'`,
    `SELECT '15. Trigger trg_notificar_os_para_app' AS check_name, COUNT(*) FROM pg_trigger WHERE tgname='trg_notificar_os_para_app' AND NOT tgisinternal`,
    `SELECT '16. Trigger trg_notificar_oportunidade_rede' AS check_name, COUNT(*) FROM pg_trigger WHERE tgname='trg_notificar_oportunidade_rede' AND NOT tgisinternal`,
    `SELECT '17. Policy rotas_select_anon_suas' AS check_name, COUNT(*) FROM pg_policies WHERE policyname='rotas_select_anon_suas'`,
  ];
  
  for (const check of checks) {
    try {
      const r = await client.query(check);
      const name = r.rows[0].check_name;
      const count = parseInt(r.rows[0].count);
      console.log(`${count > 0 ? '✅' : '❌'} ${name}: ${count > 0 ? 'OK' : 'NOT FOUND'}`);
    } catch(e) {
      const nameMatch = check.match(/'(.*?)'/);
      const name = nameMatch ? nameMatch[1] : '?';
      console.log(`❌ ${name}: ERROR - ${e.message.substring(0, 100)}`);
    }
  }

  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
