// MISSÃO 133-D.7 — FASES 3+4: Ler definições das RPCs App Motorista + mapear cadeia de efeitos
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();

  // 1. Get RPC definitions
  const r = await c.query(`
    SELECT p.proname, p.pronargs, p.proargnames, p.proargtypes::text,
           p.prorettype::text AS return_type,
           pg_get_functiondef(p.oid) AS full_def
    FROM pg_proc p
    WHERE p.proname IN ('f_avancar_etapa_app_motorista','f_atualizar_reversa_app')
    ORDER BY p.proname
  `);
  
  for (const row of r.rows) {
    console.log(`\n========== ${row.proname} ==========`);
    console.log(`Args: ${row.pronargs} | Names: ${JSON.stringify(row.proargnames)}`);
    console.log(`Return type: ${row.return_type}`);
    console.log(`\n--- Full definition ---`);
    console.log(row.full_def);
    console.log(`--- END ${row.proname} ---`);
  }

  // 2. Check for triggers on alocacoes_escala that might cascade
  const triggers = await c.query(`
    SELECT trigger_name, event_manipulation, action_timing,
           action_statement::text AS statement
    FROM information_schema.triggers
    WHERE event_object_table = 'alocacoes_escala'
    ORDER BY trigger_name
  `);
  console.log(`\n========== TRIGGERS ON alocacoes_escala ==========`);
  if (triggers.rows.length === 0) {
    console.log('(none)');
  } else {
    for (const t of triggers.rows) {
      console.log(`  ${t.trigger_name}: ${t.action_timing} ${t.event_manipulation}`);
      console.log(`    ${t.statement.substring(0,300)}`);
    }
  }

  // 3. Check for triggers on ordens_servico (cascade from OS)
  const triggers2 = await c.query(`
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'ordens_servico'
    ORDER BY trigger_name
  `);
  console.log(`\n========== TRIGGERS ON ordens_servico ==========`);
  if (triggers2.rows.length === 0) {
    console.log('(none)');
  } else {
    for (const t of triggers2.rows) {
      console.log(`  ${t.trigger_name}: ${t.action_timing} ${t.event_manipulation}`);
    }
  }

  // 4. Check historico_alocacoes_escala (logging)
  const histCols = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='historico_alocacoes_escala'
    ORDER BY ordinal_position
  `);
  console.log(`\n========== historico_alocacoes_escala columns ==========`);
  for (const col of histCols.rows) {
    console.log(`  ${col.column_name} (${col.data_type})`);
  }

  await c.end();
})();
