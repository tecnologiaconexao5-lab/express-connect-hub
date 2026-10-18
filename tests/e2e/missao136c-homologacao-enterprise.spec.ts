import { test, expect } from "@playwright/test";
import * as pathModule from "path";
import * as fs from "fs";

const EVIDENCIAS_DIR = "docs/homologacao/missao136c";

const USER_ADMIN = {
  email: "tamiris.castilho@conexaoexpress.com.br",
  name: "Tamiris Castilho",
  role: "super_admin",
  unit: "Matriz",
};

test.beforeAll(() => {
  if (!fs.existsSync(EVIDENCIAS_DIR)) {
    fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
  }
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate((u) => {
    localStorage.setItem("tms_user", JSON.stringify(u));
  }, USER_ADMIN);
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  (page as any).__consoleErrors = consoleErrors;
});

function noFatalErrors(page: any) {
  const errors = page.__consoleErrors || [];
  const fatal = errors.filter((e: string) => e.includes("Uncaught") && !e.includes("ResizeObserver") && !e.includes("Layout was forced"));
  expect(fatal).toHaveLength(0);
}

test.describe("MISSÃO 136-C — Homologação Enterprise Completa", () => {

  // ============================================================
  // ETAPA 3 — FLUXO COMERCIAL
  // ============================================================
  test.describe("ETAPA 3 — Fluxo Comercial", () => {

    test("3.01 — Comercial: Dashboard carrega sem erros", async ({ page }) => {
      await page.goto("/comercial");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "03_01_comercial_dashboard.png") });
      noFatalErrors(page);
    });

    test("3.02 — Comercial: Aba CRM carrega sem erros", async ({ page }) => {
      await page.goto("/comercial?tab=crm");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "03_02_comercial_crm.png") });
      noFatalErrors(page);
    });

    test("3.03 — Comercial: Aba Orçamentos carrega", async ({ page }) => {
      await page.goto("/comercial?tab=orcamentos");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "03_03_comercial_orcamentos.png") });
      noFatalErrors(page);
    });

    test("3.04 — Comercial: Aba Tabela de Valores carrega", async ({ page }) => {
      await page.goto("/comercial?tab=tabela");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "03_04_comercial_tabela.png") });
      noFatalErrors(page);
    });

  });

  // ============================================================
  // ETAPA 4 + 5 — PEDIDOS + ORDEM DE SERVIÇO
  // ============================================================
  test.describe("ETAPA 4+5 — Pedidos + OS", () => {

    test("4.01 — Operação: OS Lista carrega sem erros", async ({ page }) => {
      await page.goto("/operacao?tab=os");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "04_01_os_lista.png") });
      noFatalErrors(page);
    });

    test("5.01 — Operação: Formulário Nova OS abre sem erros", async ({ page }) => {
      await page.goto("/operacao?tab=os&action=novo");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "05_01_nova_os_form.png") });
      noFatalErrors(page);
    });

  });

  // ============================================================
  // ETAPA 6 — ESCALAS
  // ============================================================
  test.describe("ETAPA 6 — Escalas", () => {

    test("6.01 — Operação: Escala carrega sem erros", async ({ page }) => {
      await page.goto("/operacao?tab=escala");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "06_01_escala_lista.png") });
      noFatalErrors(page);
    });

  });

  // ============================================================
  // ETAPA 7 — REDE ENTERPRISE (Dashboard TabRede)
  // ============================================================
  test.describe("ETAPA 7 — Rede Enterprise", () => {

    test("7.01 — Dashboard: Aba Rede Enterprise carrega", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);
      const tabRede = page.locator('button[role="tab"]:has-text("Rede Enterprise")').first();
      if (await tabRede.isVisible()) {
        await tabRede.click();
        await page.waitForTimeout(2000);
      }
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "07_01_rede_enterprise.png") });
      noFatalErrors(page);
    });

  });

  // ============================================================
  // ETAPA 9 — TRACKING
  // ============================================================
  test.describe("ETAPA 9 — Tracking", () => {

    test("9.01 — Tracking: Página de rastreamento público carrega", async ({ page }) => {
      await page.goto("/rastrear");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "09_01_tracking_pagina.png") });
      noFatalErrors(page);
    });

    test("9.02 — Tracking: Rota de token /rastreamento carrega", async ({ page }) => {
      await page.goto("/rastreamento/test-token");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "09_02_tracking_token.png") });
      noFatalErrors(page);
    });

  });

  // ============================================================
  // ETAPA 10 — FINANCEIRO
  // ============================================================
  test.describe("ETAPA 10 — Financeiro", () => {

    test("10.01 — Financeiro: Dashboard carrega sem erros", async ({ page }) => {
      await page.goto("/financeiro");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "10_01_financeiro_dashboard.png") });
      noFatalErrors(page);
    });

    test("10.02 — Financeiro: Contas a Receber carrega", async ({ page }) => {
      await page.goto("/financeiro?tab=receber");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2500);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "10_02_financeiro_receber.png") });
      noFatalErrors(page);
    });

    test("10.03 — Financeiro: Contas a Pagar carrega", async ({ page }) => {
      await page.goto("/financeiro?tab=pagar");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2500);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "10_03_financeiro_pagar.png") });
      noFatalErrors(page);
    });

    test("10.04 — Financeiro: Fluxo de Caixa carrega", async ({ page }) => {
      await page.goto("/financeiro?tab=fluxo");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2500);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "10_04_financeiro_fluxo.png") });
      noFatalErrors(page);
    });

    test("10.05 — Financeiro: DRE Gerencial carrega", async ({ page }) => {
      await page.goto("/financeiro?tab=dre");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2500);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "10_05_financeiro_dre.png") });
      noFatalErrors(page);
    });

  });

  // ============================================================
  // ETAPA 11 — PORTAL CLIENTE
  // ============================================================
  test.describe("ETAPA 11 — Portal Cliente", () => {

    test("11.01 — Portal: Login/Home carrega sem erros", async ({ page }) => {
      await page.goto("/portal-cliente");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "11_01_portal_home.png") });
      noFatalErrors(page);
    });

    test("11.02 — Portal: Aba Pedidos carrega", async ({ page }) => {
      // Simula cliente já logado via localStorage no Portal
      await page.evaluate(() => {
        localStorage.setItem("tms_user", JSON.stringify({
          email: "cliente@test.com",
          name: "Cliente Test",
          role: "cliente",
          unit: "Matriz",
        }));
      });
      await page.goto("/portal-cliente");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "11_02_portal_pedidos.png") });
      noFatalErrors(page);
    });

  });

  // ============================================================
  // ETAPA 15 — TORRE DE CONTROLE
  // ============================================================
  test.describe("ETAPA 15 — Torre de Controle", () => {

    test("15.01 — Torre de Controle: Página carrega sem erros", async ({ page }) => {
      await page.goto("/torre-controle");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);
      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "15_01_torre_controle.png") });
      noFatalErrors(page);
    });

  });

  // ============================================================
  // ETAPA 19 — CAÇA A BUGS (Navegação Ampla)
  // ============================================================
  test.describe("ETAPA 19 — Caça a Bugs (Navegação completa)", () => {

    const rotas = [
      { path: "/dashboard", name: "Dashboard" },
      { path: "/cadastros/clientes", name: "Clientes" },
      { path: "/cadastros/prestadores", name: "Prestadores" },
      { path: "/cadastros/veiculos", name: "Veículos" },
      { path: "/cadastros/auxiliares", name: "Cadastros Auxiliares" },
      { path: "/frota", name: "Frota" },
      { path: "/combustiveis", name: "Combustíveis" },
      { path: "/fiscal", name: "Fiscal" },
      { path: "/contratos", name: "Contratos" },
      { path: "/sla", name: "SLA" },
      { path: "/relatorios", name: "Relatórios" },
      { path: "/biblioteca", name: "Biblioteca" },
      { path: "/governanca", name: "Governança" },
      { path: "/configuracoes", name: "Configurações" },
      { path: "/seguros", name: "Seguros" },
      { path: "/central-ia", name: "Central IA" },
      { path: "/comunicacao", name: "Comunicação" },
      { path: "/recrutamento", name: "Recrutamento" },
    ];

    rotas.forEach((rota, idx) => {
      test(`19.${idx+1} — ${rota.name}: ${rota.path} carrega sem erros`, async ({ page }) => {
        await page.goto(rota.path);
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(2500);
        await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, `19_${rota.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.png`) });
        noFatalErrors(page);
      });
    });

  });

});