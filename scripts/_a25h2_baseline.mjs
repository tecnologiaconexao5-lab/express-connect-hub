import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const ALOCACAO = 'ca5fe225-7114-42da-9997-c3d466e5df52';

// Linha base antes de aguardar o Redmi
const r = await pool.query(`
  SELECT count(*)::int AS total,
         max(captured_at) AS max_captured,
         max(created_at) AS max_created
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = $1
`, [ALOCACAO]);

console.log('=== BASELINE (alocação ' + ALOCACAO + ') ===');
console.log('total:', r.rows[0].total);
console.log('max_captured_at:', r.rows[0].max_captured);
console.log('max_created_at:', r.rows[0].max_created);

// Status da alocação (confirmar que segue em_rota/ativa)
const al = await pool.query(`
  SELECT id, status, prestador_id, ordem_servico_id, cliente_id, tenant_id
  FROM public.alocacoes_escala WHERE id = $1
`, [ALOCACAO]);
console.log('\n=== ALOCAÇÃO ===');
if (al.rows[0]) {
  console.log('status:', al.rows[0].status);
  console.log('prestador_id:', al.rows[0].prestador_id);
  console.log('ordem_servico_id:', al.rows[0].ordem_servico_id);
  console.log('cliente_id:', al.rows[0].cliente_id);
  console.log('tenant_id:', al.rows[0].tenant_id);
} else {
  console.log('NÃO ENCONTRADA!');
}

await pool.end();