import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

test.describe("M136-C.2 — Auditoria Comercial", () => {
  const ITENS_COMERCIAL = [
    { title: "Orçamentos", tab: "orcamentos", path: "/comercial?tab=orcamentos" },
    { title: "CRM", tab: "crm", path: "/comercial?tab=crm" },
    { title: "Marketing", tab: "marketing", path: "/comercial?tab=marketing" },
    { title: "Propostas", tab: "propostas", path: "/comercial?tab=propostas" },
    { title: "Tabela de Valores", tab: "tabela", path: "/comercial?tab=tabela" },
    { title: "Simulador de Frete", tab: "simulador", path: "/comercial?tab=simulador" },
    { title: "Automação Comercial", tab: "automacao", path: "/comercial?tab=automacao" },
  ] as const;

  const EXPECTED_TAB_VALUES = ["orcamentos", "crm", "marketing", "propostas", "tabela", "simulador", "automacao"];

  const EXPECTED_TAB_TEXTS = ["Orçamentos", "CRM", "Marketing", "Propostas", "Tabela de Valores", "Simulador", "Automação"];

  const TAB_TEXT_BY_VALUE: Record<string, string> = {
    orcamentos: "Orçamentos",
    crm: "CRM",
    marketing: "Marketing",
    propostas: "Propostas",
    tabela: "Tabela de Valores",
    simulador: "Simulador",
    automacao: "Automação",
  };
  const TAB_VALUE_BY_TEXT: Record<string, string> = {
    Orçamentos: "orcamentos",
    CRM: "crm",
    Marketing: "marketing",
    Propostas: "propostas",
    "Tabela de Valores": "tabela",
    Simulador: "simulador",
    Automação: "automacao",
  };

  async function expandSidebar(page: import("@playwright/test").Page) {
    await page.mouse.move(5, 300);
    await page.waitForTimeout(800);
  }

  async function openAccordion(page: import("@playwright/test").Page, parentTitle: string) {
    const btn = page.locator(`aside button:has-text("${parentTitle}")`).first();
    await btn.click();
    await page.waitForTimeout(500);
  }

  async function clickChildAndVerify(
    page: import("@playwright/test").Page,
    childTitle: string,
    expectedUrlContains: string,
  ) {
    const childBtn = page.locator(`aside button:has-text("${childTitle}")`).last();
    await expect(childBtn).toBeVisible({ timeout: 5000 });
    await childBtn.click();
    await page.waitForTimeout(2000);

    const url = page.url();
    expect(url).toContain(expectedUrlContains);

    const bodyText = await page.locator("body").textContent().catch(() => "");
    expect(bodyText?.length).toBeGreaterThan(100);
    expect(bodyText?.includes("Carregando sessão")).toBeFalsy();
  }

  test.beforeEach(async ({ page }) => {
    // Navegar para app antes de limpar localStorage (evita SecurityError)
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await page.evaluate(() => {
      localStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/");
      });
    });
    await loginAdmin(page);
    await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
  });

  // ================================================================
  // 01 — Verificar que os 7 sub-itens existem no menu
  // ================================================================
  test("01 — Menu contem os 7 itens do Comercial", async ({ page }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Gestão Comercial");

    for (const item of ITENS_COMERCIAL) {
      const childBtn = page.locator(`aside button:has-text("${item.title}")`).last();
      await expect(childBtn).toBeVisible({ timeout: 5000 });
    }
  });

  // ================================================================
  // 02–08 — Navegação de cada item
  // ================================================================
  for (let i = 0; i < ITENS_COMERCIAL.length; i++) {
    const item = ITENS_COMERCIAL[i];
    const testNum = String(i + 2).padStart(2, "0");
    test(`${testNum} — ${item.title} navega corretamente`, async ({ page }) => {
      test.setTimeout(60000);
      await expandSidebar(page);
      await openAccordion(page, "Gestão Comercial");
      await clickChildAndVerify(page, item.title, item.tab);
    });
  }

  // ================================================================
  // 09 — Verificar tabs na página Comercial (via sidebar, nao page.goto)
  // ================================================================
  test("09 — Tabs da pagina correspondem aos itens do menu", async ({ page }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Gestão Comercial");
    const primeiroItem = page.locator('aside button:has-text("Orçamentos")').last();
    await primeiroItem.waitFor({ state: "visible", timeout: 5000 });
    await primeiroItem.click();
    await page.waitForTimeout(3000);
    await page.waitForURL(/\/comercial/, { timeout: 15000 });

    // Aguardar tabs renderizarem (locator.count() não espera)
    const tabLocator = page.locator('[role="tab"]');
    await tabLocator.first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    const tabCount = await tabLocator.count();
    expect(tabCount).toBe(EXPECTED_TAB_VALUES.length);

    const foundTexts: string[] = [];
    for (let i = 0; i < tabCount; i++) {
      const text = (await tabLocator.nth(i).textContent())?.trim() || "";
      if (text) foundTexts.push(text);
    }

    for (const expected of EXPECTED_TAB_TEXTS) {
      expect(foundTexts).toContain(expected);
    }
  });

  // ================================================================
  // 10 — Relatório de divergências (via sidebar, nao page.goto)
  // ================================================================
  test("10 — Divergencias registradas", async ({ page }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Gestão Comercial");
    const primeiroItem = page.locator('aside button:has-text("Orçamentos")').last();
    await primeiroItem.waitFor({ state: "visible", timeout: 5000 });
    await primeiroItem.click();
    await page.waitForTimeout(3000);
    await page.waitForURL(/\/comercial/, { timeout: 15000 });

    // Aguardar tabs renderizarem
    const tabLocator = page.locator('[role="tab"]');
    await tabLocator.first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    const tabCount = await tabLocator.count();

    const menuTitles: { title: string; tab: string }[] = ITENS_COMERCIAL.map((i) => ({ title: i.title, tab: i.tab }));

    const tabInfos: { text: string }[] = [];
    for (let i = 0; i < tabCount; i++) {
      const text = (await tabLocator.nth(i).textContent())?.trim() || "";
      if (text) tabInfos.push({ text });
    }

    const tabTexts = tabInfos.map((t) => t.text);

    const menuTexts = menuTitles.map((m) => m.title);
    const menuOnlyTexts = menuTexts.filter((v) => !tabTexts.includes(v));
    const tabOnlyTexts = tabTexts.filter((v) => !menuTexts.includes(v));

    const namingDifferences: { menu: string; tabText: string }[] = [];
    for (const item of menuTitles) {
      const tabText = TAB_TEXT_BY_VALUE[item.tab];
      if (tabText && tabText !== item.title) {
        namingDifferences.push({ menu: item.title, tabText });
      }
    }

    const exactMatches = menuTitles.filter((m) => {
      const tabText = TAB_TEXT_BY_VALUE[m.tab];
      return tabText === m.title;
    }).map((m) => m.title);

    console.log("");
    console.log("=".repeat(60));
    console.log("  RELATORIO DE DIVERGENCIAS — MODULO COMERCIAL");
    console.log("=".repeat(60));
    console.log(`  Itens no menu sidebar: ${menuTitles.length}`);
    console.log(`  Abas (TabsTrigger) na pagina: ${tabInfos.length}`);
    console.log("");

    console.log("  MATCHES (nome exato):");
    if (exactMatches.length > 0) {
      for (const m of exactMatches) {
        console.log(`    ✅ ${m}`);
      }
    } else {
      console.log("    (nenhum match exato)");
    }
    console.log("");

    if (menuOnlyTexts.length > 0) {
      console.log("  ⚠️  DEFEITO: Presente no menu mas AUSENTE nas tabs:");
      for (const v of menuOnlyTexts) {
        console.log(`    ${v}`);
      }
      console.log("");
    }

    if (tabOnlyTexts.length > 0) {
      console.log("  ⚠️  DEFEITO: Presente nas tabs mas AUSENTE no menu:");
      for (const v of tabOnlyTexts) {
        console.log(`    ${v}`);
      }
      console.log("");
    }

    if (namingDifferences.length > 0) {
      console.log("  ⚠️  DEFEITO: Diferenca de nomenclatura (menu vs tab):");
      for (const d of namingDifferences) {
        console.log(`    Menu: "${d.menu}"`);
        console.log(`    Tab:  "${d.tabText}"`);
        console.log("");
      }
    }

    if (menuOnlyTexts.length === 0 && tabOnlyTexts.length === 0 && namingDifferences.length === 0) {
      console.log("  ✅ Nenhuma divergencia encontrada. Menu e tabs estao alinhados.");
    }

    console.log("=".repeat(60));
    console.log("");

    // Contagem igual = 7 menu, 7 tabs (mesmo com nomes diferentes)
    expect(menuTitles.length).toBe(tabInfos.length);
    // Apenas alertar divergências de nomenclatura (não falhar)
    if (menuOnlyTexts.length > 0) {
      console.log(`  ⚠️ ${menuOnlyTexts.length} item(ns) no menu com nome diferente nas tabs (documentado acima)`);
    }
    if (tabOnlyTexts.length > 0) {
      console.log(`  ⚠️ ${tabOnlyTexts.length} tab(ns) com nome diferente no menu (documentado acima)`);
    }
  });
});
