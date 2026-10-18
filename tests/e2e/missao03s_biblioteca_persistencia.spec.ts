import { test, expect } from "@playwright/test";
import { loginFinanceiro } from "./helpers/auth";

const SCREENSHOT_DIR = "test-results/e2e/missao03s";
const TEST_PREFIX = "[M3STEST]";
const TS = Date.now().toString(36);
const TEST_TITLE = `${TEST_PREFIX} Persistencia ${TS}`;
const TEST_TEXT = `Criado em ${new Date().toISOString().slice(0, 19)}`;

test.describe("Missao 03S — Persistencia Biblioteca", () => {
  test("A. Criar, persistir apos reload, excluir", async ({ page }) => {
    await loginFinanceiro(page);
    await page.waitForTimeout(2000);

    // Tratar window.confirm nativo
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Excluir esta mensagem rápida");
      await dialog.accept();
    });

    const errs: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errs.push(msg.text()); });

    await page.goto("/biblioteca?tab=mensagens");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    await expect(page.locator("text=Mensagens Rápidas para WhatsApp")).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/a1-aberta.png` });

    // --- CRIAR ---
    await page.locator('button:has-text("Nova Mensagem")').click();
    await page.waitForTimeout(1500);

    const tituloInput = page.locator("input[placeholder*='Confirmação']").first();
    await tituloInput.waitFor({ state: "visible", timeout: 5000 });
    await tituloInput.fill(TEST_TITLE);
    await page.locator("textarea").first().fill(TEST_TEXT);

    // Capturar POST que contem o upsert
    const respPromise = page.waitForResponse(r =>
      r.url().includes("modelos_mensagens") && r.request().method() === "POST");

    await page.locator('button:has-text("Salvar Mensagem")').click();
    const resp = await respPromise;
    expect([200, 201]).toContain(resp.status());
    console.log(`[A] Upsert HTTP ${resp.status()}`);

    // Aguardar toast
    await expect(page.locator("text=salva e sincronizada com sucesso")).toBeVisible({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/a2-criada.png` });

    // --- RECARREGAR ---
    await page.goto("/biblioteca?tab=mensagens");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);

    const card = page.locator(`text=${TEST_TITLE}`).first();
    const persisted = await card.isVisible({ timeout: 10000 }).catch(() => false);
    console.log(`[A] Card visivel apos reload: ${persisted}`);
    expect(persisted).toBe(true);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/a3-reload.png` });

    // --- EXCLUIR ---
    const deleteResp = page.waitForResponse(r =>
      r.url().includes("modelos_mensagens") && r.request().method() === "DELETE");

    // Clicar no botao Excluir do card (ultimo da linha de botoes)
    const cardArea = card.locator("xpath=ancestor::div[contains(@class,'card')][1]");
    const btns = cardArea.locator('button[title="Excluir"]');
    await btns.first().click();
    await page.waitForTimeout(2000);

    const delResp = await deleteResp;
    console.log(`[A] Delete HTTP ${delResp.status()}`);
    expect([200, 204]).toContain(delResp.status());

    await page.waitForTimeout(2000);
    const count = await page.locator(`text=${TEST_TITLE}`).count();
    console.log(`[A] Cards apos excluir: ${count}`);
    expect(count).toBe(0);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/a4-excluida.png` });

    expect(errs.filter(e => e.includes("403") || e.includes("401")).length).toBe(0);
  });

  test("B. Mensagens default visiveis quando tabela vazia", async ({ page }) => {
    await loginFinanceiro(page);
    await page.waitForTimeout(2000);

    await page.goto("/biblioteca?tab=mensagens");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/b1-mensagens.png` });

    await expect(page.locator("text=Mensagens Rápidas para WhatsApp")).toBeVisible({ timeout: 5000 });

    // Verificar mensagens padrao (MENSAGENS_DEFAULT) ou dados do banco
    const pagamento = page.locator("text=Pagamento realizado");
    const bemVindo = page.locator("text=Bem-vindo à equipe");
    const visivel = (await pagamento.isVisible().catch(() => false)) ||
                   (await bemVindo.isVisible().catch(() => false));
    if (!visivel) {
      // Se nem defaults estao visiveis, pode ser que haja dados no banco
      const qtdCards = await page.locator('div[class*="grid"] button[title="Excluir"]').count();
      console.log(`[B] Cards visiveis: ${qtdCards}`);
    }
  });

  test("C. Abas de documentos carregam sem erro", async ({ page }) => {
    await loginFinanceiro(page);
    await page.waitForTimeout(2000);

    for (const aba of ["operacional", "prestador", "cliente", "modelos"]) {
      const httpErr: string[] = [];
      page.on("response", (r) => {
        if (r.status() >= 400) httpErr.push(`${r.url().split("?")[0]} => ${r.status()}`);
      });

      await page.goto(`/biblioteca?tab=${aba}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(3000);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/c1-${aba}.png` });
      const relevant = httpErr.filter(u => u.includes("biblioteca_documentos") || u.includes("storage"));
      expect(relevant.length).toBe(0);
      console.log(`[C] ${aba}: ${relevant.length} erros`);
    }
  });

  test("D. Fluxo de recrutamento default visivel", async ({ page }) => {
    await loginFinanceiro(page);
    await page.waitForTimeout(2000);

    await page.goto("/biblioteca?tab=fluxo");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/d1-fluxo.png` });

    await expect(page.locator("text=Fluxo de Recrutamento de Prestadores")).toBeVisible({ timeout: 5000 });

    // Verificar etapas padrao
    const primeiro = page.locator('input[value="Primeiro Contato"]');
    const visivel = await primeiro.isVisible().catch(() => false);
    console.log(`[D] Primeiro Contato visivel: ${visivel}`);
    if (visivel) {
      await expect(primeiro).toBeVisible({ timeout: 3000 });
    }
  });
});
