const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.resolve('.env'), 'utf8');
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) { console.error('no DATABASE_URL'); process.exit(1); }
const url = m[1].replace(/^["']|["']$/g, '');

async function main() {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // clientes columns
  const cols1 = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clientes'
    ORDER BY ordinal_position
  `);
  console.log('CLIENTES columns:');
  for (const r of cols1.rows) console.log('  ' + r.column_name + ' (' + r.data_type + ') nullable=' + r.is_nullable + ' default=' + (r.column_default||''));

  // ordens_servico columns
  const cols2 = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ordens_servico'
    ORDER BY ordinal_position
  `);
  console.log('\nORDENS_SERVICO columns:');
  for (const r of cols2.rows) console.log('  ' + r.column_name + ' (' + r.data_type + ') nullable=' + r.is_nullable + ' default=' + (r.column_default||''));

  // Check if there's a sequence or autoincrement for OS numero
  const seq = await c.query(`
    SELECT column_name, column_default FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ordens_servico' 
    AND column_default IS NOT NULL
  `);
  console.log('\nDEFAULTS:');
  for (const r of seq.rows) console.log('  ' + r.column_name + ' -> ' + r.column_default);

  // Check operation_timeline_events columns
  const cols3 = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'operation_timeline_events'
    ORDER BY ordinal_position
  `);
  console.log('\nOPERATION_TIMELINE_EVENTS columns:');
  for (const r of cols3.rows) console.log('  ' + r.column_name + ' (' + r.data_type + ')');

  // Check last OS numero to generate next
  const lastOS = await c.query(`
    SELECT numero FROM ordens_servico 
    WHERE numero LIKE 'OS-%' 
    ORDER BY created_at DESC LIMIT 1
  `);
  console.log('\nLAST OS NUMERO:');
  for (const r of lastOS.rows) console.log('  ' + r.numero);

  await c.end();
}
main().catch(console.error);
