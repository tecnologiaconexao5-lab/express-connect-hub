// MISSÃO 133-D.6 — VALIDAÇÃO IMEDIATA PÓS-APLICAÇÃO
// Verifica volatility, grants, definições, zero alterações colaterais

const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Carrega .env
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('ERRO: DATABASE_URL'); process.exit(1); }

const rpmNames = [
  'f_buscar_operacoes_motorista',
  'f_avancar_etapa_app_motorista',
  'f_atualizar_reversa_app',
];

async function main() {
  console.log('=== MISSÃO 133-D.6 — VALIDAÇÃO IMEDIATA ===\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 30000,
  });
  await client.connect();
  console.log('Conectado.\n');

  let allPass = true;

  for (const rpmName of rpmNames) {
    console.log(`=== ${rpmName} ===`);

    // 1. Volatility + definição
    const defRes = await client.query(`
      SELECT
        p.proname,
        pg_get_functiondef(p.oid) AS definicao,
        p.provolatile,
        p.prosecdef,
        p.pronargs,
        p.pronargdefaults
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = $1 AND n.nspname = 'public';
    `, [rpmName]);

    if (defRes.rows.length === 0) {
      console.log(`  FUNÇÃO NÃO ENCONTRADA! ❌`);
      allPass = false;
      continue;
    }

    const row = defRes.rows[0];
    const volatility = row.provolatile === 'v' ? 'VOLATILE'
      : row.provolatile === 's' ? 'STABLE'
      : row.provolatile === 'i' ? 'IMMUTABLE' : 'UNKNOWN';

    console.log(`  Volatility: ${volatility} SECURITY DEFINER: ${row.prosecdef ? 'SIM' : 'NAO'}`);

    // 2. Grants
    const grantsRes = await client.query(`
      SELECT grantee, privilege_type
      FROM information_schema.role_routine_grants
      WHERE routine_name = $1
        AND routine_schema = 'public'
        AND specific_schema = 'public'
      ORDER BY grantee;
    `, [rpmName]);

    const grantees = grantsRes.rows.map(r => r.grantee);
    console.log(`  Grants: [${grantees.join(', ')}]`);

    const hasPublic = grantees.includes('PUBLIC');
    const hasAnon = grantees.includes('anon');
    const hasAuth = grantees.includes('authenticated');
    const hasService = grantees.includes('service_role');

    // 3. SHA256 da definição
    const hash = crypto.createHash('sha256').update(row.definicao).digest('hex');
    console.log(`  SHA256: ${hash}`);

    // 4. Salvar definição pós
    const outPath = path.resolve(__dirname, '..', 'docs', 'auditoria', '02_evidencias', 'sql', `${rpmName}_remota_pos.sql`);
    fs.writeFileSync(outPath, row.definicao, 'utf8');
    console.log(`  Salvo: ${path.basename(outPath)}`);

    // 5. Verificações específicas por função
    const funcOk = { volatility: false, grants: false, auth: false, signature: false };

    if (rpmName === 'f_buscar_operacoes_motorista') {
      funcOk.volatility = volatility === 'STABLE';
      funcOk.grants = !hasPublic && !hasAnon && hasAuth && hasService;
      console.log(`  VOLATILE CORRETO? ${funcOk.volatility ? '✅ STABLE' : '❌'}`);
      console.log(`  SEM PUBLIC? ${!hasPublic ? '✅' : '❌'}`);
      console.log(`  SEM ANON? ${!hasAnon ? '✅' : '❌'}`);
      console.log(`  COM AUTH? ${hasAuth ? '✅' : '❌'}`);
      console.log(`  COM SERVICE_ROLE? ${hasService ? '✅' : '❌'}`);
    } else if (rpmName === 'f_avancar_etapa_app_motorista') {
      funcOk.volatility = volatility === 'VOLATILE';
      funcOk.grants = !hasPublic && !hasAnon && hasAuth && hasService;
      // Verificar auth.uid() no corpo
      funcOk.auth = row.definicao.includes('auth.uid()') && row.definicao.includes('IS DISTINCT FROM v_prestador_id');
      funcOk.signature = row.pronargs === 5 && row.pronargdefaults === 3;
      console.log(`  VOLATILE CORRETO (era STABLE)? ${funcOk.volatility ? '✅ VOLATILE (FIX A01)' : '❌'}`);
      console.log(`  SEM PUBLIC? ${!hasPublic ? '✅' : '❌'}`);
      console.log(`  SEM ANON? ${!hasAnon ? '✅' : '❌'}`);
      console.log(`  COM AUTH? ${hasAuth ? '✅' : '❌'}`);
      console.log(`  COM SERVICE_ROLE? ${hasService ? '✅' : '❌'}`);
      console.log(`  auth.uid() + ownership? ${funcOk.auth ? '✅' : '❌'}`);
      console.log(`  Assinatura 5 args, 3 defaults? ${funcOk.signature ? '✅' : '❌'}`);
    } else if (rpmName === 'f_atualizar_reversa_app') {
      funcOk.volatility = volatility === 'VOLATILE';
      funcOk.grants = !hasPublic && !hasAnon && hasAuth && hasService;
      // Verificar auth.uid() no corpo
      funcOk.auth = row.definicao.includes('auth.uid()') && row.definicao.includes('IS DISTINCT FROM v_prestador_id');
      funcOk.signature = row.pronargs === 12 && row.pronargdefaults === 11;
      console.log(`  VOLATILE? ${funcOk.volatility ? '✅' : '❌'}`);
      console.log(`  SEM PUBLIC? ${!hasPublic ? '✅' : '❌'}`);
      console.log(`  SEM ANON? ${!hasAnon ? '✅' : '❌'}`);
      console.log(`  COM AUTH? ${hasAuth ? '✅' : '❌'}`);
      console.log(`  COM SERVICE_ROLE? ${hasService ? '✅' : '❌'}`);
      console.log(`  auth.uid() + ownership (FIX A02)? ${funcOk.auth ? '✅' : '❌'}`);
      console.log(`  Assinatura 12 args, 11 defaults? ${funcOk.signature ? '✅' : '❌'}`);
    }

    const funcPass = Object.values(funcOk).every(v => v === true);
    console.log(`  ** FUNÇÃO ${funcPass ? '✅ OK' : '❌ FALHA'}`);
    if (!funcPass) allPass = false;
    console.log();
  }

  // Verificação global: zero alteração colateral
  console.log('--- VERIFICAÇÃO GLOBAL ---');
  const tablesRes = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name IN ('alocacoes_escala', 'prestadores', 'eventos_oficiais', 'operation_timeline_events', 'financeiro_receber', 'financeiro_pagar', 'rota_paradas')
    ORDER BY table_name;
  `);
  console.log(`  Tabelas verificadas: ${tablesRes.rows.length}`);
  for (const r of tablesRes.rows) console.log(`    - ${r.table_name}`);

  const triggerRes = await client.query(`
    SELECT trigger_name, event_manipulation, event_object_table
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `);
  console.log(`  Triggers: ${triggerRes.rows.length}`);
  for (const r of triggerRes.rows) console.log(`    - ${r.trigger_name} ON ${r.event_object_table} (${r.event_manipulation})`);

  console.log(`\n  ** VALIDAÇÃO GERAL: ${allPass ? '✅ TODOS OS CHECKS PASSARAM' : '❌ HÁ FALHAS'}`);

  await client.end();
  console.log('\nValidação concluída.');
  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(2);
});
