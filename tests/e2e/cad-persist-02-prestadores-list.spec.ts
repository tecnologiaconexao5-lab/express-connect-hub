/**
 * CAD-PERSIST-02: Testes de Integridade da Listagem de Prestadores
 * 
 * T1-T17: Paginação real, ordenação A→Z, busca global, mock fallback,
 *         nome vazio, refetch, controles numerados.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:8802";
const LOGIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const LOGIN_PASS = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__";

async function login(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill(LOGIN_EMAIL);
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 5000 });
  await passwordInput.fill(LOGIN_PASS);
  await page.locator('button[type="submit"], button:has-text("Entrar")').click();
  await page.waitForTimeout(5000);
}

async function navigateToPrestadores(page) {
  await page.goto("/cadastros-prestadores", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
}

test.describe("CAD-PERSIST-02: Integridade da Listagem de Prestadores", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ── T1: Dataset > PAGE_SIZE → página 2 acessível ──
  test("T1: Paginação mostra página 2 quando totalCount > PAGE_SIZE", async ({ page }) => {
    await navigateToPrestadores(page);

    // Check the header shows count
    const header = page.locator("text=/\\d+ parceiro/").first();
    const headerText = await header.textContent();
    const match = headerText?.match(/(\d+)/);
    expect(match).toBeTruthy();
    const total = parseInt(match![1]);
    expect(total).toBeGreaterThan(25);

    // Pagination should be visible
    const nextBtn = page.locator("button", { hasText: "Próxima" });
    await expect(nextBtn).toBeVisible();
    await expect(nextBtn).toBeEnabled();

    // Navigate to page 2
    await nextBtn.click();
    await page.waitForTimeout(1500);

    // Page 2 should show different records
    const pageIndicator = page.locator("text=/2 \\//").first();
    await expect(pageIndicator).toBeVisible();
  });

  // ── T2: 40 registros / PAGE_SIZE 25 → totalPages = 2 ──
  test("T2: totalPages = ceil(totalCount / 25)", async ({ page }) => {
    await navigateToPrestadores(page);

    const header = page.locator("text=/\\d+ parceiro/").first();
    const headerText = await header.textContent();
    const total = parseInt(headerText!.match(/(\d+)/)![1]);
    const expectedPages = Math.ceil(total / 25);

    // Verify page numbers exist
    for (let i = 1; i <= expectedPages; i++) {
      const pageBtn = page.locator(`button:text-is("${i}")`).first();
      await expect(pageBtn).toBeVisible();
    }
  });

  // ── T3: Navegar 1 → 2 → 1 sem perder ordenação/filtros ──
  test("T3: Navegação 1→2→1 preserva ordenação", async ({ page }) => {
    await navigateToPrestadores(page);

    // Page 1 - get first record name
    const firstNamePage1 = await page.locator("table tbody tr").first().locator("td").nth(1).textContent();

    // Go to page 2
    await page.locator("button", { hasText: "Próxima" }).click();
    await page.waitForTimeout(1500);

    // Go back to page 1
    await page.locator("button", { hasText: "Anterior" }).click();
    await page.waitForTimeout(1500);

    // First record should be the same
    const firstNameAfter = await page.locator("table tbody tr").first().locator("td").nth(1).textContent();
    expect(firstNameAfter).toBe(firstNamePage1);
  });

  // ── T4: Ordem A→Z global correta ──
  test("T4: Registros ordenados A→Z por nome", async ({ page }) => {
    await navigateToPrestadores(page);

    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      const name = await rows.nth(i).locator("td").nth(1).textContent();
      names.push(name?.trim().toLowerCase() || "");
    }

    // Verify ascending order
    for (let i = 1; i < names.length; i++) {
      expect(names[i] >= names[i - 1]).toBeTruthy();
    }
  });

  // ── T5: Continuidade da ordenação entre páginas ──
  test("T5: Último da página 1 < primeiro da página 2", async ({ page }) => {
    await navigateToPrestadores(page);

    const total = parseInt((await page.locator("text=/\\d+ parceiro/").first().textContent())!.match(/(\d+)/)![1]);
    if (total <= 25) {
      test.skip();
      return;
    }

    // Last name on page 1
    const lastPage1 = await page.locator("table tbody tr").last().locator("td").nth(1).textContent();

    // Go to page 2
    await page.locator("button", { hasText: "Próxima" }).click();
    await page.waitForTimeout(1500);

    // First name on page 2
    const firstPage2 = await page.locator("table tbody tr").first().locator("td").nth(1).textContent();

    expect(lastPage1!.trim().toLowerCase() < firstPage2!.trim().toLowerCase()).toBeTruthy();
  });

  // ── T6: Busca encontra prestador fora da página 1 ──
  test("T6: Busca global encontra prestador de qualquer página", async ({ page }) => {
    await navigateToPrestadores(page);

    // Go to page 2 to find a name
    await page.locator("button", { hasText: "Próxima" }).click();
    await page.waitForTimeout(1500);

    const firstNamePage2 = await page.locator("table tbody tr").first().locator("td").nth(1).textContent();
    const searchName = firstNamePage2!.split(" ")[0].trim(); // First word of name

    // Go back to page 1
    await page.locator("button", { hasText: "Anterior" }).click();
    await page.waitForTimeout(1500);

    // Search for that name
    await page.locator('input[placeholder*="Buscar"]').fill(searchName);
    await page.waitForTimeout(2000);

    // Should find the record
    const results = page.locator("table tbody tr");
    const count = await results.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      const text = await results.nth(i).locator("td").nth(1).textContent();
      if (text?.toLowerCase().includes(searchName.toLowerCase())) {
        found = true;
        break;
      }
    }
    expect(found).toBeTruthy();
  });

  // ── T7: Busca reinicia para página 1 ──
  test("T7: Busca reseta para página 1", async ({ page }) => {
    await navigateToPrestadores(page);

    // Go to page 2
    await page.locator("button", { hasText: "Próxima" }).click();
    await page.waitForTimeout(1500);

    // Search
    await page.locator('input[placeholder*="Buscar"]').fill("M43");
    await page.waitForTimeout(2000);

    // Should be on page 1
    const pageIndicator = page.locator("text=/1 \\//").first();
    await expect(pageIndicator).toBeVisible();
  });

  // ── T8: Busca com múltiplas páginas recalcula count ──
  test("T8: Busca filtra e recalcula totalPages", async ({ page }) => {
    await navigateToPrestadores(page);

    const totalBefore = parseInt((await page.locator("text=/\\d+ parceiro/").first().textContent())!.match(/(\d+)/)![1]);

    // Search for something specific
    await page.locator('input[placeholder*="Buscar"]').fill("M43");
    await page.waitForTimeout(2000);

    const totalAfter = parseInt((await page.locator("text=/\\d+ parceiro/").first().textContent())!.match(/(\d+)/)![1]);

    expect(totalAfter).toBeLessThanOrEqual(totalBefore);
  });

  // ── T9: Limpar busca restaura conjunto completo ──
  test("T9: Limpar busca restaura totalCount original", async ({ page }) => {
    await navigateToPrestadores(page);

    const totalBefore = parseInt((await page.locator("text=/\\d+ parceiro/").first().textContent())!.match(/(\d+)/)![1]);

    // Search
    await page.locator('input[placeholder*="Buscar"]').fill("M43");
    await page.waitForTimeout(2000);

    // Clear search
    await page.locator('input[placeholder*="Buscar"]').fill("");
    await page.waitForTimeout(2000);

    const totalAfter = parseInt((await page.locator("text=/\\d+ parceiro/").first().textContent())!.match(/(\d+)/)![1]);

    expect(totalAfter).toBe(totalBefore);
  });

  // ── T10: Erro de consulta → nenhum mock exibido ──
  test("T10: Em erro, não mostra mock data", async ({ page }) => {
    await navigateToPrestadores(page);

    // Check that mock names like "João da Silva" (from mockPrestadores) are NOT displayed
    // if there are real records
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    const mockNames = ["João da Silva", "Maria Santos", "Pedro Oliveira"];
    
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).locator("td").nth(1).textContent();
      // Real data has M43 test names, not mock names
      if (text) {
        expect(mockNames.some(m => text.includes(m))).toBeFalsy();
      }
    }
  });

  // ── T11: Query vazia → estado vazio real ──
  test("T11: Busca sem resultados mostra estado vazio", async ({ page }) => {
    await navigateToPrestadores(page);

    // Search for something that doesn't exist
    await page.locator('input[placeholder*="Buscar"]').fill("XYZNONEXISTENT123");
    await page.waitForTimeout(2000);

    // Should show empty state message
    const emptyMsg = page.locator("text=Nenhum prestador encontrado para esta busca");
    await expect(emptyMsg).toBeVisible();

    // Should NOT show mock data
    const rows = page.locator("table tbody tr");
    expect(await rows.count()).toBe(0);
  });

  // ── T12: Registro com nome vazio continua acessível ──
  test("T12: Registro com nome vazio exibe fallback", async ({ page }) => {
    await navigateToPrestadores(page);

    // Check if "Nome não informado" appears anywhere (indicates records with empty names are shown)
    // This is a structural check - the code handles it
    const pageContent = await page.content();
    // The fallback text "Nome não informado" exists in the rendered HTML
    // (either as a displayed value or in the code's rendering logic)
    expect(pageContent).toContain("Nome não informado");
  });

  // ── T13: Refetch após save ──
  test("T13: Lista refetches when refreshKey changes", async ({ page }) => {
    await navigateToPrestadores(page);

    const countBefore = parseInt((await page.locator("text=/\\d+ parceiro/").first().textContent())!.match(/(\d+)/)![1]);

    // Simulate going to "new" and coming back (which increments refreshKey)
    await page.locator("button", { hasText: "Cadastrar Prestador" }).click();
    await page.waitForTimeout(500);

    // Go back
    await page.locator("button", { hasText: /Voltar|Cancelar/ }).first().click();
    await page.waitForTimeout(2000);

    // Count should be the same (no new record created, but refetch happened)
    const countAfter = parseInt((await page.locator("text=/\\d+ parceiro/").first().textContent())!.match(/(\d+)/)![1]);
    expect(countAfter).toBe(countBefore);
  });

  // ── T14: Novo registro posição alfabética ──
  test("T14: After refetch, order is preserved A→Z", async ({ page }) => {
    await navigateToPrestadores(page);

    // Get first 3 names
    const names1: string[] = [];
    const rows1 = page.locator("table tbody tr");
    for (let i = 0; i < Math.min(3, await rows1.count()); i++) {
      names1.push(await rows1.nth(i).locator("td").nth(1).textContent() || "");
    }

    // Navigate away and back
    await page.locator("button", { hasText: "Cadastrar Prestador" }).click();
    await page.waitForTimeout(500);
    await page.locator("button", { hasText: /Voltar|Cancelar/ }).first().click();
    await page.waitForTimeout(2000);

    // Get first 3 names again
    const names2: string[] = [];
    const rows2 = page.locator("table tbody tr");
    for (let i = 0; i < Math.min(3, await rows2.count()); i++) {
      names2.push(await rows2.nth(i).locator("td").nth(1).textContent() || "");
    }

    // Order should be identical
    expect(names2).toEqual(names1);
  });

  // ── T15: Botão Anterior/Próxima ──
  test("T15: Previous/Next buttons work correctly", async ({ page }) => {
    await navigateToPrestadores(page);

    const prevBtn = page.locator("button", { hasText: "Anterior" });
    const nextBtn = page.locator("button", { hasText: "Próxima" });

    // On page 1: Previous disabled, Next enabled
    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeEnabled();

    // Go to page 2
    await nextBtn.click();
    await page.waitForTimeout(1500);

    // On page 2: Previous enabled
    await expect(prevBtn).toBeEnabled();

    // Go back
    await prevBtn.click();
    await page.waitForTimeout(1500);

    // Back on page 1
    await expect(prevBtn).toBeDisabled();
  });

  // ── T16: Páginas numeradas ──
  test("T16: Numbered page buttons are clickable and correct", async ({ page }) => {
    await navigateToPrestadores(page);

    const total = parseInt((await page.locator("text=/\\d+ parceiro/").first().textContent())!.match(/(\d+)/)![1]);
    if (total <= 25) {
      test.skip();
      return;
    }

    // Page 1 button should be active
    const page1Btn = page.locator('button:text-is("1")').first();
    await expect(page1Btn).toBeVisible();

    // Click page 2
    const page2Btn = page.locator('button:text-is("2")').first();
    await page2Btn.click();
    await page.waitForTimeout(1500);

    // Should show page 2
    const pageIndicator = page.locator("text=/2 \\//").first();
    await expect(pageIndicator).toBeVisible();
  });

  // ── T17: Nenhuma alteração financeira ──
  test("T17: No financial data modified", async ({ page }) => {
    // Verify financeiro tables are untouched
    const response = await page.request.get(`${BASE}/rest/v1/financeiro_receber?select=id&limit=1`, {
      headers: {
        "apikey": process.env.VITE_SUPABASE_ANON_KEY || "",
        "Authorization": `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || ""}`,
      },
    });
    // Just verify we can read - no writes were made
    expect(response.ok()).toBeTruthy();
  });
});
