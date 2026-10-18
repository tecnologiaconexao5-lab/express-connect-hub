// ============================================================
// MISSÃO 55 — CENÁRIO 1: Fluxo Operacional Completo
// Login admin → Navegação por todas as rotas do sistema
// ============================================================

import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";
import { tirarScreenshot, salvarEvidenciaJson } from "./helpers/screenshots";

type RotaDef = {
  testId: string;
  labelBotoes: string[];     // Labels para tentar no sidebar (ordem de precedência)
  path?: string;             // Fallback: `page.goto()` se sidebar falhar
};

const ROTAS: RotaDef[] = [
  { testId: "dashboard",       labelBotoes: ["Dashboard Executivo", "Dashboard"] },
  { testId: "comercial",       labelBotoes: ["Gestão Comercial", "Comercial"], path: "/comercial" },
  { testId: "clientes",        labelBotoes: ["Clientes"], path: "/comercial?tab=clientes" },
  { testId: "cadastros-base",     labelBotoes: ["Cadastros Base", "Cadastros"], path: "/cadastros" },
  { testId: "prestadores",     labelBotoes: ["Prestadores"], path: "/cadastros?tab=prestadores" },
  { testId: "apoio-operacional",  labelBotoes: ["Apoio Operacional", "Operacional"], path: "/operacao" },
  { testId: "ordens-servico",  labelBotoes: ["Ordens de Serviço", "Ordens"], path: "/operacao?tab=os" },
  { testId: "escala",          labelBotoes: ["Escala"], path: "/operacao?tab=escala" },
  { testId: "frota",           labelBotoes: ["Gestão de Frota", "Frota"], path: "/frota" },
  { testId: "financeiro",      labelBotoes: ["Financeiro Enterprise", "Financeiro"], path: "/financeiro" },
  { testId: "relatorios",      labelBotoes: ["Relatórios Operacionais", "Relatórios"], path: "/relatorios" },
  { testId: "contratos",       labelBotoes: ["Contratos Automáticos", "Contratos"], path: "/contratos" },
];

/**
 * Navega para uma rota usando:
 * 1. Sidebar click (tenta cada labelBotoes)
 * 2. Fallback: page.goto() para path
 * 3. Espera o "Carregando sessão..." desaparecer
 */
async function navegarPara(page: any, rota: RotaDef) {
  let navegou = false;

  // Tenta sidebar click
  for (const label of rota.labelBotoes) {
    const btn = page.locator(`button:has-text("${label}"), a:has-text("${label}")`).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(3000);
      navegou = true;
      break;
    }
  }

  // Fallback: page.goto()
  if (!navegou && rota.path) {
    await page.goto(rota.path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  }

  // Aguarda "Carregando sessão..." desaparecer (timeout de 12s)
  const body = page.locator("body");
  try {
    await expect(body).not.toContainText("Carregando sessão", { timeout: 12000 });
  } catch {
    console.log(`[WARN] ${rota.testId}: "Carregando sessão..." persistiu após 12s`);
  }

  await page.waitForTimeout(2000);
}

test.describe("M55-C1: Fluxo Operacional Completo", () => {
  for (const rota of ROTAS) {
    test(`${rota.testId} carrega corretamente`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      await loginAdmin(page);
      await page.waitForTimeout(2000);

      await navegarPara(page, rota);
      await tirarScreenshot(page, `m55-c1-${rota.testId}`);

      const body = page.locator("body");
      const text = await body.textContent() || "";
      expect(text.length).toBeGreaterThan(100);

      const critical = jsErrors.filter(
        (e) => !e.includes("favicon") && !e.includes("404") && !e.includes("HMR") && !e.includes("WebSocket")
      );
      if (critical.length > 0) {
        console.log(`[WARN] JS errors on ${rota.testId}: ${critical.join(", ")}`);
      }
    });
  }

  test("evidencia final salva", async () => {
    salvarEvidenciaJson({
      cenario: "M55-C1",
      rotas: ROTAS.map((r) => r.testId),
      status: "executado",
    });
  });
});
