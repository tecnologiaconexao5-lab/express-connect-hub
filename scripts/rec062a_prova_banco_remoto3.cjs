const { Client } = require('pg');
const CONN = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026!%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = {};

  // candidato_documentos
  const cd = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_name = 'candidato_documentos' ORDER BY ordinal_position
  `);
  r.candidato_documentos = { colunas: cd.rows };
  const cdRls = await c.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'candidato_documentos' AND relnamespace = 'public'::regnamespace`);
  r.candidato_documentos.rls = cdRls.rows[0]?.relrowsecurity || false;
  const cdPols = await c.query(`SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'candidato_documentos'::regclass`);
  r.candidato_documentos.policies = cdPols.rows;
  const cdCnt = await c.query(`SELECT count(*) AS c FROM candidato_documentos`);
  r.candidato_documentos.rowCount = parseInt(cdCnt.rows[0].c);

  // Check if there's a bucket for recrutamento documents
  const buckets = await c.query(`SELECT id, name, public FROM storage.buckets ORDER BY name`);
  r.allBuckets = buckets.rows;

  // Check if anon can read recrutamento data (simulate anon)
  // We test by checking if the USING expression is empty (meaning permissive allows all)
  // This is already captured in _anon_bypass

  // Check function definitions for relevant functions
  const funcBodies = {};
  for (const fn of ['f_bridge_prestador_para_recrutamento', 'trg_evento_prestador_aceitou']) {
    const f = await c.query(`SELECT prosrc, provolatile FROM pg_proc WHERE proname = $1`, [fn]);
    funcBodies[fn] = { body_lines: f.rows[0]?.prosrc?.split('\n').length || 0, volatile: f.rows[0]?.provolatile };
  }
  r.funcBodies = funcBodies;

  console.log(JSON.stringify(r, null, 2));
  await c.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
