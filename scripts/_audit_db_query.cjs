const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function query(label, sql) {
  try {
    const res = await client.query(sql);
    console.log(`\n===== ${label} =====`);
    console.log(JSON.stringify(res.rows, null, 2));
    return res.rows;
  } catch (e) {
    console.log(`\n===== ${label} ===== [ERROR] ${e.message}`);
    return [];
  }
}

(async () => {
  await client.connect();
  console.log('Connected.');

  // 1) Database info
  await query('DATABASE INFO', 'SELECT version(), current_database(), current_schema;');

  // 2) All tables/views with stats
  await query('PG_STAT_USER_TABLES', `SELECT schemaname, tablename, tableowner, n_live_tup::bigint, n_dead_tup::bigint
    FROM pg_stat_user_tables ORDER BY schemaname, tablename;`);

  // 3) Schemas
  await query('ALL SCHEMAS', `SELECT schema_name FROM information_schema.schemata ORDER BY schema_name;`);

  // 4) Tables with estimated counts
  await query('TABLES WITH COUNTS', `SELECT schemaname, tablename, n_live_tup::bigint AS estimated_count
    FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY tablename;`);

  // 5) Views
  await query('VIEWS', `SELECT table_name, view_definition FROM information_schema.views
    WHERE table_schema='public' ORDER BY table_name;`);

  // 6) Columns of all public tables
  await query('ALL COLUMNS', `SELECT table_name, column_name, data_type, is_nullable, ordinal_position
    FROM information_schema.columns WHERE table_schema='public'
    ORDER BY table_name, ordinal_position;`);

  // 7) Foreign keys
  await query('FOREIGN KEYS', `SELECT tc.table_name, kcu.column_name,
    ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
    ORDER BY tc.table_name, kcu.column_name;`);

  // 8) Triggers
  await query('TRIGGERS', `SELECT trigger_name, event_manipulation, event_object_table, action_timing
    FROM information_schema.triggers WHERE trigger_schema='public'
    ORDER BY event_object_table, trigger_name;`);

  // 9) Functions/RPCs
  await query('FUNCTIONS', `SELECT routine_name, routine_type, data_type
    FROM information_schema.routines WHERE specific_schema='public' AND routine_type='FUNCTION'
    ORDER BY routine_name;`);

  // 10) Enums
  await query('ENUMS', `SELECT t.typname AS enum_name, e.enumlabel AS enum_value
    FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    ORDER BY t.typname, e.enumsortorder;`);

  // 11) Extensions
  await query('EXTENSIONS', `SELECT extname, extversion FROM pg_extension ORDER BY extname;`);

  // 12) RLS policies
  await query('RLS POLICIES', `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
    FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;`);

  // 13) Tables with/without RLS
  await query('RLS STATUS', `SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class WHERE relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')
    AND relkind='r' ORDER BY relname;`);

  // 14) Storage buckets
  await query('STORAGE BUCKETS', `SELECT id, name, public, created_at FROM storage.buckets ORDER BY name;`);

  // 15) Exact row counts for ALL public tables
  await query('EXACT ROW COUNTS', `
    WITH tbl AS (
      SELECT tablename FROM pg_tables WHERE schemaname='public'
      UNION
      SELECT table_name FROM information_schema.views WHERE table_schema='public'
    )
    SELECT tablename FROM tbl ORDER BY tablename;
  `);

  // Get exact counts for each table
  const tables = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows;
  console.log('\n===== EXACT ROW COUNTS PER TABLE =====');
  for (const t of tables) {
    try {
      const cnt = await client.query(`SELECT COUNT(*)::bigint AS cnt FROM "${t.tablename}"`);
      console.log(`  ${t.tablename.padEnd(40)} ${String(cnt.rows[0].cnt).padStart(8)} rows`);
    } catch(e) {
      console.log(`  ${t.tablename.padEnd(40)} [ERROR: ${e.message}]`);
    }
  }

  await client.end();
  console.log('\nDone.');
})();