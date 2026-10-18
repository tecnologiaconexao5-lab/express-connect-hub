import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ============ SOMENTE LEITURA — MISSÃO A25-C (parte 4) ============
// 1) PROVAR que o SELECT do RPC (VALIDAÇÃO 2) falha: prestadores.tenant_id não existe
try {
  const r = await pool.query(`
    SELECT id, tenant_id FROM public.prestadores LIMIT 1
  `);
  console.log('SELECT id, tenant_id FROM prestadores → OK:', r.rows);
} catch (e) {
  console.log('SELECT id, tenant_id FROM prestadores → ERRO:', e.message);
}

// 2) Confirmar que alocacoes_escala TEM tenant_id (fonte correta)
const aloc = await pool.query(`
  SELECT id, tenant_id, empresa_id FROM public.alocacoes_escala
  WHERE id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
`);
console.log('\nalocacoes_escala.ca5fe225 tenant_id:', JSON.stringify(aloc.rows[0]));

// 3) O auth_user_id do prestador existe (para o login do App)
const prest = await pool.query(`
  SELECT id, auth_user_id, liberado_app, status FROM public.prestadores
  WHERE id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'
`);
console.log('\nprestador auth_user_id:', JSON.stringify(prest.rows[0]));

// 4) Existe auth user vinculado?
if (prest.rows[0]?.auth_user_id) {
  const au = await pool.query(`
    SELECT id, email, created_at FROM auth.users WHERE id = $1
  `, [prest.rows[0].auth_user_id]);
  console.log('auth.users vinculado:', JSON.stringify(au.rows[0]));
}

// 5) Contagem total de posições + janela temporal
const cnt = await pool.query(`
  SELECT count(*) AS total,
         max(created_at) AS mais_recente_created,
         max(captured_at) AS mais_recente_captured
  FROM public.portal_tracking_realtime
`);
console.log('\n=== portal_tracking_realtime ===');
console.log(JSON.stringify(cnt.rows[0]));

await pool.end();
