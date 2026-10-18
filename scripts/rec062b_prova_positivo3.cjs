const { Client } = require('pg');
const CONN = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026!%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('REC-06.2B — PROVA POSITIVA (postgres = tabelas funcionais)');
  console.log('═══════════════════════════════════════════════════════════════\n');

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

    // UPDATE (no-op)
    try {
      await c.query(`UPDATE ${t} SET updated_at = NOW() WHERE id = '00000000-0000-0000-0000-000000000000'`);
      console.log(`  UPDATE: ✅ OK`);
    } catch (e) {
      console.log(`  UPDATE: ❌ FAIL (${e.message.slice(0, 80)})`);
      allOk = false;
    }

    console.log('');
  }

  // INSERT+DELETE roundtrip on recrutamento_prestadores
  console.log('--- INSERT+DELETE roundtrip (recrutamento_prestadores) ---');
  const testId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  try {
    await c.query(`INSERT INTO recrutamento_prestadores (id, nome) VALUES ($1, $2)`, [testId, 'REC062B_POSITIVE_TEST']);
    console.log(`  INSERT: ✅ OK`);
    await c.query(`DELETE FROM recrutamento_prestadores WHERE id = $1`, [testId]);
    console.log(`  DELETE: ✅ OK (cleanup done)`);
  } catch (e) {
    console.log(`  INSERT+DELETE: ❌ FAIL (${e.message.slice(0, 80)})`);
    allOk = false;
  }

  // INSERT+DELETE roundtrip on recrutamento_operacoes
  console.log('\n--- INSERT+DELETE roundtrip (recrutamento_operacoes) ---');
  const testId2 = 'ffffffff-ffff-ffff-ffff-fffffffffffd';
  try {
    await c.query(`INSERT INTO recrutamento_operacoes (id, nome) VALUES ($1, $2)`, [testId2, 'REC062B_POSITIVE_TEST']);
    console.log(`  INSERT: ✅ OK`);
    await c.query(`DELETE FROM recrutamento_operacoes WHERE id = $1`, [testId2]);
    console.log(`  DELETE: ✅ OK (cleanup done)`);
  } catch (e) {
    console.log(`  INSERT+DELETE: ❌ FAIL (${e.message.slice(0, 80)})`);
    allOk = false;
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`RESULTADO POSITIVO: ${allOk ? '✅ TABELAS FUNCIONAIS VIA POSTGRES' : '❌ FALHA'}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // POLICY VERIFICATION
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('VERIFICAÇÃO DE POLICIES (pg_get_expr)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const t of tables) {
    const r = await c.query(`
      SELECT polname, polcmd,
        CASE polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE polcmd::text END AS cmd,
        (SELECT array_agg(r.rolname) FROM unnest(polroles) rid JOIN pg_roles r ON r.oid = rid) AS roles,
        pg_get_expr(polqual, polrelid) AS using_expr
      FROM pg_policy WHERE polrelid = $1::regclass ORDER BY polname
    `, [t]);
    console.log(`  ${t}:`);
    for (const row of r.rows) {
      const hasAnon = row.roles?.includes('anon');
      console.log(`    ${row.polname} [${row.cmd}] roles=${JSON.stringify(row.roles)} ${hasAnon ? '⚠️ ANON!' : '✅'} USING=${row.using_expr || '(none)'}`);
    }
  }

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

  const bridgeData = await c.query(`
    SELECT count(*) AS total,
           count(*) FILTER (WHERE tags ? 'bridge_automatico') AS bridge_auto
    FROM recrutamento_candidatos
  `);
  console.log(`  Candidatos totais: ${bridgeData.rows[0].total}`);
  console.log(`  Candidatos via bridge: ${bridgeData.rows[0].bridge_auto}`);

  // CRM DELETE POLICY PROOF
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('PROVA CRM DELETE POLICY (adicionada)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const crmDel = await c.query(`
    SELECT polname FROM pg_policy
    WHERE polrelid = 'crm_interacoes_prestadores'::regclass AND polcmd = 'd'
  `);
  console.log(`  DELETE policy existe: ${crmDel.rows.length > 0 ? '✅ SIM (' + crmDel.rows[0].polname + ')' : '❌ NÃO'}`);

  await c.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
