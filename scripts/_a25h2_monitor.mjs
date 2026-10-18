import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const ALOCACAO = 'ca5fe225-7114-42da-9997-c3d466e5df52';
let lastMaxCaptured = new Date('2026-08-11T14:47:57.970Z');
let lastMaxCreated = new Date('2026-08-15T10:39:22.352Z');

console.log('=== MONITORANDO NOVAS POSIÇÕES (polling ~15s por 120s) ===');
for (let i = 0; i < 8; i++) {
  const r = await pool.query(`
    SELECT count(*)::int AS total, max(captured_at) AS max_captured, max(created_at) AS max_created
    FROM public.portal_tracking_realtime
    WHERE alocacao_id = $1
  `, [ALOCACAO]);
  const row = r.rows[0];
  const maxCaptured = row.max_captured ? new Date(row.max_captured) : null;
  const maxCreated = row.max_created ? new Date(row.max_created) : null;

  const novaCaptured = maxCaptured && maxCaptured > lastMaxCaptured;
  const novaCreated = maxCreated && maxCreated > lastMaxCreated;

  console.log(`[poll ${i + 1}] total=${row.total} max_captured=${row.max_captured} max_created=${row.max_created} novaCaptured=${novaCaptured} novaCreated=${novaCreated}`);

  if (maxCreated) lastMaxCreated = maxCreated;
  if (maxCaptured) lastMaxCaptured = maxCaptured;

  if (novaCaptured || novaCreated) {
    // Mostrar as novas linhas
    const nov = await pool.query(`
      SELECT id, status, latitude, longitude, captured_at, created_at, origem, metadata
      FROM public.portal_tracking_realtime
      WHERE alocacao_id = $1 AND created_at > $2
      ORDER BY created_at DESC LIMIT 5
    `, [ALOCACAO, new Date(Date.now() - 180000).toISOString()]);
    for (const n of nov.rows) {
      console.log('  NOVA:', n.id, '| lat', n.latitude, 'lng', n.longitude, '| captured', n.captured_at, '| created', n.created_at, '|', n.origem);
    }
  }

  if (i < 7) {
    await new Promise(res => setTimeout(res, 15000));
  }
}

await pool.end();
console.log('\n=== MONITORAMENTO ENCERRADO ===');