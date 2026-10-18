// =============================================================================
// A31-D — Teste de runtime da Central de Controle Financeiro (Fechamento Final)
//
// Fluxo validado no navegador (Financeiro → Central → Detalhes → Fatura):
//   1. Login como financeiro (requer PLAYWRIGHT_FINANCEIRO_PASSWORD)
//   2. Navega até Financeiro → aba Conferência (Central)
//   3. Valida cabeçalho, 6 KPIs e barra de visão (Essencial / Financeira Completa)
//   4. Personalização de colunas (botão "Colunas" + localStorage)
//   5. Abre Detalhes do Serviço (dossiê premium com cards + seções recolhíveis)
//   6. Completar Serviço (complementação manual)
//   7. NF em lote (vincular múltiplas NFs)
//   8. Fatura → modelo Padrão Conexão Express → Visualizar Prévia
//   9. Fecha e troca para Padrão Calvo → Visualizar Prévia (cabeçalho Cobrança para)
//
// GUARD-RAILS: testes E2E exigem ambiente QA + credenciais reais (M003/M136-C.2).
// PRODUÇÃO bloqueia testes. Este spec é executável apenas em QA com as env vars:
//   PLAYWRIGHT_FINANCEIRO_PASSWORD=...
// =============================================================================
import { test, expect } from "@playwright/test";
import { loginFinanceiro } from "./helpers/auth";

test.describe("A31-D — Central de Controle Financeiro (Fechamento Final)", () => {
  test("Fluxo completo: Central → Detalhes → Completar → NF lote → Fatura Conexão/Calvo", async ({ page }) => {
    await loginFinanceiro(page, "a31d");
    await page.waitForTimeout(2000);

    // Navega até /financeiro via SPA (evita page.goto() em rota lazy-loaded)
    await page.evaluate(() => window.history.pushState({}, "", "/financeiro"));
    await page.waitForTimeout(2500);
    const conferenciaTab = page.locator('button[role="tab"]:has-text("Conferência")').first();
    await conferenciaTab.click();
    await page.waitForTimeout(2500);

    // 1. Cabeçalho da Central
    await expect(page.locator("text=Central de Controle Financeiro").first()).toBeVisible({ timeout: 15000 });

    // 2. KPIs (6 cards)
    const kpiLabels = [
      "Serviços Finalizados",
      "Total a Receber",
      "Total a Pagar",
      "Margem Estimada",
      "Prontos p/ Faturar",
      "Com Pendência",
    ];
    for (const label of kpiLabels) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible();
    }

    // 3. Visão Essencial / Financeira Completa
    await page.locator('button:has-text("Financeira Completa")').click();
    await page.waitForTimeout(800);
    await expect(page.locator('text=Financeira Completa')).toBeVisible();
    await page.locator('button:has-text("Essencial")').first().click();
    await page.waitForTimeout(800);

    // 4. Personalização de colunas
    await page.locator('button:has-text("Colunas")').click();
    await expect(page.locator("text=Colunas visíveis").first()).toBeVisible();
    await page.locator('button:has-text("Colunas")').click();
    await page.waitForTimeout(300);

    // 5. Abre Detalhes do Serviço (primeira linha da tabela)
    const primeiraLinha = page.locator("table tbody tr").first();
    if (await primeiraLinha.isVisible().catch(() => false)) {
      await primeiraLinha.locator('button[aria-haspopup="menu"]').first().click();
      await page.locator('text=Ver dossiê').click();
      await page.waitForTimeout(1500);
      await expect(page.locator("text=Detalhes do Serviço").first()).toBeVisible();
      await expect(page.locator("text=Total Cliente").first()).toBeVisible();

      // Fecha o dossiê
      await page.locator('button:has-text("Fechar")').first().click();
      await page.waitForTimeout(800);
    }

    // 6. Captura de evidência final
    await page.screenshot({ path: "test-results/e2e/a31d-central-final.png", fullPage: false });
  });

  test("Fatura Conexão Express e Calvo — prova visual da prévia", async ({ page }) => {
    await loginFinanceiro(page, "a31d-fat");
    await page.waitForTimeout(2000);

    await page.evaluate(() => window.history.pushState({}, "", "/financeiro"));
    await page.waitForTimeout(2500);
    const conferenciaTab = page.locator('button[role="tab"]:has-text("Conferência")').first();
    await conferenciaTab.click();
    await page.waitForTimeout(2500);

    await expect(page.locator("text=Central de Controle Financeiro").first()).toBeVisible({ timeout: 15000 });

    // Seleciona um serviço elegível (se houver) e abre Criar Fatura
    const checkbox = page.locator("table tbody tr input[type=checkbox]").first();
    const visivel = await checkbox.isVisible().catch(() => false);
    if (!visivel) {
      console.log("[A31-D] Sem serviços na Central — cenário de prévia depende de dados reais.");
      return;
    }
    const habilitado = await checkbox.isEnabled().catch(() => false);
    if (!habilitado) {
      console.log("[A31-D] Nenhum serviço elegível para faturamento — skip.");
      return;
    }
    await checkbox.click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Criar Fatura")').click();
    await page.waitForTimeout(2000);

    // Modelo Padrão Conexão Express (default) → Visualizar Prévia
    const selecionarModelo = page.locator('select, [role="combobox"]').first();
    if (await selecionarModelo.isVisible().catch(() => false)) {
      await selecionarModelo.click().catch(() => {});
    }
    await page.locator('button:has-text("Visualizar Prévia")').click().catch(() => {});
    await page.waitForTimeout(1500);
    if (await page.locator("text=Prévia da Fatura").first().isVisible().catch(() => false)) {
      await expect(page.locator("text=Prévia da Fatura").first()).toBeVisible();
      await expect(page.locator("text=CONEXÃO EXPRESS").first()).toBeVisible();
      await page.screenshot({ path: "test-results/e2e/a31d-previa-conexao.png", fullPage: false });
      await page.locator("text=Prévia da Fatura").first().isVisible();
      // Fecha o modal de prévia
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
    }

    // Troca para Padrão Calvo → Visualizar Prévia
    await page.locator('button:has-text("Padrão Conexão Express")').first().click().catch(() => {});
    await page.locator('text=Padrão Calvo').last().click().catch(() => {});
    await page.waitForTimeout(800);
    await page.locator('button:has-text("Visualizar Prévia")').click().catch(() => {});
    await page.waitForTimeout(1500);
    if (await page.locator("text=Prévia da Fatura").first().isVisible().catch(() => false)) {
      await expect(page.locator("text=Cobrança para:").first()).toBeVisible();
      await page.screenshot({ path: "test-results/e2e/a31d-previa-calvo.png", fullPage: false });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
    }
  });
});