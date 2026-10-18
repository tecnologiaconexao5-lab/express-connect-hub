import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

await client.connect();

console.log('=== TRIGGERS ===');
const trg = await client.query(`
  SELECT trigger_name, event_manipulation, action_timing, action_orientation, action_statement
  FROM information_schema.triggers
  WHERE event_object_schema = 'public' AND event_object_table = 'reembolsos_prestador'
`);
trg.rows.forEach(r => console.log(`  ${r.trigger_name}: ${r.action_timing} ${r.event_manipulation} [${r.action_orientation}]`));

console.log('\n=== FUNCOES NOVAS ===');
const funcs = await client.query(`
  SELECT p.proname, p.prorettype::regtype AS return_type, p.prosecdef AS security_definer,
         l.lanname AS language
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.proname IN ('f_obter_prestador_por_auth', 'trg_f_derivar_reembolso_prestador')
`);
funcs.rows.forEach(r => console.log(`  ${r.proname} (${r.return_type}) SECURITY_DEFINER=${r.security_definer} lang=${r.language}`));

console.log('\n=== GRANTS ===');
const gr = await client.query(`
  SELECT grantee, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'reembolsos_prestador'
  ORDER BY grantee, privilege_type
`);
gr.rows.forEach(r => console.log(`  GRANT ${r.privilege_type} TO ${r.grantee}`));

console.log('\n=== RLS ===');
const rls = await client.query(`
  SELECT relrowsecurity FROM pg_class
  WHERE relname = 'reembolsos_prestador'
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
`);
console.log(`  RLS enabled: ${rls.rows[0]?.relrowsecurity === true ? 'YES' : 'NO'}`);

console.log('\n=== TRIGGER HABILITADO? ===');
const tg = await client.query(`
  SELECT tgname, tgenabled FROM pg_trigger
  WHERE tgrelid = 'public.reembolsos_prestador'::regclass
    AND tgname = 'trg_rp_derivar_prestador'
`);
tg.rows.forEach(r => {
  const status = r.tgenabled === 'O' ? 'ENABLED' : r.tgenabled;
  console.log(`  ${r.tgname}: ${status}`);
});

await client.end();
console.log('\nVerificacao concluida.');
