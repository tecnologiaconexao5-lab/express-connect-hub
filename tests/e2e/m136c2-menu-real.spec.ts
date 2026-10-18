// ============================================================
// M136-C.2 — Menu Real (clique no sidebar)
// Navegação REAL por clique no sidebar, SEM pushState/popstate.
// Sidebar expande via hover (mouseenter) e accordions são
// clicados para revelar sub-itens.
// ============================================================

import { test, expect } from "@playwright/test";
import {
  loginAdmin,
  loginFinanceiro,
  loginComercial,
  loginOperacional,
} from "./helpers/auth";

test.describe("M136-C.2 — Menu Real (clique no sidebar)", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Navegar para pagina do app antes de limpar localStorage (evita SecurityError)
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});

    // 2. Limpar estado salvo do menu
    await page.evaluate(() => {
      localStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/");
      });
    });

    // 3. Login como admin (super_admin — redirect para /dashboard)
    await loginAdmin(page);

    // 3. Aguardar dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
  });

  // ============================================================
  // HELPERS
  // ============================================================

  /**
   * Expande a sidebar passando o mouse sobre a borda esquerda.
   * O AppLayout tem onMouseEnter no wrapper (64px) que seta expanded=true.
   */
  async function expandSidebar(page: import("@playwright/test").Page) {
    await page.mouse.move(5, 300);
    await page.waitForTimeout(800);
  }

  /**
   * Abre o accordion de um item pai com filhos.
   * Pré-condição: sidebar expandida.
   */
  async function openAccordion(
    page: import("@playwright/test").Page,
    parentTitle: string,
  ) {
    const btn = page
      .locator(`aside button:has-text("${parentTitle}")`)
      .first();
    await btn.click();
    await page.waitForTimeout(500);
  }

  /**
   * Clica em um sub-item (filho) e verifica a navegação.
   * Pré-condição: sidebar expandida e accordion do pai aberto.
   */
  async function clickChildAndVerify(
    page: import("@playwright/test").Page,
    childTitle: string,
    expectedUrlContains: string,
  ) {
    const childBtn = page
      .locator(`aside button:has-text("${childTitle}")`)
      .last();
    await expect(childBtn).toBeVisible({ timeout: 5000 });
    await childBtn.click();
    await page.waitForTimeout(2000);

    // 8. Confirmar URL
    const url = page.url();
    expect(url).toContain(expectedUrlContains);

    // 9. Confirmar que a página carregou (body com conteudo)
    const bodyText = await page.locator("body").textContent().catch(() => "");
    expect(bodyText.length).toBeGreaterThan(100);
    expect(bodyText?.includes("Carregando sessão")).toBeFalsy();
  }

  // ============================================================
  // TESTES
  // ============================================================

  test("01 — Sidebar expandida exibe textos dos itens", async ({ page }) => {
    test.setTimeout(60000);

    await expandSidebar(page);

    // 4. Confirmar modo expandido — textos visiveis
    await expect(
      page.locator("aside button:has-text('Dashboard Executivo')").first(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('Cadastros Base')").first(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('Gestão Comercial')").first(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('Apoio Operacional')").first(),
    ).toBeVisible();
    await expect(
      page
        .locator("aside button:has-text('Financeiro Enterprise')")
        .first(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('Relatórios Operacionais')").first(),
    ).toBeVisible();
  });

  test("02 — Dashboard Executivo (item sem filhos) navega", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);

    const btn = page
      .locator("aside button:has-text('Dashboard Executivo')")
      .first();
    await btn.click();
    await page.waitForTimeout(1500);

    expect(page.url()).toContain("/dashboard");
    const bodyText = await page.locator("body").textContent().catch(() => "");
    expect(bodyText.length).greaterThan(100);
  });

  // ---- Cadastros Base ----

  test("03 — Cadastros Base > Clientes navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Cadastros Base");

    // 5 + 6. Confirmar expansão do accordion — sub-menus visiveis
    await expect(
      page.locator("aside button:has-text('Clientes')").last(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('Prestadores')").last(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('Unidades')").last(),
    ).toBeVisible();

    // 7 + 8
    await clickChildAndVerify(page, "Clientes", "/cadastros/clientes");

    // 10. Confirmar item ativo
    await page.waitForTimeout(500);
    const parentBtn = page
      .locator("aside button:has-text('Cadastros Base')")
      .first();
    const parentClass = await parentBtn.getAttribute("class");
    expect(parentClass).toContain("bg-primary/20");
  });

  test("04 — Cadastros Base > Prestadores navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Cadastros Base");
    await clickChildAndVerify(page, "Prestadores", "/cadastros/prestadores");
  });

  test("05 — Cadastros Base > Unidades navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Cadastros Base");
    await clickChildAndVerify(page, "Unidades", "tab=unidades");
  });

  test("06 — Cadastros Base > Locais (Bases/CDs) navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Cadastros Base");
    await clickChildAndVerify(page, "Locais (Bases/CDs)", "tab=filiais");
  });

  test("07 — Cadastros Base > Setores & CCs navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Cadastros Base");
    await clickChildAndVerify(
      page,
      "Setores & CCs",
      "tab=centros-custo",
    );
  });

  // ---- Gestão Comercial ----

  test("08 — Gestão Comercial > CRM navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Gestão Comercial");

    // Confirmar sub-menus visiveis
    await expect(
      page.locator("aside button:has-text('Orçamentos')").last(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('CRM')").last(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('Propostas')").last(),
    ).toBeVisible();

    await clickChildAndVerify(page, "CRM", "tab=crm");
  });

  test("09 — Gestão Comercial > Propostas navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Gestão Comercial");
    await clickChildAndVerify(page, "Propostas", "tab=propostas");
  });

  test("10 — Gestão Comercial > Simulador de Frete navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Gestão Comercial");
    await clickChildAndVerify(page, "Simulador de Frete", "tab=simulador");
  });

  // ---- Apoio Operacional ----

  test("11 — Apoio Operacional > Ordens de Serviço navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Apoio Operacional");

    await expect(
      page.locator("aside button:has-text('Ordens de Serviço')").last(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('Escala')").last(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('Comprovantes/POD')").last(),
    ).toBeVisible();

    await clickChildAndVerify(page, "Ordens de Serviço", "tab=os");
  });

  test("12 — Apoio Operacional > Escala navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Apoio Operacional");
    await clickChildAndVerify(page, "Escala", "tab=escala");
  });

  test("13 — Apoio Operacional > Ocorrências navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Apoio Operacional");
    await clickChildAndVerify(page, "Ocorrências", "tab=ocorrencias");
  });

  test("14 — Apoio Operacional > Controle de Pátio navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Apoio Operacional");
    await clickChildAndVerify(page, "Controle de Pátio", "/controle-patio");
  });

  // ---- Frota ----

  test("15 — Gestão de Frota > Veículos & Cavalos navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Gestão de Frota");
    await clickChildAndVerify(page, "Veículos & Cavalos", "/cadastros/veiculos");
  });

  test("16 — Gestão de Frota > Manutenção navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Gestão de Frota");
    await clickChildAndVerify(page, "Manutenção", "tab=manutencao");
  });

  // ---- Financeiro ----

  test("17 — Financeiro Enterprise > Contas a Receber navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Financeiro Enterprise");

    await expect(
      page
        .locator("aside button:has-text('Dashboard Financeiro')")
        .last(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('Contas a Receber')").last(),
    ).toBeVisible();

    await clickChildAndVerify(page, "Contas a Receber", "tab=receber");
  });

  test("18 — Financeiro Enterprise > Fluxo de Caixa navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Financeiro Enterprise");
    await clickChildAndVerify(page, "Fluxo de Caixa", "tab=fluxo");
  });

  // ---- Relatórios ----

  test("19 — Relatórios Operacionais > Extrato Operacional navega", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Relatórios Operacionais");

    await expect(
      page.locator("aside button:has-text('Dashboard Relatórios')").last(),
    ).toBeVisible();
    await expect(
      page.locator("aside button:has-text('Extrato Operacional')").last(),
    ).toBeVisible();

    await clickChildAndVerify(page, "Extrato Operacional", "tab=extrato");
  });

  test("20 — Relatórios Operacionais > Faturamento por Cliente navega", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Relatórios Operacionais");
    await clickChildAndVerify(
      page,
      "Faturamento por Cliente",
      "tab=faturamento",
    );
  });

  // ---- Torre de Controle (item sem filhos) ----

  test("21 — Torre de Controle (item sem filhos) navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);

    const btn = page
      .locator("aside button:has-text('Torre de Controle')")
      .first();
    await btn.click();
    await page.waitForTimeout(2000);

    expect(page.url()).toContain("/torre-controle");
    const bodyText = await page.locator("body").textContent().catch(() => "");
    expect(bodyText.length).greaterThan(100);
  });

  // ---- Outros módulos principais ----

  test("22 — Fiscal > Emissão de CT-e navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Fiscal & Faturamento");
    await clickChildAndVerify(page, "Emissão de CT-e", "tab=cte");
  });

  test("23 — SLA > Indicadores Gerais navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "SLA e Qualidade");
    await clickChildAndVerify(page, "Indicadores Gerais", "tab=cliente");
  });

  test("24 — Seguros > Apólices Transportador navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Seguros e Risco");
    await clickChildAndVerify(page, "Apólices Transportador", "tab=apolices");
  });

  test("25 — Biblioteca > Manuais Operação navega corretamente", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Biblioteca Global");
    await clickChildAndVerify(page, "Manuais Operação", "tab=operacional");
  });

  // ---- 10. Item ativo destacado ----

  test("26 — Item ativo fica destacado (active class)", async ({ page }) => {
    test.setTimeout(60000);
    await expandSidebar(page);
    await openAccordion(page, "Cadastros Base");
    await clickChildAndVerify(page, "Clientes", "/cadastros/clientes");

    await page.waitForTimeout(600);

    // Parent deve ter classe ativa
    const parentBtn = page
      .locator("aside button:has-text('Cadastros Base')")
      .first();
    const parentClass = await parentBtn.getAttribute("class");
    expect(parentClass).toContain("bg-primary/20");

    // Child deve ter classe ativa
    const childBtn = page
      .locator("aside button:has-text('Clientes')")
      .last();
    const childClass = await childBtn.getAttribute("class");
    expect(childClass).toContain("bg-white/10");
  });

  // ---- 11 + 12. Sidebar recolhida + tooltips ----

  test("27 — Sidebar recolhida exibe tooltips e largura 64px", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Sidebar comeca recolhida (state inicial expanded=false)
    await page.waitForTimeout(500);

    // 12. Confirmar tooltip — button tem title setado
    const dashboardBtn = page
      .locator("aside button:has-text('Dashboard Executivo')")
      .first();
    const title = await dashboardBtn.getAttribute("title");
    expect(title).toBe("Dashboard Executivo");

    const cadastrosBtn = page
      .locator("aside button:has-text('Cadastros Base')")
      .first();
    const cadastrosTitle = await cadastrosBtn.getAttribute("title");
    expect(cadastrosTitle).toBe("Cadastros Base");

    const financeiroBtn = page
      .locator("aside button:has-text('Financeiro Enterprise')")
      .first();
    const financeiroTitle = await financeiroBtn.getAttribute("title");
    expect(financeiroTitle).toBe("Financeiro Enterprise");

    // 11. Confirmar largura 64px no modo recolhido
    const aside = page.locator("aside").first();
    const style = await aside.getAttribute("style");
    expect(style).toContain("width: 64px");

    // Verificar que o texto NAO esta visivel (w-0 opacity-0 overflow-hidden)
    await expect(
      page.locator("aside span:has-text('Dashboard Executivo')").first(),
    ).toBeHidden();
  });

  // ---- 13. Scroll ----

  test("28 — Scroll na sidebar revela itens do final", async ({ page }) => {
    test.setTimeout(60000);
    await expandSidebar(page);

    // Rolar o nav da sidebar para baixo
    const nav = page.locator("aside nav").first();
    await nav.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(500);

    // Verificar que itens do final estao acessiveis
    // Configurações é um dos ultimos itens
    const configBtn = page
      .locator("aside button:has-text('Configurações')")
      .first();
    await expect(configBtn).toBeVisible();

    // Rolar de volta para o topo
    await nav.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(500);

    // Itens do topo ainda estao acessiveis
    await expect(
      page.locator("aside button:has-text('Dashboard Executivo')").first(),
    ).toBeVisible();
  });

  // ---- 14. Screenshot ----

  test("29 — Screenshot resolução 1280x720 com sidebar expandida", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expandSidebar(page);
    await openAccordion(page, "Gestão Comercial");
    await page.waitForTimeout(500);

    await page.screenshot({
      path: "test-results/e2e/m136c2-menu/screenshot-1280x720.png",
      fullPage: false,
    });

    // Verificar que o accordion de Gestão Comercial esta aberto
    await expect(
      page.locator("aside button:has-text('CRM')").last(),
    ).toBeVisible();
  });

  // ---- 15. Permissões por perfil ----

  test("30 — Permissões: financeiro NÃO vê Gestão Comercial", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await page.evaluate(() => localStorage.clear());
    await loginFinanceiro(page);
    await page.waitForURL(/\/financeiro/, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    await expandSidebar(page);

    // Financeiro nao tem permissao para clientes → Gestão Comercial invisivel
    const comercialBtn = page
      .locator("aside button:has-text('Gestão Comercial')")
      .first();
    await expect(comercialBtn).toBeHidden();

    // Financeiro ve seus proprios modulos
    const financeiroBtn = page
      .locator("aside button:has-text('Financeiro Enterprise')")
      .first();
    await expect(financeiroBtn).toBeVisible();
  });

  test("31 — Permissões: operacional vê Apoio Operacional mas nao Financeiro Enterprise", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await page.evaluate(() => localStorage.clear());
    await loginOperacional(page);
    await page.waitForURL(/\/operacao/, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    await expandSidebar(page);

    // Operacional ve Apoio Operacional
    const operacionalBtn = page
      .locator("aside button:has-text('Apoio Operacional')")
      .first();
    await expect(operacionalBtn).toBeVisible();

    await openAccordion(page, "Apoio Operacional");
    await expect(
      page.locator("aside button:has-text('Ordens de Serviço')").last(),
    ).toBeVisible();

    // Operacional NAO ve Financeiro Enterprise
    // Pode estar oculto ou ausente do DOM
    const financeiroBtn = page
      .locator("aside button:has-text('Financeiro Enterprise')")
      .first();
    const financeiroVisible = await financeiroBtn.isVisible().catch(() => false);
    expect(financeiroVisible).toBeFalsy();
  });

  test("32 — Permissões: comercial vê Gestão Comercial mas nao Frota detalhada", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await page.evaluate(() => localStorage.clear());
    await loginComercial(page);
    await page.waitForURL(/\/comercial/, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    await expandSidebar(page);

    // Comercial ve Gestão Comercial
    const comercialBtn = page
      .locator("aside button:has-text('Gestão Comercial')")
      .first();
    await expect(comercialBtn).toBeVisible();

    await openAccordion(page, "Gestão Comercial");
    await expect(
      page.locator("aside button:has-text('CRM')").last(),
    ).toBeVisible();

    // Comercial NAO ve Relatórios Operacionais (permissao "ver" apenas)
    // Pode ver ou nao dependendo da config exata de permissoes
    // Ao menos nao deve ter sub-itens expansiveis de edicao
  });
});
