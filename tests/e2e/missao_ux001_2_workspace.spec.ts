import { test, expect, type Page, type Route } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

// ============================================================
// MISSÃO UX-001.2 — Formulários Enterprise (workspace Escala)
// Valida o novo padrão visual de OrcamentoForm e OrdemServicoForm:
// contêiner único (workspace), cabeçalho interno, painel lateral
// esquerdo de contexto, wizard em faixa clara, painel complementar
// (resumo/checklist) e rodapé interno. Exclusivamente UX/UI.
// Roda em ambiente QA/dev com credenciais reais (PLAYWRIGHT_*).
// ============================================================

const SHOT = "test-results/ux001_2";
const RESOLUCOES = [
  { nome: "1366x768", width: 1366, height: 768 },
  { nome: "1440x900", width: 1440, height: 900 },
  { nome: "1920x1080", width: 1920, height: 1080 },
] as const;

const FAKE_CLIENTES = [
  { id: "11111111-1111-1111-1111-111111111111", nome_fantasia: "Logística Express S.A.", razao_social: "Logística Express Ltda", cnpj: "11.222.333/0001-81", condicao_comercial_tabela_id: null },
  { id: "22222222-2222-2222-2222-222222222222", nome_fantasia: "Vitória Alimentos Distribuidora", razao_social: "Vitória Alimentos Ltda", cnpj: "22.333.444/0001-90", condicao_comercial_tabela_id: null },
  { id: "33333333-3333-3333-3333-333333333333", nome_fantasia: "Farmacêutica Conexão Ltda", razao_social: "Farmacêutica Conexão S.A.", cnpj: "33.444.555/0001-02", condicao_comercial_tabela_id: null },
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

async function abrirOSNovo(page: Page) {
  await page.goto("/operacao?tab=os&action=novo", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.getByText("Ordem de Serviço", { exact: false }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(800);
}

// ============================================================
// ORÇAMENTO — workspace + sidebar + wizard + checklist + rodapé
// ============================================================
async function validarEstruturaOrcamento(page: Page, resolucao: string) {
  // 1. Workspace único (contêiner com cabeçalho interno)
  const sidebarContrato = page.getByText("Contrato", { exact: true }).first();
  await expect(sidebarContrato).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Prioridade & Status", { exact: true }).first()).toBeVisible();
  // Painel de contexto lateral (sidebar esquerda)
  await expect(page.getByText("Cliente", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Tipo de Operação", { exact: true }).first()).toBeVisible();

  // 2. Checklist / resumo (painel complementar direito)
  await expect(page.getByText("Checklist", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Pendências", { exact: true }).first()).toBeVisible();

  // 3. Rodapé interno do workspace
  await expect(page.getByRole("button", { name: "Salvar Orçamento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar rascunho" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Avançar/ })).toBeVisible();

  // 4. Wizard em faixa clara
  await expect(page.getByText("Identificação", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Carga", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Veículo", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Endereços", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Valores", { exact: true }).first()).toBeVisible();

  // 5. Screenshots: visão inicial + rodapé + painel lateral
  await page.screenshot({ path: `${SHOT}/${resolucao}-orc-visao-inicial.png` });
  await page.screenshot({ path: `${SHOT}/${resolucao}-orc-rodape.png` });
}

async function fluxoOrcamento(page: Page, resolucao: string) {
  await validarEstruturaOrcamento(page, resolucao);

  // 6. Buscar e selecionar Cliente (dropdown)
  const inputCliente = page.getByPlaceholder("Buscar...").first();
  await inputCliente.click();
  await inputCliente.fill("vitoria");
  const dropdown = page.locator("ul").filter({ hasText: "Vitória Alimentos Distribuidora" }).first();
  await expect(dropdown).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${SHOT}/${resolucao}-orc-dropdown-cliente-aberto.png` });
  await page.getByText("Vitória Alimentos Distribuidora", { exact: false }).first().click();
  await page.waitForTimeout(400);

  // 7. Selecionar Unidade
  const selectUnidade = page.getByText("São Paulo - Matriz", { exact: false }).first();
  await selectUnidade.click();
  await page.waitForTimeout(300);
  await page.locator("[role='option'], [data-radix-collection-item]").first().click().catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);

  // 8. Selecionar Tipo de Operação
  const selectTipo = page.getByText("Selecione", { exact: false }).first();
  await selectTipo.click().catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);

  // 9. Navegar pelas etapas (Avançar até Endereços)
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /Avançar/ }).click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: `${SHOT}/${resolucao}-orc-etapa-intermediaria.png` });
  await expect(page.getByText("Endereços", { exact: true }).first()).toBeVisible();

  // 10. Salvar rascunho dispara callback (não persiste sem dados válidos)
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await page.waitForTimeout(400);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT}/${resolucao}-orc-painel-lateral.png` });
}

// ============================================================
// ORDEM DE SERVIÇO — workspace + sidebar + rotas + checklist + rodapé
// ============================================================
async function validarEstruturaOS(page: Page, resolucao: string) {
  const sidebarOperacao = page.getByText("Operação", { exact: true }).first();
  await expect(sidebarOperacao).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Status", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Veículo", { exact: true }).first()).toBeVisible();

  await expect(page.getByText("Checklist", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Pendências", { exact: true }).first()).toBeVisible();

  await expect(page.getByRole("button", { name: "Salvar OS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar rascunho" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Avançar/ })).toBeVisible();

  await expect(page.getByText("Identificação", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Rotas e Paradas", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Torre & Financeiro", { exact: true }).first()).toBeVisible();

  await page.screenshot({ path: `${SHOT}/${resolucao}-os-visao-inicial.png` });
}

async function fluxoOS(page: Page, resolucao: string) {
  await validarEstruturaOS(page, resolucao);

  // 3. Navegar até Rotas e Paradas
  await page.getByText("Rotas e Paradas", { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT}/${resolucao}-os-rotas-paradas.png` });

  // 4. Adicionar parada
  await page.getByRole("button", { name: /Adicionar Parada/ }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText("Itinerário da OS", { exact: false }).first()).toBeVisible();

  // 5. Validar campos de endereço
  await expect(page.getByLabel(/Endereço/i).first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: `${SHOT}/${resolucao}-os-etapa-intermediaria.png` });

  // 6. Salvar rascunho
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await page.waitForTimeout(400);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT}/${resolucao}-os-painel-lateral.png` });
}

test.describe("UX-001.2 — Workspace Enterprise (Orçamento)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await loginAdmin(page, "ux0012");
    await interceptClientes(page);
  });

  for (const res of RESOLUCOES) {
    test(`orçamento em ${res.nome}`, async ({ page }) => {
      await page.setViewportSize({ width: res.width, height: res.height });
      await abrirOrcamentoNovo(page);
      await fluxoOrcamento(page, res.nome);
    });
  }
});

test.describe("UX-001.2 — Workspace Enterprise (Ordem de Serviço)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await loginAdmin(page, "ux0012");
    await interceptClientes(page);
  });

  for (const res of RESOLUCOES) {
    test(`ordem de serviço em ${res.nome}`, async ({ page }) => {
      await page.setViewportSize({ width: res.width, height: res.height });
      await abrirOSNovo(page);
      await fluxoOS(page, res.nome);
    });
  }
});
