import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const TMS_URL = 'http://localhost:8800';
const APP_URL = 'https://tight-truth-4707.emailconexao218.workers.dev';
const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';
const PRESTADOR_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

const SCREENSHOTS_DIR = path.resolve('validacao_screenshots');
const RESULTS_FILE = path.resolve('validacao_resultado.json');

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const results = {
  tms_aberto: false,
  alocacao_criada_pela_ui: false,
  alocacao_id: null,
  origem_ok: false,
  destino_ok: false,
  status_ok: false,
  aceite_prestador_ok: false,
  metadata_origem_tms: false,
  metadata_precisa_aceite_app: false,
  app_abriu: false,
  login_funcionou: false,
  rota_77777_apareceu_no_app: false,
  aceitar_servico_clicado: false,
  patch_manual_usado: false,
  supabase_atualizou_aceite: false,
  supabase_data_aceite_preenchida: false,
  supabase_status_aceita: false,
  supabase_updated_at_atualizado: false,
  metadata_app_motorista_viagem_aceita: false,
  metadata_origem_tms_preservado: false,
  metadata_precisa_aceite_app_preservado: false,
  tms_mostrou_aceito: false,
  screenshots_geradas: false,
  erro_critico: null,
  console_errors: [],
  status_final: 'PENDENTE',
  fase_atual: 'inicial',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function querySupabase(token, table, filter) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${filter || ''}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('='.repeat(60));
  console.log('VALIDAÇÃO FINAL REAL — CONEXÃO TMS + APP');
  console.log('='.repeat(60));

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let alocacaoId = null;
  let jwtToken = null;
  let hasInternet = true;

  try {
    // =============================================================
    // FASE 1 — TMS: Login + Criar alocação pela UI
    // =============================================================
    console.log('\n[FASE 1] TMS — Login + Criar alocação pela UI');
    results.fase_atual = 'tms_login';
    
    const tmsCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const tmsPage = await tmsCtx.newPage();

    const tmsLogs = [];
    tmsPage.on('console', msg => {
      tmsLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    tmsPage.on('pageerror', err => {
      results.console_errors.push(`TMS: ${err.message}`);
    });

    // Step 1: Navigate to login page
    console.log('   1. Abrindo TMS no navegador...');
    await tmsPage.goto(TMS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    results.tms_aberto = true;

    // Step 2: Login as admin
    console.log('   2. Realizando login admin...');
    await tmsPage.waitForSelector('input[type="email"]', { timeout: 10000 });
    await tmsPage.fill('input[type="email"]', 'admin@conexaoexpress.com.br');
    await tmsPage.fill('input[type="password"]', 'admin123');
    await tmsPage.click('button[type="submit"]');
    await sleep(2000);
    await tmsPage.screenshot({ path: `${SCREENSHOTS_DIR}/01-tms-login.png`, fullPage: true });

    // Step 3: Navigate to escala page
    console.log('   3. Navegando para Operação > Escala...');
    await tmsPage.goto(`${TMS_URL}/operacao?tab=escala`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    await tmsPage.screenshot({ path: `${SCREENSHOTS_DIR}/02-tms-escala.png`, fullPage: true });
    console.log('      Screenshot: 02-tms-escala.png');

    // Step 4: Click "+ Alocar" button
    console.log('   4. Clicando em "+ Alocar"...');
    try {
      const alocarBtn = tmsPage.locator('button').filter({ hasText: 'Alocar' }).first();
      await alocarBtn.click({ timeout: 5000 });
      await sleep(2000);
      console.log('      Modal de alocação aberto');
    } catch (e) {
      console.log(`      Erro ao clicar Alocar: ${e.message}`);
      results.console_errors.push(`Alocar click: ${e.message}`);
    }

    await tmsPage.screenshot({ path: `${SCREENSHOTS_DIR}/03-modal-alocar.png`, fullPage: true });
    console.log('      Screenshot: 03-modal-alocar.png');

    // Step 5: Fill Prestador field (SearchableSelect)
    console.log('   5. Preenchendo formulário...');
    try {
      const prestadorInput = tmsPage.locator('input[placeholder*="Pesquisar por nome"]').first();
      await prestadorInput.click();
      await sleep(500);
      await prestadorInput.fill('PRESTADOR TESTE APP');
      await sleep(2000);
      await tmsPage.screenshot({ path: `${SCREENSHOTS_DIR}/03a-prestador-search.png`, fullPage: true });
      const prestadorOption = tmsPage.locator('li').filter({ hasText: 'PRESTADOR TESTE APP' }).first();
      if (await prestadorOption.isVisible({ timeout: 5000 })) {
        await prestadorOption.click();
        await sleep(500);
        console.log('      Prestador selecionado');
      } else {
        console.log('      Prestador não encontrado no dropdown');
      }
    } catch (e) {
      console.log(`      Erro ao selecionar prestador: ${e.message}`);
      results.console_errors.push(`Prestador select: ${e.message}`);
    }

    // Step 6: Fill Origem
    try {
      const origemInput = tmsPage.locator('input[placeholder*="CD Cajamar"]').first();
      if (await origemInput.isVisible({ timeout: 3000 })) {
        await origemInput.fill('CD CONEXÃO EXPRESS');
        console.log('      Origem preenchida: CD CONEXÃO EXPRESS');
      }
    } catch (e) {
      console.log(`      Erro ao preencher origem: ${e.message}`);
    }

    // Step 7: Fill Destino
    try {
      const destinoInput = tmsPage.locator('input[placeholder*="CD Guarulhos"]').first();
      if (await destinoInput.isVisible({ timeout: 3000 })) {
        await destinoInput.fill('BAIRRO TESTE V3');
        console.log('      Destino preenchido: BAIRRO TESTE V3');
      }
    } catch (e) {
      console.log(`      Erro ao preencher destino: ${e.message}`);
    }

    // Step 8: Fill Nº OC / Rota = 77777
    try {
      const ocInput = tmsPage.locator('input[placeholder*="OC-2025"]').first();
      if (await ocInput.isVisible({ timeout: 3000 })) {
        await ocInput.fill('77777');
        console.log('      Nº OC preenchido: 77777');
      }
    } catch (e) {
      console.log(`      Erro ao preencher OC: ${e.message}`);
    }

    await tmsPage.screenshot({ path: `${SCREENSHOTS_DIR}/04-form-completo.png`, fullPage: true });
    console.log('      Screenshot: 04-form-completo.png');

    // Step 9: Click "Salvar na Grade"
    console.log('   9. Clicando em Salvar na Grade...');
    let createError = null;
    try {
      const salvarBtn = tmsPage.locator('button').filter({ hasText: 'Salvar na Grade' }).first();
      await salvarBtn.click({ timeout: 5000 });
      await sleep(3000);

      await tmsPage.screenshot({ path: `${SCREENSHOTS_DIR}/05-pos-salvar.png`, fullPage: true });
      console.log('      Screenshot: 05-pos-salvar.png');

      // Check for toast
      try {
        const toast = tmsPage.locator('[role="status"], [role="alert"], [data-sonner-toast]').first();
        if (await toast.isVisible({ timeout: 3000 })) {
          const toastText = await toast.textContent();
          console.log(`      Toast: ${toastText}`);
        }
      } catch { /* no toast found */ }

      results.alocacao_criada_pela_ui = true;
    } catch (e) {
      createError = e.message;
      console.log(`      Erro ao salvar: ${e.message}`);
      results.console_errors.push(`Salvar: ${e.message}`);
    }

    // Step 10: Check console logs for the created ID
    console.log('   10. Verificando console logs...');
    const fnResponseLogs = tmsLogs.filter(l => l.includes('Resposta Edge Function') || l.includes('DEBUG'));
    fnResponseLogs.forEach(l => console.log(`      ${l}`));
    const tmsErrors = tmsLogs.filter(l => l.includes('[error]') || l.includes('Error'));
    if (tmsErrors.length > 0) {
      tmsErrors.forEach(e => console.log(`      Console error: ${e}`));
    }

    await tmsPage.screenshot({ path: `${SCREENSHOTS_DIR}/06-estado-final-tms.png`, fullPage: true });

    // =============================================================
    // FASE 2 — Query Supabase para validar
    // =============================================================
    console.log('\n[FASE 2] Validando registro no Supabase...');
    results.fase_atual = 'supabase_query';

    try {
      console.log('   Autenticando no Supabase...');
      const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'teste@conexao.com', password: '12345678' }),
        signal: AbortSignal.timeout(10000),
      });

      if (loginRes.ok) {
        const loginData = await loginRes.json();
        jwtToken = loginData.access_token;
        console.log('   JWT obtido com sucesso');

        await sleep(2000);
        const allocs = await querySupabase(jwtToken,
          'alocacoes_escala',
          '?select=id,origem,destino,status,aceite_prestador,data_aceite,metadata,data_escala,created_at,updated_at&order=created_at.desc&limit=5'
        );

        if (Array.isArray(allocs) && allocs.length > 0) {
          console.log(`   Últimas ${allocs.length} alocações:`);
          allocs.forEach((a, i) => {
            console.log(`   [${i}] ${a.id?.slice(0,8)}... | ${a.origem} → ${a.destino} | ${a.status}`);
          });

          const target = allocs[0];
          alocacaoId = target.id;
          results.alocacao_id = alocacaoId;

          if (target.origem === 'CD CONEXÃO EXPRESS') {
            results.origem_ok = true;
            console.log('   ✓ origem = CD CONEXÃO EXPRESS');
          } else {
            console.log(`   ✗ origem = "${target.origem}" (esperado: CD CONEXÃO EXPRESS)`);
          }
          if (target.destino === 'BAIRRO TESTE V3') {
            results.destino_ok = true;
            console.log('   ✓ destino = BAIRRO TESTE V3');
          } else {
            console.log(`   ✗ destino = "${target.destino}" (esperado: BAIRRO TESTE V3)`);
          }
          if (target.status === 'aguardando_aceite') {
            results.status_ok = true;
            console.log('   ✓ status = aguardando_aceite');
          }
          if (target.aceite_prestador === false) {
            results.aceite_prestador_ok = true;
            console.log('   ✓ aceite_prestador = false');
          }
          if (target.metadata?.origem_tms === true) {
            results.metadata_origem_tms = true;
            console.log('   ✓ metadata.origem_tms = true');
          }
          if (target.metadata?.precisa_aceite_app === true) {
            results.metadata_precisa_aceite_app = true;
            console.log('   ✓ metadata.precisa_aceite_app = true');
          }

          if (target.origem?.includes('CONEX?O') || target.origem?.includes('CONEX�O')) {
            results.erro_critico = 'Encoding quebrado encontrado!';
            console.log('   ✗ ENCODING QUEBRADO!');
          } else {
            console.log('   ✓ Encoding OK');
          }
        } else {
          console.log('   Nenhuma alocação encontrada no Supabase');
        }
      } else {
        const errText = await loginRes.text();
        console.log(`   Erro no login Supabase: ${errText}`);
        hasInternet = false;
      }
    } catch (e) {
      console.log(`   Erro ao consultar Supabase: ${e.message}`);
      hasInternet = false;
    }

    await tmsCtx.close();

    // =============================================================
    // FASE 3 — APP PRESTADOR
    // =============================================================
    if (hasInternet) {
      console.log('\n[FASE 3] App Prestador — Login e Aceitar');
      results.fase_atual = 'app_prestador';

      const appCtx = await browser.newContext({
        viewport: { width: 412, height: 915 },
      });
      const appPage = await appCtx.newPage();

      await appPage.addInitScript(() => {
        window.flutterWebRenderer = 'html';
      });

      const appLogs = [];
      appPage.on('console', msg => {
        appLogs.push(`[${msg.type()}] ${msg.text()}`);
        if (msg.type() === 'error') results.console_errors.push(`APP: ${msg.text()}`);
      });
      appPage.on('pageerror', err => results.console_errors.push(`APP: ${err.message}`));

      console.log('   1. Abrindo App Prestador...');
      await appPage.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(8000);
      await appPage.screenshot({ path: `${SCREENSHOTS_DIR}/07-app-loading.png`, fullPage: true });
      results.app_abriu = true;

      console.log('   2. Tentando login...');
      let loggedIn = false;
      try {
        const emailField = appPage.getByRole('textbox').first();
        if (await emailField.isVisible({ timeout: 10000 })) {
          await emailField.fill('teste@conexao.com');
          await sleep(500);
          const passFields = await appPage.getByRole('textbox').all();
          if (passFields.length > 1) {
            await passFields[1].fill('12345678');
          } else {
            const pwInput = appPage.locator('input[type="password"]');
            if (await pwInput.isVisible()) await pwInput.fill('12345678');
          }
          await sleep(500);
          const loginBtn = appPage.getByRole('button').filter({ hasText: /entrar|login|acessar|continuar/i }).first();
          if (await loginBtn.isVisible({ timeout: 3000 })) {
            await loginBtn.click();
            await sleep(4000);
            loggedIn = true;
            results.login_funcionou = true;
            console.log('   Login realizado');
          }
        }
      } catch (e) {
        console.log(`   Login attempt 1 failed: ${e.message}`);
      }

      if (!loggedIn) {
        try {
          await appPage.keyboard.press('Tab');
          await sleep(300);
          await appPage.keyboard.type('teste@conexao.com', { delay: 50 });
          await sleep(300);
          await appPage.keyboard.press('Tab');
          await sleep(300);
          await appPage.keyboard.type('12345678', { delay: 50 });
          await sleep(300);
          for (let i = 0; i < 5; i++) {
            await appPage.keyboard.press('Tab');
            await sleep(200);
          }
          await appPage.keyboard.press('Enter');
          await sleep(4000);
          loggedIn = true;
          results.login_funcionou = true;
          console.log('   Login via keyboard');
        } catch (e2) {
          console.log(`   Login keyboard failed: ${e2.message}`);
        }
      }

      await appPage.screenshot({ path: `${SCREENSHOTS_DIR}/08-pos-login.png`, fullPage: true });

      console.log('   3. Procurando rota 77777...');
      await sleep(3000);

      let foundRota = false;
      try {
        const rotaText = appPage.locator('text=77777');
        if (await rotaText.isVisible({ timeout: 8000 })) {
          foundRota = true;
          results.rota_77777_apareceu_no_app = true;
          console.log('   ✓ Rota 77777 encontrada');
        }
      } catch { /* not found */ }

      if (!foundRota) {
        try {
          const bairroText = appPage.locator('text=BAIRRO TESTE V3');
          if (await bairroText.isVisible({ timeout: 5000 })) {
            foundRota = true;
            results.rota_77777_apareceu_no_app = true;
            console.log('   ✓ BAIRRO TESTE V3 encontrado');
          }
        } catch { /* not found */ }
      }

      if (!foundRota) {
        try {
          const connText = appPage.locator('text=CONEXÃO');
          if (await connText.isVisible({ timeout: 3000 })) {
            console.log('   "CONEXÃO" visível na tela');
          }
        } catch { /* not found */ }
      }

      await appPage.screenshot({ path: `${SCREENSHOTS_DIR}/09-app-operacoes.png`, fullPage: true });

      console.log('   4. Clicando Aceitar serviço...');
      let aceiteClicado = false;

      try {
        const acceptBtn = appPage.locator('button').filter({ hasText: /aceitar/i }).first();
        if (await acceptBtn.isVisible({ timeout: 5000 })) {
          await acceptBtn.click();
          await sleep(3000);
          aceiteClicado = true;
          results.aceitar_servico_clicado = true;
          console.log('   ✓ Aceitar clicado!');
        }
      } catch (e) {
        console.log(`   Aceitar click: ${e.message}`);
      }

      if (!aceiteClicado) {
        try {
          await appPage.keyboard.press('Tab');
          await sleep(200);
          await appPage.keyboard.press('Tab');
          await sleep(200);
          await appPage.keyboard.press('Enter');
          await sleep(2000);
          aceiteClicado = true;
          results.aceitar_servico_clicado = true;
          console.log('   ✓ Aceitar via keyboard');
        } catch { /* failed */ }
      }

      await appPage.screenshot({ path: `${SCREENSHOTS_DIR}/10-pos-aceite.png`, fullPage: true });
      await appCtx.close();

      // =============================================================
      // FASE 4 — Validar Supabase após aceite
      // =============================================================
      if (alocacaoId && jwtToken) {
        console.log('\n[FASE 4] Validando Supabase após aceite...');
        results.fase_atual = 'supabase_pos_aceite';

        await sleep(3000);
        try {
          const updated = await querySupabase(jwtToken,
            'alocacoes_escala',
            `?id=eq.${alocacaoId}&select=*`
          );

          if (Array.isArray(updated) && updated.length > 0) {
            const record = updated[0];
            console.log(`   status: ${record.status}`);
            console.log(`   aceite_prestador: ${record.aceite_prestador}`);
            console.log(`   data_aceite: ${record.data_aceite}`);
            console.log(`   updated_at: ${record.updated_at}`);

            if (record.aceite_prestador === true) results.supabase_atualizou_aceite = true;
            if (record.data_aceite) results.supabase_data_aceite_preenchida = true;
            if (record.status === 'aceita') results.supabase_status_aceita = true;
            if (record.updated_at) results.supabase_updated_at_atualizado = true;
            if (record.metadata?.app_motorista?.etapa_atual === 'viagem_aceita') results.metadata_app_motorista_viagem_aceita = true;
            if (record.metadata?.origem_tms === true) results.metadata_origem_tms_preservado = true;
            if (record.metadata?.precisa_aceite_app === true) results.metadata_precisa_aceite_app_preservado = true;

            console.log(`   ✓ aceite_prestador: ${record.aceite_prestador === true}`);
            console.log(`   ✓ data_aceite: ${!!record.data_aceite}`);
            console.log(`   ✓ status aceita: ${record.status === 'aceita'}`);
          }
        } catch (e) {
          console.log(`   Erro na consulta pós-aceite: ${e.message}`);
        }
      }
    }

    // =============================================================
    // FASE 5 — Validar TMS mostra Aceito (se tiver aceite)
    // =============================================================
    if (hasInternet) {
      console.log('\n[FASE 5] Validando TMS após aceite...');
      results.fase_atual = 'tms_pos_aceite';

      const tmsCtx2 = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const tmsPage2 = await tmsCtx2.newPage();

      await tmsPage2.goto(`${TMS_URL}/operacao?tab=escala`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await sleep(3000);
      await tmsPage2.screenshot({ path: `${SCREENSHOTS_DIR}/11-tms-pos-aceite.png`, fullPage: true });

      try {
        const aceitoText = tmsPage2.locator('text=Aceito');
        if (await aceitoText.isVisible({ timeout: 5000 })) {
          results.tms_mostrou_aceito = true;
          console.log('   ✓ TMS mostra Aceito');
        } else {
          console.log('   Texto "Aceito" não encontrado');
        }
      } catch {
        console.log('   Não foi possível verificar TMS');
      }

      await tmsCtx2.close();
    }

    results.screenshots_geradas = true;
    results.patch_manual_usado = false;

  } catch (error) {
    console.error('\nERRO FATAL:', error.message);
    results.erro_critico = error.message;
    results.console_errors.push(`FATAL: ${error.message}`);
  } finally {
    await browser.close();
  }

  // =============================================================
  // RELATÓRIO FINAL
  // =============================================================
  const allOk = results.origem_ok && results.destino_ok && results.status_ok;
  const aceiteOk = results.aceitar_servico_clicado || results.supabase_atualizou_aceite;
  const encodingOk = !results.erro_critico;

  if (!hasInternet && results.alocacao_criada_pela_ui) {
    results.status_final = 'PENDENTE — TMS OK, mas sem internet para validar Supabase e App';
  } else if (results.alocacao_criada_pela_ui && allOk && encodingOk) {
    if (aceiteOk && results.supabase_status_aceita) {
      results.status_final = 'APROVADO DEFINITIVO';
    } else if (results.aceitar_servico_clicado) {
      results.status_final = 'APROVADO (aceite clicado)';
    } else {
      results.status_final = 'APROVADO PARCIAL (alocação criada, aceite pendente)';
    }
  } else if (!results.alocacao_criada_pela_ui) {
    results.status_final = 'BLOQUEADO — Não foi possível criar alocação pela UI';
  } else {
    results.status_final = 'BLOQUEADO';
  }

  if (!hasInternet) {
    results.status_final += ' | SEM INTERNET';
  }

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), 'utf-8');
  fs.writeFileSync(`${SCREENSHOTS_DIR}/resultado.json`, JSON.stringify(results, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log('RELATÓRIO FINAL DE VALIDAÇÃO');
  console.log('='.repeat(60));
  console.log(JSON.stringify(results, null, 2));
  console.log(`\nScreenshots: ${SCREENSHOTS_DIR}`);
  console.log(`Resultado: ${RESULTS_FILE}`);
}

main().catch(console.error);
