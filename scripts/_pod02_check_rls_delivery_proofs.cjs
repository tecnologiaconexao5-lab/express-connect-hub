require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();

  // 1. RLS status
  const rls = await c.query(
    "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'delivery_proofs'"
  );
  console.log('=== RLS STATUS ===');
  console.log(JSON.stringify(rls.rows));

  // 2. All policies
  const policies = await c.query(
    "SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'delivery_proofs'"
  );
  console.log('\n=== POLICIES ===');
  console.log(JSON.stringify(policies.rows, null, 2));

  // 3. GRANTs
  const grants = await c.query(
    "SELECT grantee, privilege_type, is_grantable FROM information_schema.role_table_grants WHERE table_name = 'delivery_proofs'"
  );
  console.log('\n=== GRANTS ===');
  console.log(JSON.stringify(grants.rows, null, 2));

  // 4. Triggers
  const triggers = await c.query(
    "SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_table = 'delivery_proofs'"
  );
  console.log('\n=== TRIGGERS ===');
  console.log(JSON.stringify(triggers.rows, null, 2));

  // 5. Permission checks
  try {
    const anonIns = await c.query("SELECT has_table_privilege('anon', 'public.delivery_proofs', 'INSERT')");
    console.log('\nanon INSERT:', anonIns.rows[0].has_table_privilege);
  } catch(e) { console.log('\nanon INSERT error:', e.message); }
  try {
    const authIns = await c.query("SELECT has_table_privilege('authenticated', 'public.delivery_proofs', 'INSERT')");
    console.log('authenticated INSERT:', authIns.rows[0].has_table_privilege);
  } catch(e) { console.log('authenticated INSERT error:', e.message); }
  try {
    const anonSel = await c.query("SELECT has_table_privilege('anon', 'public.delivery_proofs', 'SELECT')");
    console.log('anon SELECT:', anonSel.rows[0].has_table_privilege);
  } catch(e) { console.log('anon SELECT error:', e.message); }
  try {
    const authSel = await c.query("SELECT has_table_privilege('authenticated', 'public.delivery_proofs', 'SELECT')");
    console.log('authenticated SELECT:', authSel.rows[0].has_table_privilege);
  } catch(e) { console.log('authenticated SELECT error:', e.message); }

  // 6. Storage bucket policies for driver-evidence
  console.log('\n=== STORAGE: driver-evidence ===');
  try {
    const bucket = await c.query("SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'driver-evidence'");
    console.log('Bucket:', JSON.stringify(bucket.rows));
  } catch(e) { console.log('Bucket error:', e.message); }
  try {
    const storagePolicies = await c.query(
      "SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'"
    );
    const dePolicies = storagePolicies.rows.filter(p =>
      (p.qual && p.qual.includes('driver-evidence')) ||
      (p.with_check && p.with_check.includes('driver-evidence'))
    );
    console.log('driver-evidence policies:', JSON.stringify(dePolicies, null, 2));
  } catch(e) { console.log('Storage policies error:', e.message); }

  // 7. RPC f_atualizar_etapa_app (the actual RPC called by App)
  console.log('\n=== RPC: f_atualizar_etapa_app ===');
  try {
    const rpc = await c.query(
      "SELECT routine_name, data_type, security_type FROM information_schema.routines WHERE routine_name = 'f_atualizar_etapa_app'"
    );
    console.log('RPC exists:', JSON.stringify(rpc.rows));
  } catch(e) { console.log('RPC check error:', e.message); }
  
  // Also check f_avancar_etapa_app_motorista
  try {
    const rpc2 = await c.query(
      "SELECT routine_name, data_type, security_type FROM information_schema.routines WHERE routine_name = 'f_avancar_etapa_app_motorista'"
    );
    console.log('f_avancar_etapa_app_motorista:', JSON.stringify(rpc2.rows));
  } catch(e) { console.log('RPC2 check error:', e.message); }

  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
