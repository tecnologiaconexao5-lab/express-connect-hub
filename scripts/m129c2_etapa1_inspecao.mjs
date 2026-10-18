// ETAPA 1 — Inspecionar estado anterior da tabela reembolsos_prestador
import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres'
});

try {
  await client.connect();

  // 1. Table columns
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reembolsos_prestador'
    ORDER BY ordinal_position
  `);
  console.log('=== COLUNAS ===');
  if (cols.rows.length === 0) {
    console.log('  TABELA NAO EXISTE');
  } else {
    cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} nullable=${r.is_nullable} default=${r.column_default || 'none'}`));
  }

  // 2. Triggers
  const trg = await client.query(`
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE event_object_schema = 'public' AND event_object_table = 'reembolsos_prestador'
  `);
  console.log('\n=== TRIGGERS ===');
  if (trg.rows.length === 0) {
    console.log('  (nenhum trigger)');
  } else {
    trg.rows.forEach(r => console.log(`  ${r.trigger_name}: ${r.action_timing} ${r.event_manipulation}`));
  }

  // 3. Functions
  const funcs = await client.query(`
    SELECT p.proname, p.prorettype::regtype AS return_type,
           p.prokind, p. prosrc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('f_obter_prestador_por_auth', 'trg_f_derivar_reembolso_prestador', 'update_reembolsos_prestador_updated_at')
  `);
  console.log('\n=== FUNCOES ===');
  if (funcs.rows.length === 0) {
    console.log('  (nenhuma funcao relacionada)');
  } else {
    funcs.rows.forEach(r => console.log(`  ${r.proname} (${r.return_type}) kind=${r.prokind}`));
  }

  // 4. Policies
  const pol = await client.query(`
    SELECT pol.polname,
      CASE pol.polcmd
        WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
        ELSE pol.polcmd::text
      END AS cmd,
      pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
      pg_get_expr(pol.polwithcheck, pol.polrelid) AS withcheck_expr
    FROM pg_policy pol
    JOIN pg_class cl ON cl.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public' AND cl.relname = 'reembolsos_prestador'
  `);
  console.log('\n=== POLICIES ===');
  if (pol.rows.length === 0) {
    console.log('  (nenhuma policy)');
  } else {
    pol.rows.forEach(r => console.log(`  ${r.polname}: ${r.cmd}`));
    pol.rows.forEach(r => {
      if (r.using_expr) console.log(`    USING: ${r.using_expr}`);
      if (r.withcheck_expr) console.log(`    WITH CHECK: ${r.withcheck_expr}`);
    });
  }

  // 5. Grants
  const gr = await client.query(`
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'reembolsos_prestador'
    ORDER BY grantee, privilege_type
  `);
  console.log('\n=== GRANTS ===');
  if (gr.rows.length === 0) {
    console.log('  (nenhum grant)');
  } else {
    gr.rows.forEach(r => console.log(`  GRANT ${r.privilege_type} TO ${r.grantee}`));
  }

  // 6. RLS enabled
  const rls = await client.query(`
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relname = 'reembolsos_prestador'
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  `);
  console.log('\n=== RLS ===');
  console.log(`  RLS enabled: ${rls.rows[0]?.relrowsecurity === true ? 'YES' : 'NO'}`);

  await client.end();
  console.log('\nInspecao concluida.');
} catch(e) {
  console.error('ERRO:', e.message);
  process.exit(1);
}
