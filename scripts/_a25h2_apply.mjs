import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sql = fs.readFileSync('scripts/_a25h2_fix_rpc_registrar_posicao.sql', 'utf8');

console.log('=== APLICANDO CREATE OR REPLACE FUNCTION registrar_posicao_motorista ===');
try {
  await pool.query(sql);
  console.log('Aplicado com sucesso.');
} catch (e) {
  console.error('ERRO AO APLICAR:', e.message);
  process.exit(1);
}

// Validação pós-aplicação
const rpc = await pool.query(`
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='registrar_posicao_motorista'
`);
const def = rpc.rows[0].def;

console.log('\n=== VALIDAÇÃO PÓS-ALTERAÇÃO ===');
console.log('1. Assinatura preservada:', def.includes('p_status_operacional text DEFAULT') && def.includes('p_origem text DEFAULT') ? 'SIM' : 'NÃO');
console.log('2. Sem coluna inexistente (status_operacional/altitude/motorista_id fora de metadata):');
const badInsert = /INSERT INTO public\.portal_tracking_realtime \([\s\S]*?status_operacional[\s\S]*?\)\s*VALUES/.test(def) || /motorista_id/.test(def) || /ordem_servico_id[\s\S]*?INSERT/.test(def);
console.log('   → NENHUMA coluna inexistente no INSERT:', badInsert ? 'NÃO (ACHOU PROBLEMA)' : 'SIM ✓');
console.log('3. Tenant da alocação:', def.includes('v_alocacao_tenant_id') ? 'SIM ✓' : 'NÃO');
console.log('4. UUID capturado em variável compatível (v_tracking_id UUID):', def.includes('v_tracking_id UUID') ? 'SIM ✓' : 'NÃO');
console.log('5. JSON construído explicitamente (jsonb_build_object):', def.includes("'id', v_tracking_id") ? 'SIM ✓' : 'NÃO');
console.log('6. Nenhum cast implícito UUID→JSONB (RETURNING id INTO v_result):', /RETURNING\s+id\s+INTO\s+v_result/.test(def) ? 'NÃO (AINDA TEM ERRO!)' : 'SIM ✓ (removido)');
console.log('7. SECURITY DEFINER preservado:', def.includes('SECURITY DEFINER') ? 'SIM ✓' : 'NÃO');
console.log('8. search_path preservado:', def.includes("SET search_path TO 'public'") ? 'SIM ✓' : 'NÃO');

const meta = await pool.query(`
  SELECT p.prosecdef, p.provolatile, p.proconfig, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='registrar_posicao_motorista'
`);
const m = meta.rows[0];
console.log('SECURITY DEFINER (meta):', m.prosecdef);
console.log('search_path (meta):', JSON.stringify(m.proconfig));
console.log('args (meta):', m.args);

const grants = await pool.query(`
  SELECT grantee, privilege_type FROM information_schema.routine_privileges
  WHERE routine_name='registrar_posicao_motorista' ORDER BY grantee, privilege_type
`);
console.log('\n=== GRANTS (pós) ===');
for (const g of grants.rows) console.log(`  ${g.grantee}: ${g.privilege_type}`);

await pool.end();