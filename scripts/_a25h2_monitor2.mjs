import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const ALOCACAO = 'ca5fe225-7114-42da-9997-c3d466e5df52';
let lastMaxCaptured = new Date('2026-08-11T14:47:57.970Z');
let lastMaxCreated = new Date('2026-08-15T10:39:22.352Z');
let novas = 0;

console.log('=== MONITORANDO POSIÇÕES NOVAS (polling ~20s por 4min) ===');
console.log('inicio:', new Date().toISOString());
for (let i = 0; i < 12; i++) {
  const r = await pool.query(`
    SELECT count(*)::int AS total, max(captured_at) AS max_captured, max(created_at) AS max_created
    FROM public.portal_tracking_realtime
    WHERE alocacao_id = $1
  `, [ALOCACAO]);
  const row = r.rows[0];
  const maxCaptured = row.max_captured ? new Date(row.max_captured) : null;
  const maxCreated = row.max_created ? new Date(row.max_created) : null;

  const nova = (maxCaptured && maxCaptured > lastMaxCaptured) || (maxCreated && maxCreated > lastMaxCreated);
  if (nova) {
    novas++;
    const nov = await pool.query(`
      SELECT id, status, latitude, longitude, captured_at, created_at, origem, velocidade, precisao
      FROM public.portal_tracking_realtime
      WHERE alocacao_id = $1 AND created_at > $2
      ORDER BY created_at DESC LIMIT 3
    `, [ALOCACAO, new Date(Date.now() - 240000).toISOString()]);
    for (const n of nov.rows) {
      console.log(`  ★ NOVA: ${n.id} | lat ${n.latitude} lng ${n.longitude} | captured ${n.captured_at} | created ${n.created_at} | vel ${n.velocidade} | ${n.origem}`);
    }
    if (maxCreated) lastMaxCreated = maxCreated;
    if (maxCaptured) lastMaxCaptured = maxCaptured;
  }
  console.log(`[poll ${i + 1}] ${new Date().toISOString()} total=${row.total} max_captured=${maxCaptured?.toISOString() ?? 'null'} nova=${nova}`);
  if (i < 11) await new Promise(res => setTimeout(res, 20000));
}

await pool.end();
console.log('\n=== ENCERRADO === total de novas detectadas:', novas);