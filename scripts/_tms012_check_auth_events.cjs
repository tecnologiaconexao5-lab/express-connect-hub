const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.resolve('.env'), 'utf8');
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) { console.error('no DATABASE_URL'); process.exit(1); }
const url = m[1].replace(/^["']|["']$/g, '');

async function main() {
  const c = await new Client({ connectionString: url, ssl: { rejectUnauthorized: false } }).connect();

  // Check motorista auth user
  const u = await c.query(`
    SELECT id, email, encrypted_password IS NOT NULL as has_password, 
           raw_app_meta_data->>'provider' as provider,
           raw_user_meta_data,
           created_at, last_sign_in_at, confirmed_at
    FROM auth.users WHERE id = 'a5e51631-5ed8-430d-9041-4b185c03d821'
  `);
  console.log('AUTH USER MOTORISTA:');
  for (const r of u.rows) {
    console.log('  id: ' + r.id);
    console.log('  email: ' + r.email);
    console.log('  has_password: ' + r.has_password);
    console.log('  provider: ' + r.provider);
    console.log('  raw_user_meta_data: ' + JSON.stringify(r.raw_user_meta_data));
    console.log('  created_at: ' + r.created_at);
    console.log('  last_sign_in_at: ' + r.last_sign_in_at);
    console.log('  confirmed_at: ' + r.confirmed_at);
  }

  // Check historico_alocacoes_escala columns
  const cols = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'historico_alocacoes_escala'
    ORDER BY ordinal_position
  `);
  console.log('\nHISTORICO_ALOCACOES_ESCALA columns:');
  for (const r of cols.rows) console.log('  ' + r.column_name + ' (' + r.data_type + ')');

  // Check event bus tables
  const evTables = await c.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%event%'
  `);
  console.log('\nEVENT TABLES:');
  for (const r of evTables.rows) console.log('  ' + r.table_name);

  // Check if eventos table exists (from M104)
  const evCols = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND (table_name = 'eventos' OR table_name = 'event_bus')
    ORDER BY table_name, ordinal_position
  `);
  if (evCols.rows.length > 0) {
    console.log('\nEVENTOS columns:');
    for (const r of evCols.rows) console.log('  [' + r.table_name + '] ' + r.column_name + ' (' + r.data_type + ')');
  } else {
    console.log('\nNo eventos/event_bus table found');
  }

  // Check portal_tracking_realtime columns
  const trCols = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'portal_tracking_realtime'
    ORDER BY ordinal_position
  `);
  console.log('\nPORTAL_TRACKING_REALTIME columns:');
  for (const r of trCols.rows) console.log('  ' + r.column_name + ' (' + r.data_type + ')');

  // Check existing OS with "aguardando_aceite" or "pendente" status for this prestador via alocação
  const active = await c.query(`
    SELECT ae.id as aloc_id, ae.ordem_servico_id, os.numero, os.status as os_status, 
           ae.status as aloc_status, ae.created_at
    FROM alocacoes_escala ae
    LEFT JOIN ordens_servico os ON os.id = ae.ordem_servico_id
    WHERE ae.prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'
      AND ae.ordem_servico_id IS NOT NULL
    ORDER BY ae.created_at DESC
    LIMIT 5
  `);
  console.log('\nACTIVE ALOCACOES WITH OS:');
  for (const r of active.rows) console.log('  aloc=' + r.aloc_id + ' os_id=' + r.ordem_servico_id + ' numero=' + r.numero + ' os_status=' + r.os_status + ' aloc_status=' + r.aloc_status);

  // Check the one OS found: 405fe001-4947-44a6-8cd2-c0203a701cfd
  const os1 = await c.query(`
    SELECT id, numero, status, cliente_id, prestador_id, created_at
    FROM ordens_servico WHERE id = '405fe001-4947-44a6-8cd2-c0203a701cfd'
  `);
  console.log('\nOS 405fe001:');
  for (const r of os1.rows) console.log('  ' + JSON.stringify(r));

  await c.end();
}
main().catch(console.error);
