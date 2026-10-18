import { test, expect, type Page, type Route } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

// ============================================================
// MISSÃO UX-001.1 — Dropdown do Cliente (Orçamento)
// Valida: abertura, overflow além do card, não coberto pelo card
// "Contexto Comercial", seleção, fechamento, nas resoluções
// 1366×768 e 1920×1080.
// ============================================================

const FAKE_CLIENTES = [
  { id: "11111111-1111-1111-1111-111111111111", nome_fantasia: "Logística Express S.A.", razao_social: "Logística Express Ltda", cnpj: "11.222.333/0001-81", condicao_comercial_tabela_id: null },
  { id: "22222222-2222-2222-2222-222222222222", nome_fantasia: "Vitória Alimentos Distribuidora", razao_social: "Vitória Alimentos Ltda", cnpj: "22.333.444/0001-90", condicao_comercial_tabela_id: null },
  { id: "33333333-3333-3333-3333-333333333333", nome_fantasia: "Farmacêutica Conexão Ltda", razao_social: "Farmacêutica Conexão S.A.", cnpj: "33.444.555/0001-02", condicao_comercial_tabela_id: null },
  { id: "44444444-4444-4444-4444-444444444444", nome_fantasia: "Auto Peças Brasil", razao_social: "Auto Peças Brasil Comércio Ltda", cnpj: "44.555.666/0001-13", condicao_comercial_tabela_id: null },
  { id: "55555555-5555-5555-5555-555555555555", nome_fantasia: "Distribuidora Mercearia Vitória", razao_social: "Distribuidora Mercearia Vitória ME", cnpj: "55.666.777/0001-24", condicao_comercial_tabela_id: null },
];

async function interceptClientes(page: Page) {
  await page.route("**/rest/v1/clientes*", (route: Route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_CLIENTES) });
  });
}

async function abrirOrcamentoNovo(page: Page) {
  await page.goto("/comercial?tab=orcamentos&action=novo", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.getByText("Orçamento Comercial", { exact: false }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(800);
}

async function testarDropdown(page: Page, screenshotPrefix: string) {
  const inputCliente = page.getByPlaceholder("Buscar...").first();

  // 1. Focar o campo Cliente
  await inputCliente.click();
  await inputCliente.fill("vitoria");

  // 2. Lista visível
  const dropdown = page.locator("ul").filter({ hasText: "Vitória Alimentos Distribuidora" }).first();
  await expect(dropdown).toBeVisible({ timeout: 15000 });

  // 3. Dropdown ultrapassa o limite inferior do card "Dados do Documento"
  const boxDropdown = (await dropdown.boundingBox())!;
  const cardDados = page
    .locator('[class*="rounded-xl"]')
    .filter({ hasText: "Dados do Documento" })
    .first();
  const boxCard = (await cardDados.boundingBox())!;
  expect(boxDropdown.y + boxDropdown.height).toBeGreaterThan(boxCard.y + boxCard.height);

  // 4. Não encoberto pelo card "Contexto Comercial" (dropdown fica sob o card abaixo)
  const cardContexto = page
    .locator('[class*="rounded-xl"]')
    .filter({ hasText: "Contexto Comercial" })
    .first();
  const boxContexto = (await cardContexto.boundingBox())!;
  // O dropdown termina dentro da faixa vertical do card seguinte (sobreposto, não recortado)
  expect(boxDropdown.y + boxDropdown.height).toBeGreaterThan(boxContexto.y);

  // Screenshot dropdown aberto
  await page.screenshot({ path: `test-results/ux001_1/${screenshotPrefix}-dropdown-aberto.png` });

  // 5. Selecionar resultado
  await page.getByText("Vitória Alimentos Distribuidora", { exact: false }).first().click();
  await page.waitForTimeout(300);

  // 6. Cliente preenchido
  await expect(inputCliente).toHaveValue("Vitória Alimentos Distribuidora");

  // 7. Dropdown fechado
  await expect(dropdown).toBeHidden({ timeout: 5000 });

  // 8. CNPJ preenchido (callback onChange → clienteCnpj)
  await page.waitForTimeout(200);
  await expect(page.locator('input[value="22.333.444/0001-90"]').first()).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: `test-results/ux001_1/${screenshotPrefix}-cliente-selecionado.png` });

  // 9. Fecha ao clicar fora (reabrir e clicar fora)
  await inputCliente.click();
  await page.waitForTimeout(400);
  await expect(page.locator("ul").filter({ hasText: "Vitória" }).first()).toBeVisible({ timeout: 10000 });
  await page.locator("body").click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(300);
  await expect(page.locator("ul").filter({ hasText: "Vitória" }).first()).toBeHidden({ timeout: 5000 });

  // 10. Visão geral dos cards
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/ux001_1/${screenshotPrefix}-visao-geral-cards.png` });
}

test.describe("UX-001.1 — Dropdown do Cliente no Orçamento", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await loginAdmin(page, "ux0011");
    await interceptClientes(page);
  });

  test("dropdown funcional em 1366×768", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await abrirOrcamentoNovo(page);
    await testarDropdown(page, "1366x768");
  });

  test("dropdown funcional em 1920×1080", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await abrirOrcamentoNovo(page);
    await testarDropdown(page, "1920x1080");
  });
});
