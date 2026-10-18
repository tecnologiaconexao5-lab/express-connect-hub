import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ============ SOMENTE LEITURA — MISSÃO A25-E (parte 2) ============
// Estado do RPC após A25-D
const rpc = await pool.query(`
  SELECT pg_get_functiondef(p.oid) AS def, p.proconfig, p.prosecdef, p.provolatile
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
`);
const def = rpc.rows[0].def;
console.log('=== RPC (após A25-D) ===');
console.log('SECURITY DEFINER:', rpc.rows[0].prosecdef);
console.log('search_path:', JSON.stringify(rpc.rows[0].proconfig));
console.log('VOLATILE:', rpc.rows[0].provolatile);
console.log('Ref prestadores.tenant_id?', /FROM public\.prestadores[\s\S]*?tenant_id|SELECT\s+id,\s*tenant_id/.test(def) ? 'SIM (ERRO)' : 'NÃO ✓');
console.log('Ref alocacoes_escala.tenant_id?', def.includes('ae.tenant_id') ? 'SIM ✓' : 'NÃO');
console.log('Assinatura com p_altitude?', def.includes('p_altitude') ? 'SIM ✓' : 'NÃO');
console.log('Assinatura com p_status_operacional?', def.includes('p_status_operacional') ? 'SIM ✓' : 'NÃO');

// Verificar colunas reais da tabela (para confirmar compatibilidade do INSERT)
const cols = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'portal_tracking_realtime' ORDER BY ordinal_position
`);
console.log('\n=== colunas portal_tracking_realtime ===');
console.log(cols.rows.map(c => c.column_name).join(', '));

// Grants da função (quem pode EXECUTE)
const grants = await pool.query(`
  SELECT grantee, privilege_type FROM information_schema.routine_privileges
  WHERE routine_name = 'registrar_posicao_motorista'
  ORDER BY grantee
`);
console.log('\n=== grants da função ===');
for (const g of grants.rows) console.log(`  ${g.grantee}: ${g.privilege_type}`);

await pool.end();
