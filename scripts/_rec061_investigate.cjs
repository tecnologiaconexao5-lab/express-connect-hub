const { Client } = require('pg');
const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  // 1. Check ALL FK constraints on recrutamento_candidatos
  const fks = await c.query(`
    SELECT 
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'recrutamento_candidatos'
    AND tc.table_schema = 'public'
  `);
  console.log('=== FK on recrutamento_candidatos ===');
  fks.rows.forEach(r => {
    console.log('  ' + r.constraint_name + ': ' + r.column_name + ' -> ' + r.foreign_table_name + '.' + r.foreign_column_name);
    console.log('    on_update=' + r.update_rule + ' on_delete=' + r.delete_rule);
  });

  // 2. Check ALL FK constraints on prestadores
  const fksP = await c.query(`
    SELECT 
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'prestadores'
    AND tc.table_schema = 'public'
  `);
  console.log('\n=== FK on prestadores ===');
  fksP.rows.forEach(r => {
    console.log('  ' + r.constraint_name + ': ' + r.column_name + ' -> ' + r.foreign_table_name + '.' + r.foreign_column_name);
    console.log('    on_update=' + r.update_rule + ' on_delete=' + r.delete_rule);
  });

  // 3. Try a manual insert into recrutamento_candidatos with a fake prestador_id
  const fakeId = '00000000-0000-4000-8000-000000000099';
  try {
    await c.query(`
      INSERT INTO public.recrutamento_candidatos (nome, stage, prestador_id, data_entrada, created_at, updated_at)
      VALUES ('FK Test', 'novo_cadastro', '${fakeId}', '2026-01-01', NOW(), NOW())
    `);
    console.log('\nFK test: INSERT succeeded (FK NOT enforced or prestador exists)');
    await c.query(`DELETE FROM public.recrutamento_candidatos WHERE prestador_id = '${fakeId}'`);
  } catch (e) {
    console.log('\nFK test: INSERT failed —', e.message.substring(0, 120));
  }

  // 4. Check if prestador T1 exists
  const t1 = await c.query(`SELECT id, nome_completo FROM public.prestadores WHERE id = '00000000-0000-4000-8000-000000000001'`);
  console.log('\nPrestador T1 exists:', t1.rows.length > 0);
  if (t1.rows.length > 0) console.log('  nome:', t1.rows[0].nome_completo);

  // 5. Check if trigger function has any compilation errors
  const funcCheck = await c.query(`
    SELECT p.prosrc, p.proacl, p.proowner::regrole::text as owner
    FROM pg_proc p
    WHERE p.proname = 'f_bridge_prestador_para_recrutamento'
  `);
  console.log('\n=== Trigger function details ===');
  if (funcCheck.rows.length > 0) {
    console.log('  Owner:', funcCheck.rows[0].owner);
    console.log('  ACL:', funcCheck.rows[0].proacl);
    console.log('  Source length:', funcCheck.rows[0].prosrc?.length || 0);
    // Check first 200 chars
    console.log('  Source start:', funcCheck.rows[0].prosrc?.substring(0, 200));
  }

  // 6. Test the trigger manually with a real insert
  console.log('\n=== Manual trigger test ===');
  const testId = '00000000-0000-4000-8000-000000000099';
  await c.query(`DELETE FROM public.recrutamento_candidatos WHERE prestador_id = '${testId}'`);
  await c.query(`DELETE FROM public.prestadores WHERE id = '${testId}'`);

  try {
    await c.query(`
      INSERT INTO public.prestadores (
        id, nome_completo, cpf_cnpj, telefone, status, liberado_app,
        origem, origem_cadastro, created_at, updated_at
      ) VALUES (
        '${testId}', 'Manual Trigger Test', '11111111111', '11000000000',
        'em_analise', false, 'app_prestador', 'app_motorista',
        NOW(), NOW()
      )
    `);
    console.log('  Prestador inserted OK');

    const rc = await c.query(`SELECT * FROM public.recrutamento_candidatos WHERE prestador_id = '${testId}'`);
    console.log('  Candidato found:', rc.rows.length);
    if (rc.rows.length > 0) {
      console.log('    stage:', rc.rows[0].stage);
      console.log('    nome:', rc.rows[0].nome);
    }
  } catch (e) {
    console.log('  ERROR:', e.message.substring(0, 200));
  }

  // Cleanup
  await c.query(`DELETE FROM public.recrutamento_candidatos WHERE prestador_id = '${testId}'`);
  await c.query(`DELETE FROM public.prestadores WHERE id = '${testId}'`);

  await c.end();
  console.log('\n=== INVESTIGATION COMPLETE ===');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
