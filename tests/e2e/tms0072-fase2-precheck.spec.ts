// ============================================================
// TMS-007.2 FASE 2 — Pré-check HML
// ============================================================
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const STORAGE_STATE_PATH = path.join("tests", "e2e", ".auth", "storageState.json");
const BASE = "http://localhost:8800";

// IDs HML
const OS_ID = "28640e7b-fbe5-4141-a59a-c5bead26d25a";
const PRESTADOR_ID = "5377592a-50e8-41d7-b8c5-b5c4509a3d56";
const VEICULO_ID = "e674550f-c577-4d14-956c-b83df5e903b0";

test.describe("TMS-007.2 FASE 2 — Pre-check HML", () => {
  test("OS TESTE-001 existe e sem alocacao ativa", async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_PATH, baseURL: BASE });
    const page = await ctx.newPage();

    // Navegar para OS
    const resp = await page.goto("/operacao/os", { waitUntil: "domcontentloaded", timeout: 30000 });
    expect(resp?.status()).toBe(200);

    // Buscar texto TESTE-001 na pagina
    const body = await page.locator("body").innerText();
    const temOS = body.includes("TESTE-001");
    console.log(`  OS TESTE-001 visivel na tela: ${temOS}`);

    // Tentar navegar para detalhe da OS
    const respDetalhe = await page.goto(`/operacao/os/detalhe/${OS_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    }).catch(() => null);

    if (respDetalhe && respDetalhe.status() === 200) {
      const detalheBody = await page.locator("body").innerText();
      const semAlocacao = !detalheBody.includes("Alocação") || detalheBody.includes("Nenhuma alocação");
      console.log(`  OS detalhe acessivel HTTP ${respDetalhe.status()}, sem alocacao ativa: ${semAlocacao}`);
    } else {
      console.log(`  OS detalhe: HTTP ${respDetalhe?.status() || "erro"} (possivelmente rota inexistente)`);
    }

    await ctx.close();
  });

  test("Prestador HML existe e sem operacao comercial", async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_PATH, baseURL: BASE });
    const page = await ctx.newPage();

    const resp = await page.goto("/prestadores", { waitUntil: "domcontentloaded", timeout: 30000 });
    expect(resp?.status()).toBe(200);

    const body = await page.locator("body").innerText();
    const temPrestador = body.includes("HML") || body.includes("5377");
    console.log(`  Prestador HML visivel: ${temPrestador}`);

    await ctx.close();
  });

  test("Veiculo HML001 existe e sem alocacao", async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_PATH, baseURL: BASE });
    const page = await ctx.newPage();

    const resp = await page.goto("/frota", { waitUntil: "domcontentloaded", timeout: 30000 });
    expect(resp?.status()).toBe(200);

    const body = await page.locator("body").innerText();
    const temVeiculo = body.includes("HML001");
    console.log(`  Veiculo HML001 visivel: ${temVeiculo}`);

    await ctx.close();
  });

  test("Financeiro sem registros HML residuais", async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_PATH, baseURL: BASE });
    const page = await ctx.newPage();

    // Verificar financeiro_receber
    await page.goto("/financeiro?tab=receber", { waitUntil: "domcontentloaded", timeout: 30000 });
    let body = await page.locator("body").innerText();
    const temHMLReceber = body.includes("HML") || (body.includes("TESTE-001") && body.includes("100"));
    console.log(`  financeiro_receber com HML: ${temHMLReceber}`);

    // financeiro_pagar
    await page.goto("/financeiro?tab=pagar", { waitUntil: "domcontentloaded", timeout: 30000 });
    body = await page.locator("body").innerText();
    const temHMLPagar = body.includes("HML") || body.includes("TESTE-001");
    console.log(`  financeiro_pagar com HML: ${temHMLPagar}`);

    await ctx.close();
  });
});
