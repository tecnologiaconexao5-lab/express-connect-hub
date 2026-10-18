import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

console.log('=== VERIFICAÇÃO AMPLA FINAL — posições recentes (todas) ===');
const r = await pool.query(`
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE created_at > now() - interval '30 minutes')::int AS ult_30min,
         count(*) FILTER (WHERE created_at > now() - interval '6 hours')::int AS ult_6h,
         max(created_at) AS max_created
  FROM public.portal_tracking_realtime
`);
console.log('total:', r.rows[0].total);
console.log('criadas últimos 30min:', r.rows[0].ult_30min);
console.log('criadas últimos 6h:', r.rows[0].ult_6h);
console.log('max created_at:', r.rows[0].max_created);

// Status atual da alocação + prestador
const al = await pool.query(`
  SELECT ae.id, ae.status, ae.prestador_id, ae.ordem_servico_id, ae.cliente_id, ae.tenant_id,
         p.nome_completo, p.auth_user_id
  FROM public.alocacoes_escala ae
  LEFT JOIN public.prestadores p ON p.id = ae.prestador_id
  WHERE ae.id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
`);
if (al.rows[0]) {
  console.log('\n=== ALOCAÇÃO ===');
  console.log('status:', al.rows[0].status);
  console.log('prestador:', al.rows[0].nome_completo, '(', al.rows[0].prestador_id, ')');
  console.log('auth_user:', al.rows[0].auth_user_id);
  console.log('tenant_id:', al.rows[0].tenant_id);
} else {
  console.log('alocação não encontrada');
}

await pool.end();