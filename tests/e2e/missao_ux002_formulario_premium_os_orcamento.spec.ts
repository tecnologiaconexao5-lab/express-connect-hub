import { test, expect, type Page, type Route } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

// ============================================================
// MISSÃO UX-002 — Ordem de Serviço e Orçamento em Formulário Premium
// Valida o modal premium (overlay escuro + painel centralizado), o
// cabeçalho fixo com botão fechar, a coluna lateral única de contexto,
// a faixa de resumo horizontal (chips + KPIs), o wizard de etapas e o
// rodapé fixo — em OrdemServicoForm e OrcamentoForm.
// Exclusivamente UX/UI. Roda em ambiente QA/dev com credenciais reais
// (PLAYWRIGHT_*), conforme guard-rails do repositório (M003/M136-C.2).
// ============================================================

const SHOT = "test-results/ux002";
const RESOLUCOES = [
  { nome: "1366x768", width: 1366, height: 768 },
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

// ---------- Validações do modal premium (comuns) ----------
async function validarModalPremium(page: Page, resolucao: string, label: string) {
  // 1. Overlay escuro + painel centralizado presente
  const overlay = page.locator(".fixed.inset-0");
  await expect(overlay.first()).toBeVisible({ timeout: 20000 });
  const bgColor = await overlay.first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");

  // 2. Cabeçalho fixo com botão de fechar
  await expect(page.locator('button[title="Fechar"]').first()).toBeVisible();

  // 3. Faixa de resumo horizontal (indicadores rápidos)
  await expect(page.getByText("Margem %", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Receita", { exact: true }).first()).toBeVisible();

  // 4. Apenas UMA coluna lateral de contexto (painel direito removido)
  await expect(page.getByText("Painel Operacional", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Painel Comercial", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Checklist", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Pendências", { exact: true }).first()).toBeVisible();

  // 5. Rodapé fixo
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar rascunho" })).toBeVisible();

  await page.screenshot({ path: `${SHOT}/${resolucao}-${label}-premium.png` });
}

// ============================================================
// ORDEM DE SERVIÇO
// ============================================================
async function abrirOSNovo(page: Page) {
  await page.goto("/operacao?tab=os&action=novo", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.getByText("Ordem de Serviço", { exact: false }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(800);
}

async function fluxoOS(page: Page, resolucao: string) {
  // Título dinâmico + número
  await expect(page.getByText("Nova Ordem de Serviço", { exact: false }).first()).toBeVisible();
  await validarModalPremium(page, resolucao, "os");

  // Wizard com todas as etapas da OS
  await expect(page.getByText("Identificação", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Carga", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Veículo", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Rotas e Paradas", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Torre & Financeiro", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Histórico", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT}/${resolucao}-os-wizard.png` });

  // Etapa Identificação (cards)
  await expect(page.getByText("Dados do Documento", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Serviço Programado & Status", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Classificação Fiscal da OS", { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT}/${resolucao}-os-etapa-identificacao.png` });

  // Coluna lateral esquerda (dados principais + status + financeiro + indicadores)
  await expect(page.getByText("Operação", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Status", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Financeiro", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Indicadores", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT}/${resolucao}-os-coluna-lateral.png` });

  // Etapa Veículo
  await page.getByText("Veículo", { exact: true }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByText("Dados do Veiculo", { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT}/${resolucao}-os-etapa-veiculo.png` });

  // Etapa Rotas e Paradas
  await page.getByText("Rotas e Paradas", { exact: true }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByText("Itinerário da OS", { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT}/${resolucao}-os-rotas-paradas.png` });

  // Rodapé fixo
  await expect(page.getByRole("button", { name: "Salvar OS" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Avançar/ })).toBeVisible();
  await page.screenshot({ path: `${SHOT}/${resolucao}-os-rodape-fixo.png` });

  // Cancelar (fecha o modal e volta para a lista)
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText("Ordens de Serviço", { exact: true }).first()).toBeVisible({ timeout: 15000 });
}

// ============================================================
// ORÇAMENTO
// ============================================================
async function abrirOrcamentoNovo(page: Page) {
  await page.goto("/comercial?tab=orcamentos&action=novo", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.getByText("Orçamento Comercial", { exact: false }).first().waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(800);
}

async function fluxoOrcamento(page: Page, resolucao: string) {
  await expect(page.getByText("Novo Orçamento Comercial", { exact: false }).first()).toBeVisible();
  await validarModalPremium(page, resolucao, "orc");

  // Wizard com todas as etapas do orçamento
  await expect(page.getByText("Identificação", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Endereços", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Valores", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Docs e PDF", { exact: true }).first()).toBeVisible();

  // Coluna lateral esquerda (contrato + carga & veículo + financeiro)
  await expect(page.getByText("Contrato", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Prioridade & Status", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Carga & Veículo", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT}/${resolucao}-orc-coluna-lateral.png` });

  // Etapa Valores
  await page.getByText("Valores", { exact: true }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByText("Composição de Valores", { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT}/${resolucao}-orc-etapa-valores.png` });

  // Etapa Docs e PDF
  await page.getByText("Docs e PDF", { exact: true }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: /Gerar PDF/ }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT}/${resolucao}-orc-docs-pdf.png` });

  // Rodapé fixo
  await expect(page.getByRole("button", { name: "Salvar Orçamento" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Avançar/ })).toBeVisible();

  // Botão fechar (X) fecha o modal
  await page.locator('button[title="Fechar"]').first().click();
  await page.waitForTimeout(600);
  await expect(page.getByText("Orçamentos", { exact: true }).first()).toBeVisible({ timeout: 15000 });
}

test.describe("UX-002 — Formulário Premium (Ordem de Serviço)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await loginAdmin(page, "ux002");
    await interceptClientes(page);
  });

  for (const res of RESOLUCOES) {
    test(`OS em ${res.nome}`, async ({ page }) => {
      await page.setViewportSize({ width: res.width, height: res.height });
      await abrirOSNovo(page);
      await fluxoOS(page, res.nome);
    });
  }
});

test.describe("UX-002 — Formulário Premium (Orçamento)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await loginAdmin(page, "ux002");
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
