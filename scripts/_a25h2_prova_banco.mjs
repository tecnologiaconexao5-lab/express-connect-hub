import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const r = await pool.query(`
  SELECT id, alocacao_id, os_id, prestador_id, veiculo_id, cliente_id, tenant_id,
         status, latitude, longitude, precisao, velocidade, direcao, bateria,
         captured_at, created_at, origem, metadata
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
  ORDER BY created_at DESC
`);
console.log('TOTAL:', r.rows.length);
for (const row of r.rows) {
  console.log('\n---');
  console.log('id:', row.id);
  console.log('status:', row.status, '| origem:', row.origem);
  console.log('latitude:', row.latitude, '| longitude:', row.longitude);
  console.log('precisao:', row.precisao, '| velocidade:', row.velocidade, '| bateria:', row.bateria);
  console.log('captured_at:', row.captured_at, '| created_at:', row.created_at);
  console.log('prestador_id:', row.prestador_id);
  console.log('alocacao_id:', row.alocacao_id);
  console.log('os_id:', row.os_id, '| cliente_id:', row.cliente_id, '| veiculo_id:', row.veiculo_id);
  console.log('tenant_id:', row.tenant_id);
  console.log('metadata:', JSON.stringify(row.metadata));
}

// Recentes em qualquer alocação (ultimas 1h / 24h) - para ver se o Redmi ainda envia
const recentes = await pool.query(`
  SELECT count(*)::int AS total, max(created_at) AS max_created
  FROM public.portal_tracking_realtime
  WHERE created_at > now() - interval '1 hour'
`);
console.log('\n=== RECENTES (última 1h, todas alocações) ===');
console.log('total:', recentes.rows[0].total, '| max_created:', recentes.rows[0].max_created);

await pool.end();