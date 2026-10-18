const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();

  console.log('========== 1. TABELAS (públicas) ==========');
  const tables = await client.query(`
    SELECT c.relname AS tabela, c.relrowsecurity AS rls, c.relhasindex AS has_idx,
           obj_description(c.oid) AS comentario
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
    ORDER BY c.relname`);
  tables.rows.forEach(r => console.log(`  ${r.tabela}${r.rls ? ' [RLS]' : ''}${r.comentario ? ' — ' + r.comentario : ''}`));

  console.log('\n========== 2. VIEWS ==========');
  const views = await client.query(`
    SELECT c.relname AS view, obj_description(c.oid) AS comentario
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v'
    ORDER BY c.relname`);
  views.rows.forEach(r => console.log(`  ${r.view}${r.comentario ? ' — ' + r.comentario : ''}`));

  console.log('\n========== 3. MATERIALIZED VIEWS ==========');
  const mviews = await client.query(`
    SELECT c.relname AS mview FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='m' ORDER BY c.relname`);
  mviews.rows.forEach(r => console.log(`  ${r.mview}`));

  console.log('\n========== 4. ENUMS/TYPES ==========');
  const enums = await client.query(`
    SELECT t.typname AS tipo, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores
    FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
    GROUP BY t.typname ORDER BY t.typname`);
  enums.rows.forEach(r => console.log(`  ${r.tipo}: ${r.valores}`));

  console.log('\n========== 5. FUNÇÕES/RPCs ==========');
  const funcs = await client.query(`
    SELECT p.proname, p.provolatile AS vol, p.prosecdef AS securdef,
           pg_get_function_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f'
    ORDER BY p.proname`);
  funcs.rows.forEach(r => console.log(`  ${r.proname}(${r.args}) vol=${r.vol} securdef=${r.securdef}`));

  console.log('\n========== 6. TRIGGERS ==========');
  const trgs = await client.query(`
    SELECT t.tgname AS trigger, c.relname AS tabela, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname`);
  trgs.rows.forEach(r => console.log(`  [${r.tabela}] ${r.trigger}: ${r.def.replace(/\s+/g,' ').slice(0,220)}`));

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });