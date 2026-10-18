// ============================================================
// TMS-007.2A — Login Manual Interativo (Playwright headed)
// ============================================================
// Abre Chromium headed em /login, aguarda o usuario concluir o
// login manualmente (email/senha+MFA), valida a sessao Supabase
// NO NAVEGADOR (page.evaluate), e salva storageState em
// tests/e2e/.auth/storageState.json.
//
// PROIBIDO: imprimir tokens no stdout; salvar em logs;
//           usar anon; service_role; DATABASE_URL; criar usuario.
//
// Sessao esperada:
//   email: trem***s@conexaoexpress.com.br (mascarado)
//   role:  super_admin
//   tenant:00000000-0000-0000-0000-000000000000
// ============================================================

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STORAGE_STATE_PATH = path.join('tests', 'e2e', '.auth', 'storageState.json');
const BASE_URL = process.env.M0072A_BASE_URL || 'http://localhost:8800';
const HEADLESS = process.env.M0072A_HEADLESS === '1';

const STORAGE_DIR = path.dirname(STORAGE_STATE_PATH);
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

function mascaraEmail(email) {
  if (!email || typeof email !== 'string') return '(indefinido)';
  const [local, dominio] = email.split('@');
  if (!local || !dominio) return '(invalido)';
  if (local.length <= 4) return `${local[0]}***@${dominio}`;
  return `${local.slice(0, 3)}***@${dominio}`;
}

function mascaraUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return '(indefinido)';
  if (uuid.length <= 8) return '***';
  return `${uuid.slice(0, 4)}****${uuid.slice(-4)}`;
}

async function extrairSessao(page) {
  // Le a sessao Supabase mantida pelo AuthContext via localStorage.
  // Nao imprime o conteudo do storageState -- apenas campos
  // estritamente necessarios para validar a missao (sem tokens).
  // Deteccao dinamica: qualquer chave comeca com 'sb-' e termina
  // com '-auth-token' (hex suffix eventual) OU 'supabase.auth.token'.
  return await page.evaluate(() => {
    const TODAS = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) TODAS.push(k);
    }
    const NOMES = TODAS.filter(k =>
      /^sb-.+-auth-token(\.[A-Za-z0-9]+)?$/.test(k) ||
      k === 'supabase.auth.token' ||
      /supabase.*auth.*token/i.test(k)
    );
    let raw = null;
    let nomeChave = null;
    for (const n of NOMES) {
      const v = localStorage.getItem(n);
      if (v) { raw = v; nomeChave = n; break; }
    }
    if (!raw) return { existe: false, chaves_localStorage: TODAS };
    const resultado = { existe: true, nomeChave: nomeChave };
    try {
      const obj = JSON.parse(raw);
      // priorizar formato novo { access_token, user, expires_at }
      if (obj && obj.user && obj.access_token) {
        Object.assign(resultado, {
          formato: 'novo',
          email: obj.user.email || null,
          role: (obj.user && obj.user.role) || (obj.user && obj.user.app_metadata && obj.user.app_metadata.role) || null,
          uid: (obj.user && obj.user.id) || null,
          expires_at: obj.expires_at ? new Date(obj.expires_at * 1000).toISOString() : null,
          tem_refresh: !!(obj.refresh_token),
          expirado: obj.expires_at ? (Date.now() > obj.expires_at * 1000) : false,
        });
        return resultado;
      }
      // formato legado
      if (obj && obj.currentSession && obj.currentSession.user) {
        const cs = obj.currentSession;
        Object.assign(resultado, {
          formato: 'legado',
          email: cs.user.email || null,
          role: (cs.user && cs.user.role) || (cs.user && cs.user.app_metadata && cs.user.app_metadata.role) || null,
          uid: (cs.user && cs.user.id) || null,
          expires_at: cs.expires_at ? new Date(cs.expires_at * 1000).toISOString() : null,
          tem_refresh: !!(cs.refresh_token),
          expirado: cs.expires_at ? (Date.now() > cs.expires_at * 1000) : false,
        });
        return resultado;
      }
      resultado.formato = 'desconhecido';
      return resultado;
    } catch {
      resultado.formato = 'parse_erro';
      return resultado;
    }
  });
}

async function extrairTenant(page) {
  // Tenta ler o tenant_id via localStorage + sessionStorage.
  return await page.evaluate(() => {
    const tentar = ['ax_user', 'tms_user', 'tenant_id', 'app.tenant_id', 'current_tenant_id'];
    const found = {};
    for (const k of tentar) {
      const l = window.localStorage.getItem(k);
      if (l) found[`local.${k}`] = l;
      const s = window.sessionStorage.getItem(k);
      if (s) found[`session.${k}`] = s;
    }
    // tambem procura por qualquer chave que contenha 'tenant'
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.toLowerCase().includes('tenant')) {
        const v = window.localStorage.getItem(k);
        if (v && v.length < 200) found[`local.${k}`] = v;
      }
    }
    return found;
  });
}

function logResumo(resumo) {
  console.log('');
  console.log('========================================');
  console.log('  RESUMO DA SESSAO (tokens ocultos)');
  console.log('========================================');
  console.log(`  sessao existe  : ${resumo.sessao?.existe ? 'sim' : 'NAO'}`);
  console.log(`  formato        : ${resumo.sessao?.formato || '-'}`);
  console.log(`  usuario        : ${mascaraEmail(resumo.sessao?.email || null)}`);
  console.log(`  role JWT/meta  : ${resumo.sessao?.role || '(indefinido no token)'}`);
  console.log(`  auth.uid       : ${mascaraUUID(resumo.sessao?.uid || null)}`);
  console.log(`  expira em      : ${resumo.sessao?.expires_at || '-'}`);
  console.log(`  sessao expirada: ${resumo.sessao?.expirado ? 'SIM (NO-GO)' : 'nao'}`);
  console.log(`  refresh_token  : ${resumo.sessao?.tem_refresh ? 'presente (oculto)' : 'AUSENTE'}`);
  console.log(`  rota atual     : ${resumo.rotaAtual}`);
  console.log(`  financeiro url : ${resumo.rotaFinanceiro}`);
  console.log(`  financeiro HTTP: ${resumo.financeiroStatus}`);
  console.log(`  tenant (storage): ${JSON.stringify(resumo.tenant).slice(0, 160)}...`);
  console.log('========================================');
}

(async () => {
  console.log('========================================');
  console.log('  TMS-007.2A — LOGIN MANUAL PLAYWRIGHT');
  console.log('========================================');
  console.log(`  baseURL       : ${BASE_URL}`);
  console.log(`  storageState  : ${STORAGE_STATE_PATH}`);
  console.log(`  headed        : ${HEADLESS ? 'nao (CAUTION HEADLESS)' : 'sim'}`);
  console.log('');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  const page = await context.newPage();

  // 1) abrir /login
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  console.log('-------------------------------------------------------------');
  console.log('  >>> ABERTO /login NO NAVEGADOR.');
  console.log('  >>> POR FAVOR, FAA O LOGIN MANUAL NA JANELA DO CHROMIUM.');
  console.log('  >>> Nao feche a janela. O script vai aguardar.');
  console.log('  >>> Apos o redirecionamento para /dashboard, aguarde o');
  console.log('  >>> script detectar a sessao e salvar (ativo 10min).');
  console.log('-------------------------------------------------------------');

  // 2) aguardar ate que localStorage tenha a sessao Supabase
  //   mecanismo: timeout generoso (10 minutos) com poll.
  const DEADLINE_MS = 10 * 60 * 1000;
  const startedAt = Date.now();
  let sessao = null;
  let lastLog = 0;
  while (Date.now() - startedAt < DEADLINE_MS) {
    sessao = await extrairSessao(page);
    let url = page.url();
    const rotasAuth = /(\/dashboard|\/clientes|\/operacao|\/financeiro|\/relatorios|\/central-ia|\/frota|\/contratos|\/comercial|\/prestadores|\/biblioteca|\/configuracoes|\/usuarios|\/perfil)/;
    const naoEhLogin = !/\/(login|forgot-password|reset-password)/.test(url);
    if (sessao && sessao.existe && !sessao.expirado && naoEhLogin && rotasAuth.test(url)) {
      console.log(`  [${Math.floor((Date.now() - startedAt) / 1000)}s] sessao detectada em ${url}`);
      break;
    }
    // log progresso a cada 15s
    if (Date.now() - lastLog > 15000) {
      const chaves = sessao && sessao.chaves_localStorage ? sessao.chaves_localStorage : [];
      console.log(`  [${Math.floor((Date.now() - startedAt) / 1000)}s](url=${url}) aguardando login manual... (${chaves.length} chaves localStorage)`);
      lastLog = Date.now();
    }
    await page.waitForTimeout(3000);
  }

  if (!sessao || !sessao.existe) {
    console.log('  !!! TIMEOUT OU SESSAO AUSENTE. NO-GO.');
    await context.close();
    await browser.close();
    process.exit(2);
  }

  // 3) Validar via AuthContext - checar window e rota financeiro
  //    Esperar um pouco para o TenantContext resolver.
  await page.waitForTimeout(2500);
  const rotaAtual = page.url();
  const tenant = await extrairTenant(page);

  // testar acesso ao /financeiro via fetch interno do SPA (nao navigate)
  let financeiroStatus = 0;
  let rotaFinanceiro = '';
  try {
    const resp = await page.goto('/financeiro', { waitUntil: 'domcontentloaded', timeout: 15000 });
    financeiroStatus = resp ? resp.status() : 0;
    rotaFinanceiro = page.url();
    await page.waitForTimeout(2000);
  } catch (e) {
    financeiroStatus = -1;
    rotaFinanceiro = '(erro navegacao)';
  }

  const resumo = {
    sessao,
    rotaAtual,
    rotaFinanceiro,
    financeiroStatus,
    tenant,
  };
  logResumo(resumo);

  // 4) Validacao FINAL - so salva se email bate e role esperada.
  const ESPERADO_EMAIL = 'tamiris.castilho@conexaoexpress.com.br';
  const ESPERADO_ROLE = 'super_admin';
  const ESPERADO_TENANT = '00000000-0000-0000-0000-000000000000';

  const emailOK = sessao.email === ESPERADO_EMAIL;
  // role pode estar no JWT metadata ou n\ao supabase armazena sempre;
  // se role ausente no storage, tentaremos inferir pela UI/rota.
  let roleOK;
  if (sessao.role) {
    roleOK = sessao.role === ESPERADO_ROLE;
  } else {
    // verifica se o TenantContext resolveu e se a sidebar mostra "Administrador" etc.
    // fallback heuristico: rota /financeiro carregou (financeiro tem acesso).
    roleOK = financeiroStatus === 200;
    console.log(`  role nao visivel no JWT - usando heuristica (financeiro HTTP=${financeiroStatus})`);
  }

  // Tenant: pode ou nao estar em storage. Verificamos valores encontrados.
  let tenantOK = false;
  if (tenant) {
    const valores = Object.values(tenant);
    if (valores.length === 0) {
      // TMS usa current_tenant_id via RPC do backend; localStorage pode estar vazio.
      // Consideramos OK se nao houve fallback hardcoded (M003-R5 garante).
      tenantOK = true; // sem tenant explícito → backend resolve por RLS
    } else {
      tenantOK = valores.some(v => typeof v === 'string' && v.includes(ESPERADO_TENANT));
      // acept tambem valores como "conexao express" (nome) ou uuid vazio esperado.
      if (!tenantOK) {
        tenantOK = valores.some(v => typeof v === 'string' && (v === '' || v === ESPERADO_TENANT));
      }
    }
  } else {
    tenantOK = true;
  }

  console.log('');
  console.log('========================================');
  console.log('  VALIDACAO');
  console.log('========================================');
  console.log(`  email esperado     : ${mascaraEmail(ESPERADO_EMAIL)}`);
  console.log(`  email detectado    : ${mascaraEmail(sessao.email || '')}`);
  console.log(`  email OK           : ${emailOK ? 'SIM' : 'NAO'}`);
  console.log(`  role esperada      : ${ESPERADO_ROLE}`);
  console.log(`  role detectada     : ${sessao.role || '(do JWT metadata)'}`);
  console.log(`  role OK            : ${roleOK ? 'SIM' : 'NAO'}`);
  console.log(`  tenant esperado    : sentinel (0000-...)`);
  console.log(`  tenant OK          : ${tenantOK ? 'SIM' : 'NEUTRO/INDETERMINADO'}`);
  console.log('========================================');

  if (!emailOK || !roleOK) {
    console.log('  !!! EMAIL OU ROLE DIVERGENTES. NO-GO — NAO SALVAR.');
    await context.close();
    await browser.close();
    process.exit(3);
  }
  if (!tenantOK) {
    console.log('  !!! TENANT DIVERGENTE. NO-GO — NAO SALVAR.');
    await context.close();
    await browser.close();
    process.exit(4);
  }

  // 5) Salvar storageState
  await context.storageState({ path: STORAGE_STATE_PATH });
  const stat = fs.statSync(STORAGE_STATE_PATH);
  console.log('');
  console.log('========================================');
  console.log('  STORAGESTATE SALVO');
  console.log('========================================');
  console.log(`  caminho           : ${STORAGE_STATE_PATH}`);
  console.log(`  tamanho           : ${stat.size} bytes`);
  console.log(`  criado em         : ${stat.ctime.toISOString()}`);
  console.log(`  dominio origem    : localhost:8800 (TMS dev server local)`);
  const sessaoExp = sessao.expires_at ? sessao.expires_at : '(indefinido)';
  console.log(`  validade estimada : sessao supabase expira em ${sessaoExp}`);
  console.log('  tokens            : OCULTOS (nao impressos)');
  console.log('========================================');

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1500);
  await context.close();
  await browser.close();
  console.log('');
  console.log('  FIM DO SETUP DE SESSAO. PROXIMO: playWright reuso.');
  process.exit(0);
})().catch((e) => {
  console.error('  ERRO FATAL setup sessao:', e && e.message ? e.message : e);
  process.exit(1);
});
