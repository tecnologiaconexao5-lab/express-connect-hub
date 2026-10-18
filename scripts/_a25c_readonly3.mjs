import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ============ SOMENTE LEITURA — MISSÃO A25-C (parte 3) ============
// 1) Definição ATUAL do RPC em Produção (aplicada na A25-B)
const rpc = await pool.query(`
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
`);
console.log('=== RPC ATUAL (A25-B) ===');
console.log(rpc.rows[0].def);

// 2) Busca EXATA de OS-HML-MULTI-001 (qualquer forma)
const os = await pool.query(`
  SELECT id, numero, status, cliente, origem, destino, created_at, updated_at
  FROM public.ordens_servico
  WHERE numero ILIKE '%MULTI%' OR numero ILIKE '%OS-HML%' OR numero ILIKE '%HML-MULTI%'
  ORDER BY created_at DESC LIMIT 20
`);
console.log('\n=== ORDENS (MULTI / OS-HML) ===');
for (const o of os.rows) console.log(JSON.stringify(o));

// 3) A alocação 'em_rota' sem OS (ca5fe225) — candidata a "EM ROTA" do App
const aloc = await pool.query(`
  SELECT ae.id, ae.status, ae.finalizada, ae.data_escala, ae.ordem_servico_id,
         ae.prestador_id, ae.placa, ae.tipo_veiculo, ae.updated_at,
         ae.metadata->'app_motorista' AS app_motorista,
         ae.metadata->'pod' AS pod
  FROM public.alocacoes_escala ae
  WHERE ae.id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
`);
console.log('\n=== ALOCAÇÃO ca5fe225 (em_rota) ===');
for (const a of aloc.rows) console.log(JSON.stringify(a, null, 2));

// 4) Posições tracking dessa alocação (qualquer)
const pos = await pool.query(`
  SELECT id, alocacao_id, os_id, prestador_id, latitude, longitude, status, origem,
         captured_at, created_at
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
  ORDER BY created_at DESC LIMIT 10
`);
console.log('\n=== POSIÇÕES DA ALOCAÇÃO ca5fe225 ===');
for (const p of pos.rows) console.log(JSON.stringify(p));

// 5) Confirmar: alocacoes_escala tem tenant_id? e prestadores não tem?
const alocTenant = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'alocacoes_escala' AND column_name IN ('tenant_id','empresa_id')
`);
console.log('\n=== alocacoes_escala tenant_id/empresa_id ===');
for (const c of alocTenant.rows) console.log('  ' + c.column_name);

const prestTenant = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'prestadores' AND column_name = 'tenant_id'
`);
console.log('=== prestadores.tenant_id existe? ===', prestTenant.rows.length ? 'SIM' : 'NÃO');

await pool.end();
