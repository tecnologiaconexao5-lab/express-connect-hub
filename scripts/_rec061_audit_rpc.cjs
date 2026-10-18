const { Client } = require('pg');

const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  // 1. Get the full definition of app_s6_criar_prestador
  const func = await c.query(`
    SELECT routine_name, routine_definition, data_type
    FROM information_schema.routines
    WHERE routine_name = 'app_s6_criar_prestador'
    AND routine_schema = 'public'
  `);
  console.log('=== app_s6_criar_prestador ===');
  if (func.rows.length > 0) {
    console.log('Return type:', func.rows[0].data_type);
    console.log('Definition:');
    console.log(func.rows[0].routine_definition);
  } else {
    console.log('NOT FOUND');
  }

  // 2. Get f_obter_prestador_por_auth
  const func2 = await c.query(`
    SELECT routine_name, routine_definition, data_type
    FROM information_schema.routines
    WHERE routine_name = 'f_obter_prestador_por_auth'
    AND routine_schema = 'public'
  `);
  console.log('\n=== f_obter_prestador_por_auth ===');
  if (func2.rows.length > 0) {
    console.log('Return type:', func2.rows[0].data_type);
    console.log('Definition:');
    console.log(func2.rows[0].routine_definition);
  } else {
    console.log('NOT FOUND');
  }

  // 3. Check ALL prestadores (count + sample)
  const allPrest = await c.query(`
    SELECT COUNT(*) as cnt,
           COUNT(CASE WHEN origem = 'app_prestador' THEN 1 END) as app_count,
           COUNT(CASE WHEN auth_user_id IS NOT NULL THEN 1 END) as with_auth,
           COUNT(CASE WHEN liberado_app = true THEN 1 END) as liberados,
           COUNT(CASE WHEN status = 'ativo' THEN 1 END) as ativos
    FROM public.prestadores
  `);
  console.log('\n=== prestadores stats ===');
  console.log('Total:', allPrest.rows[0].cnt);
  console.log('App origin:', allPrest.rows[0].app_count);
  console.log('With auth_user_id:', allPrest.rows[0].with_auth);
  console.log('liberado_app=true:', allPrest.rows[0].liberados);
  console.log('status=ativo:', allPrest.rows[0].ativos);

  // 4. Check ALL recrutamento_candidatos stats
  const allRC = await c.query(`
    SELECT COUNT(*) as cnt,
           COUNT(CASE WHEN prestador_id IS NOT NULL THEN 1 END) as with_prestador,
           COUNT(CASE WHEN stage = 'novo_cadastro' THEN 1 END) as novos,
           COUNT(CASE WHEN stage = 'ativo' THEN 1 END) as ativos,
           COUNT(CASE WHEN stage = 'documentacao' THEN 1 END) as docs
    FROM public.recrutamento_candidatos
  `);
  console.log('\n=== recrutamento_candidatos stats ===');
  console.log('Total:', allRC.rows[0].cnt);
  console.log('With prestador_id:', allRC.rows[0].with_prestador);
  console.log('Stage novo_cadastro:', allRC.rows[0].novos);
  console.log('Stage ativo:', allRC.rows[0].ativos);
  console.log('Stage documentacao:', allRC.rows[0].docs);

  // 5. Prestador "teste 2" — check if it has ANY recrutamento_candidatos link
  const teste2 = await c.query(`
    SELECT rc.id, rc.nome, rc.stage, rc.prestador_id
    FROM public.recrutamento_candidatos rc
    WHERE rc.prestador_id = '0b55f471-b8eb-419a-bda1-567ec3b37a39'
  `);
  console.log('\n=== teste 2 → recrutamento_candidatos ===');
  console.log('Found:', teste2.rows.length);
  teste2.rows.forEach(r => console.log('  ', r));

  // 6. Check if there's a UNIQUE constraint on recrutamento_candidatos
  const uniqueConstraints = await c.query(`
    SELECT tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
    AND tc.table_name = 'recrutamento_candidatos'
    AND tc.table_schema = 'public'
  `);
  console.log('\n=== recrutamento_candidatos UNIQUE constraints ===');
  uniqueConstraints.rows.forEach(r => console.log('  ' + r.constraint_name + ': ' + r.column_name));

  await c.end();
  console.log('\n=== AUDIT COMPLETE ===');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
