import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// 1. Schema REAL de portal_tracking_realtime
console.log('=== SCHEMA portal_tracking_realtime ===');
const cols = await pool.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_name = 'portal_tracking_realtime'
  ORDER BY ordinal_position
`);
for (const c of cols.rows) console.log(' ', c.column_name.padEnd(22), c.data_type, '| null:', c.is_nullable, '| default:', c.column_default ?? '-');

// 2. Últimas posições da alocação (todas as colunas)
console.log('\n=== ÚLTIMAS 10 POSIÇÕES (todas as colunas) ===');
const pos = await pool.query(`
  SELECT * FROM public.portal_tracking_realtime
  WHERE alocacao_id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
  ORDER BY created_at DESC LIMIT 10
`);
for (const p of pos.rows) {
  console.log('--- id:', p.id);
  for (const [k, v] of Object.entries(p)) {
    if (k === 'id' || k === 'alocacao_id') continue;
    console.log('   ', k.padEnd(18), '=', v instanceof Date ? v.toISOString() : String(v));
  }
}

// 3. Resumo comparativo (bateria, captured_at, created_at) das 5 últimas
console.log('\n=== RESUMO 5 ÚLTIMAS ===');
const res = await pool.query(`
  SELECT id, captured_at, created_at, bateria, precisao, velocidade, origem,
         round(extract(epoch from (created_at - captured_at)))::int AS diff_sec,
         round(extract(epoch from (now() - captured_at))/60)::int AS captured_age_min,
         round(extract(epoch from (now() - created_at))/60)::int AS created_age_min
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
  ORDER BY created_at DESC LIMIT 5
`);
for (const r of res.rows) {
  console.log(' ', r.id.slice(0,8), '| captured', r.captured_at?.toISOString(), '| created', r.created_at.toISOString(), '| diff', r.diff_sec, 's | bateria', r.bateria, '| prec', r.precisao, '| vel', r.velocidade, '|', r.origem, '| capAge', r.captured_age_min, 'min | crAge', r.created_age_min, 'min');
}

// 4. Distribuição de bateria (existe valor não-nulo?)
console.log('\n=== BATERIA: valores presentes nas 20 últimas de TODA a tabela ===');
const bat = await pool.query(`
  SELECT count(*)::int AS total,
         count(bateria)::int AS com_bateria,
         count(*) FILTER (WHERE bateria IS NOT NULL AND bateria > 0)::int AS bateria_positiva,
         min(bateria) AS min, max(bateria) AS max
  FROM public.portal_tracking_realtime
`);
console.log(bat.rows[0]);

console.log('\n=== BATERIA: últimas 10 com bateria não nula ===');
const bat10 = await pool.query(`
  SELECT id, alocacao_id, bateria, created_at, origem
  FROM public.portal_tracking_realtime
  WHERE bateria IS NOT NULL
  ORDER BY created_at DESC LIMIT 10
`);
for (const b of bat10.rows) console.log(' ', b.created_at.toISOString(), '| bateria', b.bateria, '|', b.origem, '| aloc', b.alocacao_id?.slice(0,8));

await pool.end();