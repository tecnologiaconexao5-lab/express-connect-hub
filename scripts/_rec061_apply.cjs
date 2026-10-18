const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260902_rec061_bridge_prestador_recrutamento.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('=== PRE-FLIGHT ===');

  // 1. Check if trigger already exists
  const trigCheck = await c.query(`
    SELECT trigger_name FROM information_schema.triggers
    WHERE trigger_name = 'trg_bridge_prestador_para_recrutamento'
    AND event_object_table = 'prestadores'
  `);
  console.log('Trigger exists before:', trigCheck.rows.length > 0);

  // 2. Check if function already exists
  const funcCheck = await c.query(`
    SELECT routine_name FROM information_schema.routines
    WHERE routine_name = 'f_bridge_prestador_para_recrutamento'
    AND routine_schema = 'public'
  `);
  console.log('Function exists before:', funcCheck.rows.length > 0);

  // 3. Count prestadores that will be affected
  const affectedPrest = await c.query(`
    SELECT COUNT(*) as cnt FROM public.prestadores
    WHERE origem = 'app_prestador' OR origem_cadastro = 'app_motorista'
  `);
  console.log('Prestadores with app origin:', affectedPrest.rows[0].cnt);

  // 4. Check how many already have candidatos
  const alreadyLinked = await c.query(`
    SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos
    WHERE prestador_id IN (
      SELECT id FROM public.prestadores
      WHERE origem = 'app_prestador' OR origem_cadastro = 'app_motorista'
    )
  `);
  console.log('Already have candidato:', alreadyLinked.rows[0].cnt);

  // 5. Count ia_logs before
  const logsBefore = await c.query(`SELECT COUNT(*) as cnt FROM public.ia_logs`);
  console.log('ia_logs count before:', logsBefore.rows[0].cnt);

  console.log('\n=== APPLYING MIGRATION ===');
  try {
    await c.query('BEGIN');
    await c.query(sql);
    await c.query('COMMIT');
    console.log('Migration applied successfully');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('Migration FAILED:', e.message);
    process.exit(1);
  }

  console.log('\n=== POST-FLIGHT ===');

  // 6. Verify function exists
  const funcAfter = await c.query(`
    SELECT routine_name, security_type
    FROM information_schema.routines
    WHERE routine_name = 'f_bridge_prestador_para_recrutamento'
  `);
  console.log('Function created:', funcAfter.rows.length > 0);
  if (funcAfter.rows.length > 0) {
    console.log('  Security type:', funcAfter.rows[0].security_type);
  }

  // 7. Verify trigger exists
  const trigAfter = await c.query(`
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE trigger_name = 'trg_bridge_prestador_para_recrutamento'
  `);
  console.log('Trigger created:', trigAfter.rows.length > 0);
  if (trigAfter.rows.length > 0) {
    console.log('  Event:', trigAfter.rows[0].event_manipulation);
    console.log('  Timing:', trigAfter.rows[0].action_timing);
  }

  // 8. Count recrutamento_candidatos after
  const rcAfter = await c.query(`SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos`);
  console.log('recrutamento_candidatos count after:', rcAfter.rows[0].cnt);

  // 9. Count ia_logs after
  const logsAfter = await c.query(`SELECT COUNT(*) as cnt FROM public.ia_logs`);
  console.log('ia_logs count after:', logsAfter.rows[0].cnt);

  // 10. Check if the existing app prestador now has a candidato
  const teste2Link = await c.query(`
    SELECT rc.id, rc.nome, rc.stage, rc.prestador_id
    FROM public.recrutamento_candidatos rc
    WHERE rc.prestador_id = '0b55f471-b8eb-419a-bda1-567ec3b37a39'
  `);
  console.log('\n=== IDEMPOTENCY TEST (existing prestador "teste 2") ===');
  console.log('Candidatos found for teste 2:', teste2Link.rows.length);
  // Should be 0 — trigger only fires on INSERT, not retroactive

  await c.end();
  console.log('\n=== APPLICATION COMPLETE ===');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
