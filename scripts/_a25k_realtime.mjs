import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

console.log('Hora UTC atual (servidor):', await pool.query(`SELECT now() AS now`).then(r=>r.rows[0].now.toISOString()));

console.log('\n=== POSIÇÕES RECENTES ca5fe225 (por created_at DESC, 10) ===');
const pos = await pool.query(`
  SELECT id, alocacao_id, captured_at, created_at, latitude, longitude, velocidade, precisao, origem
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
  ORDER BY created_at DESC LIMIT 10
`);
for (const p of pos.rows) {
  const idadeMin = Math.round((Date.now() - new Date(p.created_at).getTime())/60000);
  console.log(' ', p.created_at.toISOString(), '| age', idadeMin, 'min | captured', p.captured_at?.toISOString(), '| lat', p.latitude, '| lng', p.longitude, '| vel', p.velocidade, '| prec', p.precisao);
}

console.log('\n=== POSIÇÕES RECENTES ca5fe225 (por captured_at DESC, 5) ===');
const pos2 = await pool.query(`
  SELECT id, captured_at, created_at, latitude, longitude, velocidade, precisao, origem
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
  ORDER BY captured_at DESC LIMIT 5
`);
for (const p of pos2.rows) {
  console.log(' ', 'captured', p.captured_at?.toISOString(), '| created', p.created_at.toISOString(), '| lat', p.latitude, '| lng', p.longitude, '| vel', p.velocidade);
}

console.log('\n=== metadata atual de ca5fe225 (ultima_posicao / tracking_status) ===');
const meta = await pool.query(`
  SELECT metadata FROM public.alocacoes_escala WHERE id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
`);
const m = meta.rows[0]?.metadata;
console.log('ultima_posicao:', JSON.stringify(m?.ultima_posicao, null, 2));
console.log('tracking_status:', m?.tracking_status);
console.log('etapa_atual:', m?.app_motorista?.etapa_atual);

console.log('\n=== Estado atual DEFINITIVO (re-confirmar) ===');
const st = await pool.query(`
  SELECT id, status, finalizada, updated_at, metadata->'app_motorista'->>'etapa_atual' AS etapa_atual
  FROM public.alocacoes_escala WHERE id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
`);
console.log(st.rows[0]);

await pool.end();