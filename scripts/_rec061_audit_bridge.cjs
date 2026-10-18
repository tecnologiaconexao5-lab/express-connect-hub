const { Client } = require('pg');

const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  // 1. Find all RPCs that touch prestadores
  const rpcs = await c.query(`
    SELECT routine_name, routine_type 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND (routine_name LIKE '%prestador%' OR routine_name LIKE '%cadastrar%' OR routine_name LIKE '%bridge%' OR routine_name LIKE '%recrutamento%')
    ORDER BY routine_name
  `);
  console.log('=== RPCs related to prestador/cadastro/bridge/recrutamento ===');
  rpcs.rows.forEach(r => console.log('  ' + r.routine_name + ' (' + r.routine_type + ')'));

  // 2. Check for triggers on prestadores table
  const triggers = await c.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'prestadores'
    AND event_object_schema = 'public'
  `);
  console.log('\n=== Triggers on prestadores ===');
  triggers.rows.forEach(r => console.log('  ' + r.trigger_name + ' (' + r.event_manipulation + ')'));

  // 3. Check for triggers on recrutamento_candidatos
  const rcTriggers = await c.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'recrutamento_candidatos'
    AND event_object_schema = 'public'
  `);
  console.log('\n=== Triggers on recrutamento_candidatos ===');
  rcTriggers.rows.forEach(r => console.log('  ' + r.trigger_name + ' (' + r.event_manipulation + ')'));

  // 4. Check for triggers on auth.users
  const authTriggers = await c.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'users'
    AND event_object_schema = 'auth'
  `);
  console.log('\n=== Triggers on auth.users ===');
  authTriggers.rows.forEach(r => console.log('  ' + r.trigger_name + ' (' + r.event_manipulation + ')'));

  // 5. Check prestadores with origem app
  const appPrest = await c.query(`
    SELECT id, nome_completo, status, liberado_app, origem, origem_cadastro, auth_user_id, created_at
    FROM public.prestadores
    WHERE origem = 'app_prestador' OR origem_cadastro LIKE '%app%' OR origem_cadastro LIKE '%motorista%'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log('\n=== Prestadores with app origin ===');
  console.log('Count:', appPrest.rows.length);
  appPrest.rows.forEach(r => {
    console.log('  ID:', r.id);
    console.log('  Nome:', r.nome_completo);
    console.log('  Status:', r.status, '| liberado_app:', r.liberado_app);
    console.log('  origem:', r.origem, '| origem_cadastro:', r.origem_cadastro);
    console.log('  auth_user_id:', r.auth_user_id);
    console.log('  ---');
  });

  // 6. Check recrutamento_candidatos linked to prestadores
  const linkedRC = await c.query(`
    SELECT rc.id, rc.nome, rc.stage, rc.prestador_id, rc.created_at
    FROM public.recrutamento_candidatos rc
    WHERE rc.prestador_id IS NOT NULL
    ORDER BY rc.created_at DESC
    LIMIT 10
  `);
  console.log('\n=== recrutamento_candidatos with prestador_id ===');
  console.log('Count:', linkedRC.rows.length);
  linkedRC.rows.forEach(r => {
    console.log('  ID:', r.id, '| Nome:', r.nome, '| Stage:', r.stage, '| prestador_id:', r.prestador_id);
  });

  // 7. Check recrutamento_candidatos WITHOUT prestador_id (orphan pipeline entries)
  const orphanRC = await c.query(`
    SELECT COUNT(*) as cnt FROM public.recrutamento_candidatos WHERE prestador_id IS NULL
  `);
  console.log('\n=== recrutamento_candidatos WITHOUT prestador_id ===', orphanRC.rows[0].cnt);

  // 8. Check if there's a view or function that bridges prestadores → recrutamento_candidatos
  const views = await c.query(`
    SELECT table_name FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%prestador%' OR table_name LIKE '%recrutamento%' OR table_name LIKE '%bridge%')
  `);
  console.log('\n=== Views prestador/recrutamento ===');
  views.rows.forEach(r => console.log('  ' + r.table_name));

  await c.end();
  console.log('\n=== AUDIT COMPLETE ===');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
