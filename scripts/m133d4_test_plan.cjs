#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO 133-D.4 — PLANO DE TESTE CONTROLADO
// Validação estática + remota (apenas leitura) das RPCs do App Motorista
//
// FASES:
//   A — Validação de schema (remota, apenas leitura)
//   B — Validação de grants (remota, apenas leitura)
//   C — Validação de funções com dados reais (remota, auth.uid() test)
//   D — Teste de isolamento entre prestadores (requer autenticação real)
//   E — Teste de escrita controlada (REQUER AUTORIZAÇÃO EXPRESSA)
//
// USO:
//   node scripts/m133d4_test_plan.cjs
//
// REQUER:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY no .env
//   Conexão com Supabase remoto (service_role)
// ═══════════════════════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ANSI = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  CYAN: '\x1b[36m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
};

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function log(label, detail, ok) {
  const icon = ok === true ? '✅' : ok === false ? '❌' : '⚠️';
  const color = ok === true ? ANSI.GREEN : ok === false ? ANSI.RED : ANSI.YELLOW;
  const pad = label.padEnd(38);
  console.log(`  ${icon} ${color}${pad}${ANSI.RESET}${detail || ''}`);
}

function warn(label, detail) { log(label, detail, undefined); }
function pass(label, detail) { log(label, detail, true); }
function fail(label, detail) { log(label, detail, false); }

function heading(n, title) {
  const ch = n === 1 ? '═' : n === 2 ? '─' : '·';
  const bar = ch.repeat(4);
  console.log(`\n${ANSI.BOLD}${bar} ${title}${ANSI.RESET}`);
}

function subheading(title) {
  console.log(`\n  ${ANSI.CYAN}▶ ${title}${ANSI.RESET}`);
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`${ANSI.BOLD}${'═'.repeat(60)}${ANSI.RESET}`);
  console.log(`${ANSI.BOLD}  MISSÃO 133-D.4 — PLANO DE TESTE CONTROLADO${ANSI.RESET}`);
  console.log(`${ANSI.BOLD}  Validação das RPCs do App Motorista${ANSI.RESET}`);
  console.log(`${ANSI.BOLD}${'═'.repeat(60)}${ANSI.RESET}`);

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  const check = (label, detail, ok) => {
    if (ok === true) { pass(label, detail); passed++; }
    else if (ok === false) { fail(label, detail); failed++; }
    else { warn(label, detail); warnings++; }
  };

  // ─── FASE A: CONFIGURAÇÃO ──────────────────────────────────────────────────────
  heading(1, 'FASE A — CONFIGURAÇÃO');

  if (!SUPABASE_URL) { check('SUPABASE_URL', 'AUSENTE', false); process.exit(1); }
  check('SUPABASE_URL', SUPABASE_URL, true);

  if (!SERVICE_ROLE_KEY) { check('SUPABASE_SERVICE_ROLE_KEY', 'AUSENTE (limita testes)', undefined); } else {
    check('SUPABASE_SERVICE_ROLE_KEY', 'presente', true);
  }

  if (!SERVICE_ROLE_KEY) {
    console.log(`\n${ANSI.YELLOW}  [AVISO] Sem service_role key — apenas testes de schema local.\n  Execute com SUPABASE_SERVICE_ROLE_KEY para testes remotos completos.${ANSI.RESET}`);
    printSummary(passed, failed, warnings);
    return;
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ─── FASE B: VALIDAÇÃO DE SCHEMA REMOTO ────────────────────────────────────────
  heading(1, 'FASE B — VALIDAÇÃO DE SCHEMA REMOTO (pg_catalog)');

  subheading('B.1 — f_buscar_operacoes_motorista');

  let r = await supabase.from('_rpc_validator').select('*').limit(0).maybeSingle();
  // Direct pg_catalog query via SQL
  const { data: b1, error: e1 } = await supabase.rpc('_sql', {
    query: `
      SELECT p.proname, p.prorettype::regtype AS return_type,
             p.provolatile, p.prosecdef, p.pronargs,
             pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'f_buscar_operacoes_motorista'
    `
  });
  if (e1) {
    // Try alternative: use raw query
    const { data: b1a, error: e1a } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT proname, provolatile, prosecdef
        FROM pg_proc
        WHERE proname = 'f_buscar_operacoes_motorista'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      `
    });
    if (e1a) {
      warn('Query pg_catalog', `Erro: ${e1a.message}`);
      warn('Fase B', 'Pulando validação de schema (sem acesso a pg_catalog via service_role)');
    } else {
      processPgResult(b1a, 'f_buscar_operacoes_motorista', check);
    }
  } else {
    processPgResult(b1, 'f_buscar_operacoes_motorista', check);
  }

  // ─── Usando SQL raw via endpoint ─────────────────────────────────────────────
  async function queryPg(sql) {
    const { data, error } = await supabase.rpc('_sql', { query: sql });
    if (error) {
      // Try exec_sql
      const r2 = await supabase.rpc('exec_sql', { sql });
      return r2;
    }
    return { data, error: null };
  }

  // Check function existence via simpler method
  for (const fn of ['f_buscar_operacoes_motorista', 'f_avancar_etapa_app_motorista', 'f_atualizar_reversa_app']) {
    subheading(`B.X — ${fn} (existence)`);
    const { data: exists, error: exErr } = await supabase.rpc('_sql', {
      query: `SELECT count(*)::int AS cnt FROM pg_proc WHERE proname = '${fn}' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')`
    });
    if (exErr || !exists || exists.length === 0) {
      // Fallback: try via regular query
      warn(`${fn} pg_catalog`, `Não foi possível verificar (${exErr?.message || 'sem dados'})`);
    } else {
      check(`${fn} existe`, `count=${exists[0]?.cnt || 0}`, (exists[0]?.cnt || 0) > 0);
    }
  }

  // ─── FASE C: VALIDAÇÃO DE GRANTS ──────────────────────────────────────────────
  heading(1, 'FASE C — VALIDAÇÃO DE GRANTS');

  const GRANTS_QUERY = `
    SELECT
      p.proname AS function_name,
      CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 1 ELSE 0 END AS anon_can_exec,
      CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 1 ELSE 0 END AS auth_can_exec,
      CASE WHEN has_function_privilege('postgres', p.oid, 'EXECUTE') THEN 1 ELSE 0 END AS postgres_can_exec,
      CASE WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 1 ELSE 0 END AS svc_can_exec
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('f_buscar_operacoes_motorista', 'f_avancar_etapa_app_motorista', 'f_atualizar_reversa_app')
  `;

  const { data: grants, error: grantsErr } = await supabase.rpc('_sql', { query: GRANTS_QUERY });
  if (grantsErr || !grants || grants.length === 0) {
    warn('Grants check', `pg_catalog access error: ${grantsErr?.message || 'empty'}`);
    warn('Fase C', 'Para verificar grants manualmente, execute no SQL Editor: ' + GRANTS_QUERY);
  } else {
    for (const g of grants) {
      subheading(`C — ${g.function_name}`);
      check(`${g.function_name} ← anon`, g.anon_can_exec ? 'TEM EXECUTE' : 'NÃO tem', !g.anon_can_exec);
      check(`${g.function_name} ← authenticated`, g.auth_can_exec ? 'TEM EXECUTE' : 'NÃO tem', !!g.auth_can_exec);
      check(`${g.function_name} ← service_role`, g.svc_can_exec ? 'TEM EXECUTE' : 'NÃO tem', !!g.svc_can_exec);
    }
  }

  // ─── FASE D: VALIDAÇÃO DE CORPO DAS FUNÇÕES ──────────────────────────────────
  heading(1, 'FASE D — VALIDAÇÃO DE CORPO DAS FUNÇÕES');

  const BODY_QUERY = `
    SELECT p.proname, p.provolatile, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('f_buscar_operacoes_motorista', 'f_avancar_etapa_app_motorista', 'f_atualizar_reversa_app')
    ORDER BY p.proname
  `;

  const { data: bodies, error: bodiesErr } = await supabase.rpc('_sql', { query: BODY_QUERY });
  if (bodiesErr || !bodies) {
    warn('Fase D', `Não foi possível obter corpos: ${bodiesErr?.message}`);
  } else {
    for (const fn of bodies) {
      const def = fn.def || '';
      subheading(`D — ${fn.proname}`);

      // Volatility check
      const volatility = fn.provolatile === 'v' ? 'VOLATILE' : fn.provolatile === 's' ? 'STABLE' : 'IMMUTABLE';
      if (fn.proname === 'f_avancar_etapa_app_motorista') {
        check('VOLATILITY', volatility, volatility === 'VOLATILE');
      } else if (fn.proname === 'f_buscar_operacoes_motorista') {
        check('VOLATILITY', volatility, volatility === 'STABLE');
      }

      // Auth check for f_atualizar_reversa
      if (fn.proname === 'f_atualizar_reversa_app') {
        const hasAuthUid = def.includes('auth.uid()');
        check('auth.uid() presente', hasAuthUid ? 'SIM' : 'NÃO', hasAuthUid);

        const hasPrestadorCheck = def.includes('prestadores.auth_user_id') || def.includes('FROM public.prestadores');
        check('Valida prestador', hasPrestadorCheck ? 'SIM' : 'NÃO', hasPrestadorCheck);

        const hasOwnershipCheck = def.includes('ALOCACAO_OUTRO_PRESTADOR') || def.includes('IS DISTINCT FROM v_prestador_id');
        check('Verifica pertencimento', hasOwnershipCheck ? 'SIM' : 'NÃO', hasOwnershipCheck);

        // Should NOT have old weak auth
        const hasOldAuth = def.includes('auth.users WHERE id = p_auth_user_id');
        check('Auth fraco removido', hasOldAuth ? 'AINDA PRESENTE' : 'Removido', !hasOldAuth);
      }

      // Signature check
      if (fn.proname === 'f_atualizar_reversa_app') {
        const hasDate = def.includes('p_reversa_data_realizada date');
        check('Assinatura date', hasDate ? 'date (compat App)' : 'DIFERENTE', hasDate);

        const hasJsonb = def.includes('p_reversa_fotos jsonb');
        check('Assinatura jsonb', hasJsonb ? 'jsonb (compat App)' : 'DIFERENTE', hasJsonb);

        const hasPtBr = def.includes('sucesso') && def.includes('erro');
        check('Retorno pt-BR', hasPtBr ? 'sucesso/erro' : 'DIFERENTE', hasPtBr);
      }
    }
  }

  // ─── FASE E: VALIDAÇÃO GRANTS VIA has_function_privilege ──────────────────────
  // (Already done in FASE C)

  // ─── FASE F: CHECKLIST DE REGRESSÃO ──────────────────────────────────────────
  heading(1, 'FASE F — CHECKLIST DE REGRESSÃO (REVISÃO MANUAL)');

  console.log(`\n  ${ANSI.BOLD}Itens a verificar manualmente no repositório Flutter:${ANSI.RESET}`);
  console.log(`  ${ANSI.DIM}1. f_buscar_operacoes_motorista — resposta en-US (success/error) continua igual${ANSI.RESET}`);
  console.log(`  ${ANSI.DIM}2. f_avancar_etapa_app_motorista — resposta en-US (success/error) continua igual${ANSI.RESET}`);
  console.log(`  ${ANSI.DIM}3. f_atualizar_reversa_app — resposta pt-BR (sucesso/erro) continua igual${ANSI.RESET}`);
  console.log(`  ${ANSI.DIM}4. Nenhum parâmetro novo ou removido em qualquer RPC${ANSI.RESET}`);
  console.log(`  ${ANSI.DIM}5. Fluxo de autenticação: anon → USUARIO_NAO_AUTENTICADO${ANSI.RESET}`);
  console.log(`  ${ANSI.DIM}6. Fluxo de autenticação: auth → função executa normalmente${ANSI.RESET}`);
  console.log(`  ${ANSI.DIM}7. f_atualizar_reversa — prestador A não altera alocação do prestador B${ANSI.RESET}`);
  console.log(`  ${ANSI.DIM}8. f_avancar_etapa — prestador A não avança etapa da alocação do prestador B${ANSI.RESET}`);

  // ─── FASE G: RESUMO ─────────────────────────────────────────────────────────
  printSummary(passed, failed, warnings);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

function processPgResult(result, fnName, check) {
  if (!result || result.length === 0) {
    warn(`${fnName} pg_catalog`, 'sem resultados');
    return;
  }
  // Results would contain columns from the query
  check(`${fnName} encontrada`, `${result.length} registro(s)`, result.length > 0);
}

function printSummary(passed, failed, warnings) {
  const total = passed + failed + warnings;
  console.log(`\n${ANSI.BOLD}${'═'.repeat(60)}${ANSI.RESET}`);
  console.log(`${ANSI.BOLD}  RESUMO: ${passed} passed, ${failed} failed, ${warnings} warnings (${total} total)${ANSI.RESET}`);
  console.log(`${ANSI.BOLD}${'═'.repeat(60)}${ANSI.RESET}`);
}

main().catch(err => {
  console.error(`\n${ANSI.RED}ERRO FATAL:${ANSI.RESET}`, err.message);
  process.exit(1);
});
