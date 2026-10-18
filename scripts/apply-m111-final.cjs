const pg = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
  const migrationPath = path.join(__dirname, '..', 'supabase/migrations/20260713_m111_app_integracao_tms.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Execute in chunks using pg's ability to handle multiple statements
  // Split by empty lines that separate major blocks
  const sections = sql.split(/\n\n(?=-- ===|ALTER TABLE|CREATE OR REPLACE|CREATE INDEX|DROP|GRANT|REVOKE|DO |SELECT|COMMENT ON)/);
  
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Connected! ${sections.length} sections to process.\n`);
  
  let success = 0;
  let errors = [];

  for (let i = 0; i < sections.length; i++) {
    let block = sections[i].trim();
    if (!block || block.length < 5) continue;
    
    // Skip pure comment blocks
    if (block.replace(/^--.*$/gm, '').trim().length === 0) continue;
    
    // Strip leading comment lines to get to SQL
    const lines = block.split('\n');
    const sqlLines = lines.filter(l => !l.trim().startsWith('-- ') && !l.trim().startsWith('--='));
    block = sqlLines.join('\n').trim();
    if (!block) continue;

    try {
      await client.query(block);
      process.stdout.write('.');
      success++;
    } catch (err) {
      const msg = err.message;
      if (msg.includes('already exists') || msg.includes('duplicate key') || 
          msg.includes('duplicate_object') || msg.includes('must be owner of')) {
        process.stdout.write('s');
        success++;
        continue;
      }
      errors.push({ idx: i, msg: msg.substring(0, 200), sql: block.substring(0, 80) });
    }
  }

  console.log(`\n\nDone: ${success} executed, ${errors.length} errors.\n`);
  
  if (errors.length > 0) {
    console.log('=== ERRORS ===');
    errors.forEach(e => console.log(`  [${e.idx}] ${e.msg}\n    SQL: ${e.sql}`));
  }

  // Verification  
  console.log('\n=== VERIFICATION ===');
  const checks = [
    `SELECT 'os_historico.acao' q, count(*)::int c FROM information_schema.columns WHERE table_name='os_historico' AND column_name='acao'`,
    `SELECT 'rotas.os_id' q, count(*)::int c FROM information_schema.columns WHERE table_name='rotas' AND column_name='os_id'`,
    `SELECT 'rotas.operation_mode' q, count(*)::int c FROM information_schema.columns WHERE table_name='rotas' AND column_name='operation_mode'`,
    `SELECT 'rota_paradas.fotos' q, count(*)::int c FROM information_schema.columns WHERE table_name='rota_paradas' AND column_name='fotos'`,
    `SELECT 'notificacoes.prestador_id' q, count(*)::int c FROM information_schema.columns WHERE table_name='portal_notificacoes' AND column_name='prestador_id'`,
    `SELECT 'RPC aceitar_oportunidade' q, count(*)::int c FROM pg_proc WHERE proname='f_aceitar_oportunidade_rede'`,
    `SELECT 'RPC calcular_financeiro' q, count(*)::int c FROM pg_proc WHERE proname='f_calcular_financeiro_operacao'`,
    `SELECT 'RPC buscar_operacoes' q, count(*)::int c FROM pg_proc WHERE proname='f_buscar_operacoes_motorista'`,
    `SELECT 'RPC atualizar_parada' q, count(*)::int c FROM pg_proc WHERE proname='f_atualizar_status_parada'`,
    `SELECT 'View operacoes' q, count(*)::int c FROM pg_views WHERE viewname='vw_app_motorista_operacoes'`,
    `SELECT 'View paradas' q, count(*)::int c FROM pg_views WHERE viewname='vw_app_motorista_paradas'`,
    `SELECT 'View notificacoes' q, count(*)::int c FROM pg_views WHERE viewname='vw_app_notificacoes_pendentes'`,
    `SELECT 'Trigger notificar_os' q, count(*)::int c FROM pg_trigger WHERE tgname='trg_notificar_os_para_app' AND NOT tgisinternal`,
    `SELECT 'Trigger notificar_rede' q, count(*)::int c FROM pg_trigger WHERE tgname='trg_notificar_oportunidade_rede' AND NOT tgisinternal`,
    `SELECT 'Policy rotas_select_anon' q, count(*)::int c FROM pg_policies WHERE policyname='rotas_select_anon_suas'`,
  ];
  
  for (const check of checks) {
    try {
      const r = await client.query(check);
      const ok = parseInt(r.rows[0].c) > 0;
      console.log(`${ok ? '✅' : '❌'} ${r.rows[0].q}`);
    } catch(e) {
      console.log(`❌ ${check.substring(20, 60)}: ${e.message.substring(0, 60)}`);
    }
  }

  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
