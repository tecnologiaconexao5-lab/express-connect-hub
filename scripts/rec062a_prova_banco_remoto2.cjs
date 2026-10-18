const { Client } = require('pg');
const CONN = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026!%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = {};

  // 1. Bridge function body
  const bridge = await c.query(`SELECT prosrc FROM pg_proc WHERE proname = 'f_bridge_prestador_para_recrutamento'`);
  r.bridge_function = bridge.rows[0]?.prosrc || 'NOT FOUND';

  // 2. Extra tables found via indexes
  const extraTables = ['recrutamento_ia_config', 'recrutamento_whatsapp_config', 'recrutamento_whatsapp_conversas', 'recrutamento_whatsapp_mensagens', 'recrutamento_operacoes'];
  for (const t of extraTables) {
    const exists = await c.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS e`, [t]);
    if (exists.rows[0].e) {
      const cnt = await c.query(`SELECT count(*) AS c FROM ${t}`);
      const cols = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
      const rls2 = await c.query(`SELECT relrowsecurity FROM pg_class WHERE relname = $1 AND relnamespace = 'public'::regnamespace`, [t]);
      const pols2 = await c.query(`SELECT polname, polcmd FROM pg_policy WHERE polrelid = $1::regclass`, [t]);
      r[t] = { existe: true, rowCount: parseInt(cnt.rows[0].c), colunas: cols.rows, rls: rls2.rows[0]?.relrowsecurity || false, policies: pols2.rows };
    } else {
      r[t] = { existe: false };
    }
  }

  // 3. Check anon bypass for recrutamento tables
  r._anon_bypass = {};
  for (const t of ['recrutamento_prestadores', 'recrutamento_candidatos', 'crm_interacoes_prestadores']) {
    const pols = await c.query(`
      SELECT polname, polcmd
      FROM pg_policy WHERE polrelid = $1::regclass AND polcmd IN ('r', 'a', '*', 'd', 'w')
    `, [t]);
    r._anon_bypass[t] = pols.rows.map(p => ({
      name: p.polname,
      cmd: p.polcmd,
      using: p.using_expr || '(none — permissive, allows all)',
      is_public: !p.using_expr || p.using_expr.includes('true') || p.using_expr === 'true',
    }));
  }

  // 4. Check documents storage policies
  const storagePols = await c.query(`
    SELECT policyname, operation, definition
    FROM storage.policies
    WHERE bucket_id IN ('documentos', 'documentos_prestadores')
  `).catch(() => ({ rows: [] }));
  r._storagePolicies = storagePols.rows;

  // 5. Check recrutamento_prestadores row count + sample
  const sample = await c.query(`SELECT id, nome, status, origem_cadastro FROM recrutamento_prestadores LIMIT 3`);
  r._prestadoresSample = sample.rows;

  // 6. Check candidatos sample
  const cands = await c.query(`SELECT id, nome, stage, status_documental, prestador_id IS NOT NULL AS tem_vinculo FROM recrutamento_candidatos LIMIT 5`);
  r._candidatosSample = cands.rows;

  // 7. Check if Liberado_app column has triggers
  const libTrigs = await c.query(`
    SELECT t.trigger_name, t.event_manipulation, t.action_statement
    FROM information_schema.triggers t
    WHERE t.event_object_table = 'prestadores'
      AND t.action_statement ILIKE '%liberado%'
  `).catch(() => ({ rows: [] }));
  r._liberadoTriggers = libTrigs.rows;

  // 8. Check prestige_operacoes table (from indexes)
  const opExists = await c.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'prestadores') AS e`);
  const opRls = await c.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'prestadores' AND relnamespace = 'public'::regnamespace`);
  r._prestadoresTable = { existe: opExists.rows[0].e, rls: opRls.rows[0]?.relrowsecurity || false };

  // 9. Check FK chain: recrutamento_candidatos.prestador_id → recrutamento_prestadores.id
  const fkChain = await c.query(`
    SELECT
      tc.table_name AS source_table,
      kcu.column_name AS source_column,
      ccu.table_name AS target_table,
      ccu.column_name AS target_column,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND (tc.table_name LIKE 'recrutamento%' OR ccu.table_name LIKE 'recrutamento%')
  `);
  r._fkChain = fkChain.rows;

  console.log(JSON.stringify(r, null, 2));
  await c.end();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
