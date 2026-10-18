/**
 * AUDITORIA COMPLETA DA PRODUÇÃO
 * 
 * Verifica: triggers, functions, RPCs, extensões, publicações, contagem de registros
 * 
 * Uso: node scripts/audit_production_full.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL nao definida'); process.exit(1); }

const client = new pg.Client({ 
  connectionString: DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log('  OK: ' + message); passed++; }
  else { console.log('  FAIL: ' + message); failed++; }
}

function separator(title) {
  console.log('');
  console.log('='.repeat(80));
  console.log('  ' + title);
  console.log('='.repeat(80));
}

async function main() {
  await client.connect();
  console.log('Conectado a producao\n');

  // ====================================================
  // 1. ALL TRIGGERS, GROUPED BY TABLE, WITH STATUS
  // ====================================================
  separator('1. TRIGGERS - Todos (nao internos) agrupados por tabela');

  const q1 = "SELECT tgrelid::regclass::text AS tabela, tgname, tgenabled, CASE WHEN tgenabled = 'O' THEN 'ENABLED (origin)' WHEN tgenabled = 'D' THEN 'DISABLED' WHEN tgenabled = 'A' THEN 'ENABLED (always)' WHEN tgenabled = 'R' THEN 'ENABLED (replica)' WHEN tgenabled = 'S' THEN 'ENABLED (always, session)' ELSE tgenabled END AS status_desc, pg_get_triggerdef(oid) AS definicao FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgrelid::regclass::text, tgname";
  const { rows: triggers } = await client.query(q1);
  const triggerCount = triggers.length;
  console.log('\n  Total de triggers nao-internos encontrados: ' + triggerCount);

  const byTable = {};
  for (const t of triggers) {
    if (!byTable[t.tabela]) byTable[t.tabela] = [];
    byTable[t.tabela].push(t);
  }
  const tableNames = Object.keys(byTable).sort();
  console.log('  Tabelas com triggers: ' + tableNames.length + '\n');

  for (const tbl of tableNames) {
    console.log('  --- ' + tbl + ' (' + byTable[tbl].length + ' triggers) ---');
    for (const t of byTable[tbl]) {
      console.log('     TRIGGER: ' + t.tgname);
      console.log('     STATUS:   ' + t.status_desc);
      console.log('     DEF:      ' + t.definicao);
      console.log('');
    }
  }
  assert(triggerCount > 0, 'Triggers existem no banco');

  // ====================================================
  // 2. ALL FUNCTIONS/RPCs IN PUBLIC SCHEMA
  // ====================================================
  separator('2. FUNCTIONS / RPCs - Todas no schema public');

  const q2 = "SELECT p.proname, CASE p.prolang WHEN 13 THEN 'plpgsql' WHEN 12 THEN 'internal' WHEN 11 THEN 'c' WHEN 1 THEN 'sql' ELSE p.prolang::text END AS linguagem, p.prosecdef AS security_definer, p.pronargs AS num_args, pg_get_functiondef(p.oid) AS definicao FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f' ORDER BY p.proname";
  const { rows: functions } = await client.query(q2);
  console.log('\n  Total de funcoes no schema public: ' + functions.length + '\n');
  for (const f of functions) {
    console.log('  FUNCAO: ' + f.proname);
    console.log('  LING:   ' + f.linguagem);
    console.log('  SECDEF: ' + f.security_definer);
    console.log('  ARGS:   ' + f.num_args);
    const defStr = f.definicao || '';
    console.log('  DEF:    ' + defStr.substring(0, 300) + '...');
    console.log('');
  }
  assert(functions.length > 0, 'Funcoes existem no schema public');

  // ====================================================
  // 3. CHECK SPECIFIC RPCs
  // ====================================================
  separator('3. RPCs ESPECIFICAS - Validacao de existencia + SQL');

  const rpcsToCheck = [
    'registrar_posicao_motorista',
    'converter_pedido_para_os',
    'f_trg_propagar_financeiro_alocacao',
    'current_tenant_id_safe',
    'f_obter_cliente_id_do_usuario',
    'f_usuario_pode_acessar_cliente',
    'gerar_numero_pedido',
    'trg_cancelar_financeiro_escala'
  ];

  for (const rpcName of rpcsToCheck) {
    const q3 = "SELECT p.proname, CASE p.prolang WHEN 13 THEN 'plpgsql' WHEN 1 THEN 'sql' ELSE p.prolang::text END AS linguagem, p.prosecdef, p.pronargs, length(p.prosrc) AS body_length, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = $1";
    const { rows: found } = await client.query(q3, [rpcName]);

    if (found.length > 0) {
      const f = found[0];
      const hasSecurityRisk = f.prosecdef === true;
      console.log('  OK: ' + rpcName + ' - ENCONTRADA');
      console.log('     Linguagem: ' + f.linguagem + ', Args: ' + f.pronargs + ', Body: ' + f.body_length + ' chars');
      console.log('     SECURITY DEFINER: ' + f.prosecdef + (hasSecurityRisk ? ' (risco de escalacao de privilegio!)' : ''));
      
      const body = f.prosrc || '';
      const hasAuthUserId = body.includes('auth_user_id');
      const hasUserId = body.includes('user_id');
      const hasTenantUsuarios = body.includes('tenant_usuarios');
      
      if (hasAuthUserId && !hasUserId) console.log('     ATENCAO: Contem auth_user_id mas nao user_id');
      if (hasTenantUsuarios) console.log('     INFO: Referencia tenant_usuarios');
      
      if (f.linguagem === 'plpgsql') {
        assert(body.toLowerCase().includes('begin'), rpcName + ' tem bloco BEGIN');
        assert(body.toLowerCase().includes('end'), rpcName + ' tem bloco END');
      }
      
      const bodyLower = body.toLowerCase();
      const sqlOps = [];
      if (bodyLower.includes('select')) sqlOps.push('SELECT');
      if (bodyLower.includes('insert')) sqlOps.push('INSERT');
      if (bodyLower.includes('update')) sqlOps.push('UPDATE');
      if (bodyLower.includes('delete')) sqlOps.push('DELETE');
      console.log('     Operacoes SQL: ' + (sqlOps.join(', ') || 'nenhuma'));
      
      assert(f.body_length > 20, rpcName + ' tem corpo SQL valido (>20 chars)');
    } else {
      console.log('  FAIL: ' + rpcName + ' - NAO ENCONTRADA no schema public');
      failed++;
    }
  }

  // ====================================================
  // 4. SCHEDULED EVENTS
  // ====================================================
  separator('4. EVENTOS AGENDADOS - pg_cron / pg_timetable');

  try {
    const q4 = "SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname FROM cron.job ORDER BY jobid";
    const { rows: cronJobs } = await client.query(q4);
    if (cronJobs.length > 0) {
      console.log('\n  pg_cron jobs encontrados: ' + cronJobs.length + '\n');
      for (const j of cronJobs) {
        console.log('  JOB #' + j.jobid + ': ' + (j.jobname || '(sem nome)'));
        console.log('     Schedule: ' + j.schedule);
        const cmd = j.command || '';
        console.log('     Command:  ' + cmd.substring(0, 200));
        console.log('     Active:   ' + j.active);
        console.log('     DB:       ' + j.database);
        console.log('');
      }
    } else {
      console.log('  pg_cron esta instalado mas NENHUM job agendado');
    }
  } catch (e) {
    if (e.message.includes('relation "cron.job" does not exist')) {
      console.log('  pg_cron NAO esta instalado');
    } else {
      console.log('  Erro ao consultar pg_cron: ' + e.message);
    }
  }

  try {
    const q4b = "SELECT task_id, task_name, task_type, run_at, run_interval, active, kind FROM timetable.task ORDER BY task_id LIMIT 20";
    const { rows: ttTasks } = await client.query(q4b);
    if (ttTasks.length > 0) {
      console.log('\n  pg_timetable tasks encontradas: ' + ttTasks.length + '\n');
      for (const t of ttTasks) {
        console.log('  TASK #' + t.task_id + ': ' + t.task_name);
        console.log('     Type:     ' + t.task_type);
        console.log('     Run at:   ' + t.run_at);
        console.log('     Interval: ' + t.run_interval);
        console.log('     Active:   ' + t.active);
        console.log('');
      }
    } else {
      console.log('  pg_timetable NAO tem tasks cadastradas');
    }
  } catch (e) {
    if (e.message.includes('does not exist')) {
      console.log('  pg_timetable NAO esta instalado');
    } else {
      console.log('  Erro ao consultar pg_timetable: ' + e.message);
    }
  }

  const q4c = "SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron', 'pg_timetable')";
  const { rows: schedExts } = await client.query(q4c);
  if (schedExts.length > 0) {
    for (const e of schedExts) {
      console.log('  ' + e.extname + ' versao ' + e.extversion + ' instalado');
    }
  } else {
    console.log('  Nenhum scheduler extension (pg_cron/pg_timetable) instalado');
  }

  // ====================================================
  // 5. EXTENSIONS INSTALLED
  // ====================================================
  separator('5. EXTENSOES INSTALADAS');

  const q5 = "SELECT extname, extversion, extrelocatable, extconfig IS NOT NULL AS has_config FROM pg_extension ORDER BY extname";
  const { rows: extensions } = await client.query(q5);
  console.log('\n  Total de extensoes instaladas: ' + extensions.length + '\n');
  for (const e of extensions) {
    console.log('  PKG ' + e.extname + ' v' + e.extversion + ' (relocatable: ' + e.extrelocatable + ', config: ' + e.has_config + ')');
  }
  assert(extensions.length > 0, 'Extensoes instaladas');

  // ====================================================
  // 6. PUBLICATIONS (Supabase Realtime)
  // ====================================================
  separator('6. PUBLICACOES - Supabase Realtime');

  const q6 = "SELECT p.pubname, p.pubowner::regrole::text AS owner, p.puballtables, p.pubinsert, p.pubupdate, p.pubdelete, p.pubtruncate, (SELECT string_agg(c.relname, ', ' ORDER BY c.relname) FROM pg_class c JOIN pg_publication_rel pr ON pr.prrelid = c.oid WHERE pr.prpubid = p.oid) AS tables FROM pg_publication p ORDER BY p.pubname";
  const { rows: publications } = await client.query(q6);
  console.log('\n  Total de publicacoes: ' + publications.length + '\n');
  for (const p of publications) {
    console.log('  PUB ' + p.pubname);
    console.log('     Owner:      ' + p.owner);
    console.log('     All tables: ' + p.puballtables);
    console.log('     Insert:     ' + p.pubinsert);
    console.log('     Update:     ' + p.pubupdate);
    console.log('     Delete:     ' + p.pubdelete);
    console.log('     Truncate:   ' + p.pubtruncate);
    if (p.tables) {
      console.log('     Tables:     ' + p.tables);
    } else if (!p.puballtables) {
      console.log('     Tables:     (none explicitly listed)');
    } else {
      console.log('     Tables:     (all tables)');
    }
    console.log('');
  }

  const realtimePub = publications.find(p => p.pubname === 'supabase_realtime');
  if (realtimePub) {
    console.log('  Publicacao supabase_realtime encontrada');
    if (realtimePub.tables) {
      const tableList = realtimePub.tables.split(', ');
      console.log('     Tabelas na publicacao: ' + tableList.length);
      for (const tbl of tableList) {
        console.log('       - ' + tbl);
      }
    }
  } else {
    console.log('  Publicacao supabase_realtime NAO encontrada');
  }
  assert(publications.length > 0, 'Publicacoes existem');

  // ====================================================
  // 7. RECORD COUNTS PER TABLE
  // ====================================================
  separator('7. CONTAGEM DE REGISTROS - Todas as tabelas');

  const q7 = "SELECT c.relname AS tabela, c.reltuples::bigint AS estimado, pg_size_pretty(pg_total_relation_size(c.oid)) AS tamanho, obj_description(c.oid) AS descricao FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT LIKE 'pg_%' AND c.relname != 'spatial_ref_sys' ORDER BY c.relname";
  const { rows: tables } = await client.query(q7);
  console.log('\n  Total de tabelas: ' + tables.length + '\n');

  for (const t of tables) {
    try {
      const qCount = "SELECT COUNT(*)::int AS cnt FROM " + t.tabela;
      const { rows: countResult } = await client.query(qCount);
      const exactCount = countResult[0].cnt;
      console.log('  TABLE ' + t.tabela + ' | EXATO: ' + exactCount + ' | ESTIMADO: ' + t.estimado + ' | TAMANHO: ' + t.tamanho);
    } catch (err) {
      console.log('  TABLE ' + t.tabela + ' | ERRO: ' + err.message.substring(0, 100));
    }
  }

  // ====================================================
  // SUMMARY
  // ====================================================
  separator('RESUMO FINAL');

  console.log('');
  console.log('  Visao Geral da Producao (uwrvzsjtpgaifkktpepn.supabase.co):');
  console.log('  ------------------------------------------------------------');
  console.log('  Triggers:          ' + triggers.length + ' triggers nao-internos em ' + tableNames.length + ' tabelas');
  console.log('  Funcoes/RPCs:      ' + functions.length + ' funcoes no schema public');
  console.log('  Extensoes:         ' + extensions.length + ' extensoes instaladas');
  console.log('  Publicacoes:       ' + publications.length + ' publicacoes configuradas');
  console.log('  Tabelas:           ' + tables.length + ' tabelas no schema public');
  console.log('');

  console.log('');
  console.log('='.repeat(50));
  console.log('ASSERTS: ' + passed + ' passed, ' + failed + ' failed');
  console.log('='.repeat(50));

  await client.end();
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
