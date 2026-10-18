import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Timezone do servidor
const tz = await pool.query(`SHOW timezone`);
console.log('server timezone:', tz.rows[0].TimeZone);

// Ver se existe trigger na tabela
const trg = await pool.query(`
  SELECT t.tgname, p.proname
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'portal_tracking_realtime' AND NOT t.tgisinternal
`);
console.log('\ntriggers em portal_tracking_realtime:', trg.rows.length);
for (const t of trg.rows) console.log(' ', t.tgname, '→', t.proname);

// Coluna created_at tem default now()?
const col = await pool.query(`
  SELECT column_name, column_default, is_nullable
  FROM information_schema.columns
  WHERE table_name='portal_tracking_realtime' AND column_name IN ('created_at','updated_at','captured_at')
`);
console.log('\ncolunas default:');
for (const c of col.rows) console.log(' ', c.column_name, '| default:', c.column_default, '| null:', c.is_nullable);

// Confirmar que captured_at armazenado vem exatamente do payload (sem trigger de reescrita)
const pos = await pool.query(`
  SELECT id, captured_at, created_at, extract(epoch from (created_at - captured_at)) AS diff_sec
  FROM public.portal_tracking_realtime
  WHERE id = 'b7c215d6-9759-438b-a31c-ff9bf9cce0e6'
`);
console.log('\nposição nova:');
console.log(pos.rows[0]);

await pool.end();