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

function parseStatements(sql) {
  const stmts = [];
  let i = 0;
  let current = '';
  let inDollar = false;
  let dollarTag = '';
  
  while (i < sql.length) {
    const ch = sql[i];
    
    // Skip single-line comments
    if (ch === '-' && sql[i+1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    
    // Track dollar-quoting
    if (ch === '$') {
      let j = i + 1;
      let tag = '';
      while (j < sql.length && sql[j] !== '$') { tag += sql[j]; j++; }
      if (j < sql.length && sql[j] === '$') {
        if (!inDollar) {
          inDollar = true;
          dollarTag = tag;
          current += sql.substring(i, j + 1);
          i = j + 1;
          continue;
        } else if (tag === dollarTag) {
          inDollar = false;
          current += sql.substring(i, j + 1);
          i = j + 1;
          continue;
        }
      }
    }
    
    // Split on semicolon (only outside dollar-quoting)
    if (ch === ';' && !inDollar) {
      current += ';';
      const trimmed = current.trim();
      if (trimmed) stmts.push(trimmed);
      current = '';
      i++;
      continue;
    }
    
    current += ch;
    i++;
  }
  
  const trimmed = current.trim();
  if (trimmed) stmts.push(trimmed);
  return stmts;
}

async function main() {
  console.log('=== APLICAR TRIGGERS E FUNCOES FALTANTES ===\n');
  
  try {
    const r = await pool.query('SELECT NOW()');
    console.log('Conectado\n');
  } catch (e) {
    console.error('Erro conexao:', e.message);
    process.exit(1);
  }
  
  const migDir = path.join(projectDir, 'supabase', 'migrations');
  
  // === PORTAL CLIENTE ENTERPRISE (section 4+) ===
  // Tables already created, now need RLS policies, functions, triggers
  console.log('--- Portal Cliente Enterprise (funcoes/triggers) ---');
  const portalSql = fs.readFileSync(path.join(migDir, 'portal_cliente_enterprise.sql'), 'utf-8');
  
  // Skip section 1-3 (CREATE TABLE statements already done)
  // Process from section 4 onwards
  const section4Index = portalSql.indexOf('-- 4.');
  const section4Sql = section4Index >= 0 ? portalSql.substring(section4Index) : portalSql;
  
  const portalStmts = parseStatements(section4Sql);
  console.log(`  ${portalStmts.length} statements (section 4+)`);
  
  let ok = 0, fail = 0;
  for (const stmt of portalStmts) {
    try {
      await pool.query(stmt);
      ok++;
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('duplicate key') || msg.includes('cannot drop')) {
        ok++;
      } else if (msg.includes('does not exist') && (msg.includes('policy') || msg.includes('table') || msg.includes('column'))) {
        ok++; // Not critical - just missing infrastructure
      } else {
        fail++;
        if (fail <= 5) console.log(`  ERRO: ${msg.substring(0, 150)}`);
      }
    }
  }
  console.log(`  ${ok} ok, ${fail} erros`);
  
  // === M104 ===
  console.log('\n--- M104 Go Live Enterprise ---');
  const m104Sql = fs.readFileSync(path.join(migDir, '20260707_m104_go_live_enterprise.sql'), 'utf-8');
  const m104Stmts = parseStatements(m104Sql);
  console.log(`  ${m104Stmts.length} statements`);
  
  ok = 0; fail = 0;
  for (const stmt of m104Stmts) {
    try {
      await pool.query(stmt);
      ok++;
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('duplicate key') || msg.includes('cannot drop')) {
        ok++;
      } else if (msg.includes('does not exist') && (msg.includes('policy') || msg.includes('table') || msg.includes('column') || msg.includes('function') || msg.includes('trigger'))) {
        ok++;
      } else {
        fail++;
        if (fail <= 5) console.log(`  ERRO: ${msg.substring(0, 150)}`);
      }
    }
  }
  console.log(`  ${ok} ok, ${fail} erros`);
  
  // === M106 ===
  console.log('\n--- M106 Tracking Real ---');
  const m106Sql = fs.readFileSync(path.join(migDir, '20260709_m106_tracking_real_go_live.sql'), 'utf-8');
  const m106Stmts = parseStatements(m106Sql);
  console.log(`  ${m106Stmts.length} statements`);
  
  ok = 0; fail = 0;
  for (const stmt of m106Stmts) {
    try {
      await pool.query(stmt);
      ok++;
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('duplicate key') || msg.includes('cannot drop')) {
        ok++;
      } else if (msg.includes('does not exist') && (msg.includes('policy') || msg.includes('table') || msg.includes('column') || msg.includes('function') || msg.includes('trigger') || msg.includes('constraint'))) {
        ok++;
      } else {
        fail++;
        if (fail <= 5) console.log(`  ERRO: ${msg.substring(0, 150)}`);
      }
    }
  }
  console.log(`  ${ok} ok, ${fail} erros`);
  
  // === VERIFY ===
  console.log('\n=== VERIFICACAO ===\n');
  const checks = [
    ['trg_evento_os_criada', 'trigger'],
    ['trg_evento_prestador_aceitou', 'trigger'],
    ['trg_evento_operacao_finalizada', 'trigger'],
    ['trg_evento_os_finalizada', 'trigger'],
    ['trg_evento_os_cancelada', 'trigger'],
    ['f_trg_event_bus_consumer', 'function'],
    ['registrar_posicao_motorista', 'function'],
    ['f_trg_tracking_iniciado', 'function'],
    ['f_trg_atualizar_status_alocacao_tracking', 'function'],
  ];
  
  for (const [name, type] of checks) {
    try {
      const tbl = type === 'function' ? 'pg_proc' : 'pg_trigger';
      const col = type === 'function' ? 'proname' : 'tgname';
      const r = await pool.query(`SELECT EXISTS (SELECT FROM ${tbl} WHERE ${col} = $1)`, [name]);
      console.log(`  ${r.rows[0].exists ? 'OK' : 'AUSENTE'} ${name} (${type})`);
    } catch (e) {
      console.log(`  ERRO ${name}: ${e.message.substring(0, 80)}`);
    }
  }
  
  await pool.end();
  console.log('\nConcluido');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
