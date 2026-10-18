const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'C:\\Users\\DIEGO BALBINO\\Desktop\\Pasta Compartilhada\\DOCUMENTOS EMPRESA\\08_TECNOLOGIA_SISTEMAS\\express-connect-hub\\.env';
const env = fs.readFileSync(envPath, 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

if (!serviceKeyMatch) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const REAL_URL = urlMatch?.[1]?.trim();
const SERVICE_KEY = serviceKeyMatch[1].trim();

const tables = [
  'recrutamento_prestadores',
  'recrutamento_candidatos',
  'crm_interacoes_prestadores',
  'candidato_documentos',
  'recrutamento_operacoes',
];

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('REC-06.2B — PROVA POSITIVA (service_role = tabelas funcionais)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const svc = createClient(REAL_URL, SERVICE_KEY);
  let allOk = true;

  for (const t of tables) {
    console.log(`--- ${t} ---`);

    // SELECT
    const { data: selData, error: selErr } = await svc.from(t).select('*').limit(1);
    if (selErr) {
      console.log(`  SELECT: ❌ FAIL (${selErr.message.slice(0, 80)})`);
      allOk = false;
    } else {
      console.log(`  SELECT: ✅ OK (${selData?.length || 0} rows returned)`);
    }

    // UPDATE (no-op on non-existent row)
    const { error: updErr } = await svc.from(t).update({ updated_at: new Date().toISOString() }).eq('id', '00000000-0000-0000-0000-000000000000');
    if (updErr) {
      console.log(`  UPDATE: ❌ FAIL (${updErr.message.slice(0, 80)})`);
      allOk = false;
    } else {
      console.log(`  UPDATE: ✅ OK (policy allows)`);
    }

    console.log('');
  }

  // INSERT+DELETE test on recrutamento_prestadores
  console.log('--- INSERT+DELETE roundtrip ---');
  const testId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const { error: insErr } = await svc.from('recrutamento_prestadores').insert({ id: testId, nome: 'REC062B_POSITIVE_TEST' });
  if (insErr) {
    console.log(`  INSERT: ❌ FAIL (${insErr.message.slice(0, 80)})`);
    allOk = false;
  } else {
    console.log(`  INSERT: ✅ OK`);
    const { error: delErr } = await svc.from('recrutamento_prestadores').delete().eq('id', testId);
    if (delErr) {
      console.log(`  DELETE: ❌ FAIL (${delErr.message.slice(0, 80)})`);
      allOk = false;
    } else {
      console.log(`  DELETE: ✅ OK (cleanup done)`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`RESULTADO POSITIVO: ${allOk ? '✅ TABELAS FUNCIONAIS VIA SERVICE_ROLE' : '❌ FALHA'}`);
  console.log('═══════════════════════════════════════════════════════════════');

  // POLICY VERIFICATION (pg_get_expr via pg client)
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('VERIFICAÇÃO DE POLICIES (pg_get_expr)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { Client } = require('pg');
  const CONN = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026!%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
  const c = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await c.connect();

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

  await c.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
