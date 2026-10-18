import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectDir, '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function query(sql) {
  try { await pool.query(sql); return true; }
  catch (e) { 
    const msg = e.message || '';
    if (msg.includes('already exists')) return true;
    console.error('  ERRO:', msg.substring(0, 150));
    return false;
  }
}

async function main() {
  console.log('=== VERIFICAR E CRIAR TABELAS DO PORTAL ===\n');
  
  const { rows: existingTables } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'portal_%'"
  );
  const existing = new Set(existingTables.map(r => r.table_name));
  console.log('Tabelas portal existentes:', [...existing].join(', ') || '(nenhuma)');
  
  // Read the portal_cliente_enterprise.sql
  const sqlPath = path.join(projectDir, 'supabase', 'migrations', 'portal_cliente_enterprise.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  // Extract CREATE TABLE statements using regex
  const createPattern = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.(\w+)\s*\(([^;]+?)\)\s*;/gis;
  const tableDefs = [];
  let match;
  while ((match = createPattern.exec(sql)) !== null) {
    tableDefs.push({ name: match[1], ddl: match[0] });
  }
  
  console.log(`\nFound ${tableDefs.length} table definitions in migration\n`);
  
  for (const t of tableDefs) {
    if (!existing.has(t.name)) {
      console.log(`Criando ${t.name}...`);
      await query(t.ddl);
    } else {
      console.log(`Pulando ${t.name} (ja existe)`);
    }
  }
  
  // Create indexes and enable RLS for missing tables
  console.log('\n--- Aplicando indices e RLS ---\n');
  
  // Extract all non-CREATE TABLE statements
  const stmts = sql.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
  for (const stmt of stmts) {
    if (stmt.toUpperCase().startsWith('CREATE TABLE')) continue;
    await query(stmt + ';');
  }
  
  // Now apply M104 (depends on portal tables)
  console.log('\n=== APLICANDO M104 (Go Live Enterprise) ===\n');
  const m104sql = fs.readFileSync(path.join(projectDir, 'supabase', 'migrations', '20260707_m104_go_live_enterprise.sql'), 'utf-8');
  const m104stmts = m104sql.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
  let ok = 0, fail = 0;
  for (const stmt of m104stmts) {
    if (await query(stmt + ';')) ok++; else fail++;
  }
  console.log(`\nM104: ${ok} ok, ${fail} erros`);
  
  // Apply M106 (depends on portal_tracking_realtime)
  console.log('\n=== APLICANDO M106 (Tracking Real) ===\n');
  const m106sql = fs.readFileSync(path.join(projectDir, 'supabase', 'migrations', '20260709_m106_tracking_real_go_live.sql'), 'utf-8');
  const m106stmts = m106sql.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
  ok = 0; fail = 0;
  for (const stmt of m106stmts) {
    if (await query(stmt + ';')) ok++; else fail++;
  }
  console.log(`\nM106: ${ok} ok, ${fail} erros`);
  
  // Verify
  console.log('\n=== VERIFICACAO FINAL ===\n');
  const allPortalTables = [
    'portal_notificacoes', 'portal_ocorrencias', 'portal_avaliacoes', 
    'portal_pedidos', 'portal_faturas', 'portal_protocolos', 
    'portal_tracking_realtime', 'portal_preferencias_cliente', 'portal_rotas'
  ];
  const final = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'portal_%'"
  );
  const finalExisting = new Set(final.rows.map(r => r.table_name));
  for (const t of allPortalTables) {
    console.log('  ' + (finalExisting.has(t) ? 'OK' : 'AUSENTE') + ' ' + t);
  }
  
  // Check triggers
  const triggerChecks = [
    'trg_evento_os_criada', 'trg_evento_prestador_aceitou', 
    'trg_evento_operacao_finalizada', 'trg_evento_os_finalizada',
    'trg_evento_os_cancelada', 'f_trg_event_bus_consumer'
  ];
  console.log('\n--- Verificando triggers ---');
  for (const tg of triggerChecks) {
    const r = await pool.query("SELECT EXISTS (SELECT FROM pg_proc WHERE proname = $1)", [tg]);
    console.log('  ' + (r.rows[0].exists ? 'OK' : 'AUSENTE') + ' ' + tg);
  }
  
  // Check RPC
  const rpcCheck = await pool.query("SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'registrar_posicao_motorista')");
  console.log('  ' + (rpcCheck.rows[0].exists ? 'OK' : 'AUSENTE') + ' RPC registrar_posicao_motorista');
  
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
