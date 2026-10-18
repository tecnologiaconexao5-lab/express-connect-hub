const { Client } = require('pg');

const CONN = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026!%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

const TABLES = [
  'recrutamento_prestadores',
  'recrutamento_candidatos',
  'crm_interacoes_prestadores',
  'recrutamento_automacoes',
  'recrutamento_documentos',
  'recrutamento_score_historico',
  'recrutamento_metricas',
];

async function run() {
  const c = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const results = {};

  // 1. Tabela existe?
  for (const t of TABLES) {
    const r = await c.query(`
      SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS existe
    `, [t]);
    results[t] = { existe: r.rows[0].existe };
  }

  // 2. Schema detalhado de cada tabela existente
  for (const t of TABLES) {
    if (!results[t].existe) { results[t].colunas = []; results[t].rls = false; results[t].policies = []; continue; }

    const cols = await c.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position
    `, [t]);
    results[t].colunas = cols.rows;

    const rls = await c.query(`SELECT relrowsecurity FROM pg_class WHERE relname = $1 AND relnamespace = 'public'::regnamespace`, [t]);
    results[t].rls = rls.rows[0]?.relrowsecurity || false;

    const pols = await c.query(`
      SELECT polname, polcmd
      FROM pg_policy WHERE polrelid = $1::regclass
    `, [t]);
    results[t].policies = pols.rows;

    // FKs
    const fks = await c.query(`
      SELECT kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1
    `, [t]);
    results[t].fks = fks.rows;

    // Constraints (CHECK, UNIQUE)
    const cons = await c.query(`
      SELECT conname, CASE contype WHEN 'c' THEN 'check' WHEN 'u' THEN 'unique' WHEN 'p' THEN 'primary' WHEN 'f' THEN 'foreign' WHEN 't' THEN 'trigger' ELSE contype::text END AS contype, pg_get_constraintdef(oid) AS def
      FROM pg_constraint WHERE conrelid = $1::regclass
    `, [t]);
    results[t].constraints = cons.rows;

    // Triggers
    const trigs = await c.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers WHERE event_object_table = $1
    `, [t]);
    results[t].triggers = trigs.rows;

    // Grants
    const grants = await c.query(`
      SELECT grantee, privilege_type, is_grantable
      FROM information_schema.table_privileges WHERE table_name = $1 ORDER BY grantee, privilege_type
    `, [t]);
    results[t].grants = grants.rows;

    // Row count
    const cnt = await c.query(`SELECT count(*) AS cnt FROM ${t}`);
    results[t].rowCount = parseInt(cnt.rows[0].cnt);
  }

  // 3. Views/materialized views relacionadas
  const views = await c.query(`
    SELECT table_name, view_definition::text
    FROM information_schema.views
    WHERE table_name LIKE '%recrutamento%' OR table_name LIKE '%candidato%' OR table_name LIKE '%prestador%'
    ORDER BY table_name
  `);
  results._views = views.rows;

  // 4. Storage buckets
  const buckets = await c.query(`
    SELECT id, name, public, file_size_limit, allowed_mime_types
    FROM storage.buckets WHERE name LIKE '%recrutamento%' OR name LIKE '%documento%' OR name LIKE '%candidato%'
    ORDER BY name
  `).catch(() => ({ rows: [] }));
  results._storageBuckets = buckets.rows;

  // 5. RPCs/functions relacionadas
  const funcs = await c.query(`
    SELECT routine_name, routine_type, data_type, security_type
    FROM information_schema.routines
    WHERE routine_name LIKE '%recrutamento%' OR routine_name LIKE '%candidato%' OR routine_name LIKE '%prestador%'
      OR routine_name LIKE '%automacao%'
    ORDER BY routine_name
  `);
  results._functions = funcs.rows;

  // 6. Indexes
  const idxs = await c.query(`
    SELECT indexname, indexdef
    FROM pg_indexes WHERE tablename LIKE 'recrutamento%' OR tablename = 'crm_interacoes_prestadores'
    ORDER BY tablename, indexname
  `);
  results._indexes = idxs.rows;

  // 7. liberado_app coluna na tabela prestadores
  const libApp = await c.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns WHERE table_name = 'prestadores' AND column_name = 'liberado_app'
  `);
  results._liberadoApp = libApp.rows;

  // 8. Triggers em prestadores
  const prestTrigs = await c.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers WHERE event_object_table = 'prestadores'
  `);
  results._prestadoresTriggers = prestTrigs.rows;

  // 9. audit table check
  const auditT = await c.query(`
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'prestadores_audit') AS existe
  `);
  results._prestadoresAudit = auditT.rows[0].existe;

  // 10. tenant_id check across tables
  for (const t of TABLES) {
    if (!results[t].existe) continue;
    const tid = await c.query(`
      SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'tenant_id') AS tem
    `, [t]);
    results[t].temTenantId = tid.rows[0].tem;
  }

  // Print all
  console.log(JSON.stringify(results, null, 2));

  await c.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
