require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();

  // 1. Check what RPC the App actually calls
  console.log('=== RPC: f_atualizar_etapa_app ===');
  const r1 = await c.query(`
    SELECT routine_name, security_type, data_type, is_deterministic
    FROM information_schema.routines 
    WHERE routine_name = 'f_atualizar_etapa_app'
  `);
  console.log(JSON.stringify(r1.rows, null, 2));

  // Get function definition
  const def1 = await c.query(`
    SELECT pg_get_functiondef(oid) as definition FROM pg_proc WHERE proname = 'f_atualizar_etapa_app'
  `);
  if (def1.rows.length > 0) {
    const d = def1.rows[0].definition;
    console.log('\nDefinition length:', d.length);
    console.log('Writes to delivery_proofs:', d.includes('delivery_proofs'));
    console.log('Sets concluida:', d.includes('concluida'));
    console.log('Sets pod_registrado:', d.includes('pod_registrado'));
    console.log('Sets servico_finalizado:', d.includes('servico_finalizado'));
    // Show the full function
    console.log('\n--- FULL DEFINITION ---');
    console.log(d);
  }

  // 2. Check f_avancar_etapa_app_motorista
  console.log('\n=== RPC: f_avancar_etapa_app_motorista ===');
  const r2 = await c.query(`
    SELECT routine_name, security_type, data_type, is_deterministic
    FROM information_schema.routines 
    WHERE routine_name = 'f_avancar_etapa_app_motorista'
  `);
  console.log(JSON.stringify(r2.rows, null, 2));

  const def2 = await c.query(`
    SELECT pg_get_functiondef(oid) as definition FROM pg_proc WHERE proname = 'f_avancar_etapa_app_motorista'
  `);
  if (def2.rows.length > 0) {
    const d = def2.rows[0].definition;
    console.log('\nDefinition length:', d.length);
    console.log('Writes to delivery_proofs:', d.includes('delivery_proofs'));
    console.log('Sets concluida:', d.includes('concluida'));
    console.log('Sets pod_registrado:', d.includes('pod_registrado'));
    console.log('Sets servico_finalizado:', d.includes('servico_finalizado'));
  }

  // 3. Check if there's any function that creates delivery_proofs
  console.log('\n=== FUNCTIONS REFERENCING delivery_proofs ===');
  const r3 = await c.query(`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_definition LIKE '%delivery_proofs%'
  `);
  console.log(JSON.stringify(r3.rows));

  // 4. Check the trigger function
  console.log('\n=== TRIGGER FUNCTION: f_sync_delivery_proof_to_entregas ===');
  const r4 = await c.query(`
    SELECT pg_get_functiondef(oid) as definition FROM pg_proc WHERE proname = 'f_sync_delivery_proof_to_entregas'
  `);
  if (r4.rows.length > 0) {
    console.log(r4.rows[0].definition);
  }

  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
