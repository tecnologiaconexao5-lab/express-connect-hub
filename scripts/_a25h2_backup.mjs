import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ============ MISSÃO A25-H2 — BACKUP + AUDITORIA (read-only) ============

// 1. Definição real atual
const rpc = await pool.query(`
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
`);
if (rpc.rows.length === 0) {
  console.log('ERRO: função não encontrada');
  process.exit(1);
}
const def = rpc.rows[0].def;
console.log('=== DEFINIÇÃO OBTIDA ===');
console.log(def);

// Salvar backup (sem sobrescrever os anteriores)
const backupPath = 'scripts/_a25h2_backup_rpc_registrar_posicao.sql';
fs.writeFileSync(backupPath, '-- BACKUP MISSÃO A25-H2 — ' + new Date().toISOString() + '\n\n' + def + '\n');
console.log('\n=== BACKUP SALVO ===');
console.log(backupPath);

// 2. Assinatura, SECURITY DEFINER, search_path, provolatile
const meta = await pool.query(`
  SELECT p.prosecdef, p.provolatile, p.proconfig, p.prorettype::regtype AS return_type,
         pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
`);
const m = meta.rows[0];
console.log('\n=== METADADOS ===');
console.log('SECURITY DEFINER:', m.prosecdef);
console.log('VOLATILE:', m.provolatile);
console.log('search_path:', JSON.stringify(m.proconfig));
console.log('RETURN TYPE:', m.return_type);
console.log('ARGUMENTS:', m.args);

// 3. Grants
const grants = await pool.query(`
  SELECT grantee, privilege_type FROM information_schema.routine_privileges
  WHERE routine_name = 'registrar_posicao_motorista' ORDER BY grantee, privilege_type
`);
console.log('\n=== GRANTS ===');
for (const g of grants.rows) console.log(`  ${g.grantee}: ${g.privilege_type}`);

// 4. Colunas reais da tabela
const cols = await pool.query(`
  SELECT column_name, data_type, is_nullable FROM information_schema.columns
  WHERE table_name = 'portal_tracking_realtime' ORDER BY ordinal_position
`);
console.log('\n=== COLUNAS REAIS portal_tracking_realtime ===');
for (const c of cols.rows) console.log(`  ${c.column_name} (${c.data_type}, null:${c.is_nullable})`);

await pool.end();