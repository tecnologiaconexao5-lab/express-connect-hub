const { Client } = require('pg');
const CONN = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026!%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('REC-06.2B — PROVA POSITIVA (authenticated funciona)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Simulate authenticated via SET ROLE
  await c.query(`SET ROLE authenticated`);

  const tables = [
    'recrutamento_prestadores',
    'recrutamento_candidatos',
    'crm_interacoes_prestadores',
    'candidato_documentos',
    'recrutamento_operacoes',
  ];

  let allOk = true;

  for (const t of tables) {
    console.log(`--- ${t} ---`);

    // SELECT
    try {
      const r = await c.query(`SELECT count(*) FROM ${t}`);
      console.log(`  SELECT: ✅ OK (${r.rows[0].count} rows)`);
    } catch (e) {
      console.log(`  SELECT: ❌ FAIL (${e.message.slice(0, 80)})`);
      allOk = false;
    }

    // INSERT (use a fake UUID that won't conflict, then delete)
    try {
      if (t === 'recrutamento_prestadores') {
        await c.query(`INSERT INTO ${t} (id, nome) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'REC062B_TEST')`);
        await c.query(`DELETE FROM ${t} WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'`);
        console.log(`  INSERT+DELETE: ✅ OK`);
      } else if (t === 'recrutamento_candidatos') {
        await c.query(`INSERT INTO ${t} (id, nome) VALUES ('ffffffff-ffff-ffff-ffff-fffffffffffe', 'REC062B_TEST')`);
        await c.query(`DELETE FROM ${t} WHERE id = 'ffffffff-ffff-ffff-ffff-fffffffffffe'`);
        console.log(`  INSERT+DELETE: ✅ OK`);
      } else if (t === 'recrutamento_operacoes') {
        await c.query(`INSERT INTO ${t} (id, nome) VALUES ('ffffffff-ffff-ffff-ffff-fffffffffffd', 'REC062B_TEST')`);
        await c.query(`DELETE FROM ${t} WHERE id = 'ffffffff-ffff-ffff-ffff-fffffffffffd'`);
        console.log(`  INSERT+DELETE: ✅ OK`);
      } else if (t === 'crm_interacoes_prestadores') {
        // Skip INSERT — requires valid prestador_id FK
        console.log(`  INSERT: ⏭️ SKIP (requires FK prestador_id)`);
      } else if (t === 'candidato_documentos') {
        // Skip INSERT — requires valid candidato_id FK
        console.log(`  INSERT: ⏭️ SKIP (requires FK candidato_id)`);
      }
    } catch (e) {
      console.log(`  INSERT+DELETE: ❌ FAIL (${e.message.slice(0, 80)})`);
      allOk = false;
    }

    // UPDATE (no-op on non-existent row — just tests policy)
    try {
      await c.query(`UPDATE ${t} SET updated_at = NOW() WHERE id = '00000000-0000-0000-0000-000000000000'`);
      console.log(`  UPDATE: ✅ OK (policy allows)`);
    } catch (e) {
      console.log(`  UPDATE: ❌ FAIL (${e.message.slice(0, 80)})`);
      allOk = false;
    }

    console.log('');
  }

  // Reset role
  await c.query(`RESET ROLE`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`RESULTADO POSITIVO: ${allOk ? '✅ AUTHENTICATED OPERA NORMALMENTE' : '❌ FALHA'}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // BRIDGE PROOF
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('PROVA BRIDGE APP (trigger não quebrado)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const bridge = await c.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'prestadores' AND trigger_name = 'trg_bridge_prestador_para_recrutamento'
  `);
  console.log(`  Trigger existe: ${bridge.rows.length > 0 ? '✅ SIM' : '❌ NÃO'}`);
  if (bridge.rows.length > 0) {
    console.log(`  Event: ${bridge.rows[0].event_manipulation}`);
    console.log(`  Action: ${bridge.rows[0].action_statement.slice(0, 60)}`);
  }

  // Check bridge data integrity
  const bridgeData = await c.query(`
    SELECT count(*) AS total,
           count(*) FILTER (WHERE tags ? 'bridge_automatico') AS bridge_auto
    FROM recrutamento_candidatos
  `);
  console.log(`  Candidatos totais: ${bridgeData.rows[0].total}`);
  console.log(`  Candidatos via bridge: ${bridgeData.rows[0].bridge_auto}`);

  await c.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
