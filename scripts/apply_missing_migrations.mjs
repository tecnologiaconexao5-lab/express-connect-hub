import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectDir, '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const migrations = [
  { file: 'portal_cliente_enterprise.sql', label: 'Portal Cliente Enterprise' },
  { file: '20260705_m99_event_bus_fundacao.sql', label: 'M99 - Event Bus' },
  { file: '20260707_m104_go_live_enterprise.sql', label: 'M104 - Go Live Enterprise' },
  { file: '20260709_m106_tracking_real_go_live.sql', label: 'M106 - Tracking Real' },
  { file: '20260701_portal_cliente_rls.sql', label: 'Portal Cliente RLS' },
  { file: '20260702_portal_cliente_rls_v2.sql', label: 'Portal Cliente RLS v2' },
  { file: '20260702_portal_rls_validacao.sql', label: 'Portal Cliente RLS Validacao' },
];

const migrationsDir = path.join(projectDir, 'supabase', 'migrations');

function splitSQLStatements(sql) {
  const statements = [];
  let current = '';
  let inDollar = false;
  let dollarTag = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (!inString && ch === '$') {
      const endDollar = sql.indexOf('$', i + 1);
      if (endDollar > i) {
        const tag = sql.substring(i + 1, endDollar);
        if (!inDollar) {
          dollarTag = tag;
          inDollar = true;
          current += sql.substring(i, endDollar + 1);
          i = endDollar;
          continue;
        } else if (tag === dollarTag) {
          inDollar = false;
          current += sql.substring(i, endDollar + 1);
          i = endDollar;
          continue;
        }
      }
    }

    if (!inDollar) {
      if ((ch === "'" || ch === '"') && !inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar && inString) {
        inString = false;
      }
    }

    if (ch === ';' && !inString && !inDollar) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed + ';');
      current = '';
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed + ';');
  return statements;
}

async function applyMigration(pool, file, label) {
  const filePath = path.join(migrationsDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`  File not found: ${file}`);
    return { success: false };
  }

  const sql = fs.readFileSync(filePath, 'utf-8');
  const statements = splitSQLStatements(sql);

  let successCount = 0;
  let errorCount = 0;
  let errors = [];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt || stmt.startsWith('--')) continue;
    try {
      await pool.query(stmt);
      successCount++;
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('duplicate key') || msg.includes('already been applied')) {
        successCount++;
      } else if (msg.includes('does not exist') || msg.includes('relation') && msg.includes('does not exist')) {
        errorCount++;
        errors.push({ index: i, error: msg.substring(0, 200) });
      } else {
        errorCount++;
        errors.push({ index: i, error: msg.substring(0, 200) });
      }
    }
  }

  console.log(`  ${errorCount === 0 ? 'OK' : 'ERROS'} ${successCount}/${statements.length} statements (${errorCount} errors)`);
  if (errors.length > 0) {
    for (const err of errors.slice(0, 5)) {
      console.log(`    ${err.error}`);
    }
  }
  return { success: errorCount === 0, successCount, errorCount, errors };
}

async function main() {
  console.log('=== APLICAR MIGRATIONS FALTANTES ===\n');

  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Conectado ao Supabase (' + result.rows[0].now + ')\n');
  } catch (err) {
    console.error('Erro de conexao: ' + err.message);
    await pool.end();
    process.exit(1);
  }

  for (const mig of migrations) {
    console.log('\n' + mig.label + ' (' + mig.file + ')');
    console.log('-'.repeat(50));
    const result = await applyMigration(pool, mig.file, mig.label);
  }

  console.log('\n\n=== VERIFICACAO POS-MIGRACAO ===\n');

  const checks = [
    { q: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'eventos_oficiais')", l: 'Tabela eventos_oficiais' },
    { q: "SELECT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'trg_evento_os_criada')", l: 'Trigger trg_evento_os_criada' },
    { q: "SELECT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'trg_evento_prestador_aceitou')", l: 'Trigger trg_evento_prestador_aceitou' },
    { q: "SELECT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'trg_evento_operacao_finalizada')", l: 'Trigger trg_evento_operacao_finalizada' },
    { q: "SELECT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'trg_evento_os_finalizada')", l: 'Trigger trg_evento_os_finalizada' },
    { q: "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'f_trg_event_bus_consumer')", l: 'Function f_trg_event_bus_consumer' },
    { q: "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'registrar_posicao_motorista')", l: 'RPC registrar_posicao_motorista' },
    { q: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'portal_notificacoes')", l: 'Tabela portal_notificacoes' },
    { q: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'portal_tracking_realtime')", l: 'Tabela portal_tracking_realtime' },
  ];

  for (const check of checks) {
    try {
      const r = await pool.query(check.q);
      const ok = r.rows[0].exists;
      console.log('  ' + (ok ? 'OK' : 'AUSENTE') + ' ' + check.l);
    } catch (err) {
      console.log('  ERRO ' + check.l + ': ' + err.message.substring(0, 80));
    }
  }

  await pool.end();
  console.log('\nAplicacao concluida');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
