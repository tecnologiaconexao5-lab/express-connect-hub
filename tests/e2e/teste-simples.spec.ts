import { test, expect } from "@playwright/test";

test.use({
  headless: false,
  launchOptions: { slowMo: 1000 },
});

test("teste-simples — abrir TMS, criar Nova OS ao vivo", async ({ page }) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(30000);

  // 1) Login
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const tentativas: [string, string][] = [
    ["tamiris.castilho@conexaoexpress.com.br", "Admin@123"],
    ["admconexao2@gmail.com", "Di241328!"],
    ["tamiris.castilho@conexaoexpress.com.br", process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026"],
  ];
  let logado = false;
  for (const [email, senha] of tentativas) {
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(senha);
    await page.locator("button").filter({ hasText: "Entrar" }).click();
    await page.waitForTimeout(5000);
    if (!page.url().includes("/login")) {
      logado = true;
      console.log("[TESTE-SIMPLES] login OK com " + email);
      break;
    }
    console.log("[TESTE-SIMPLES] falhou: " + email);
  }
  if (!logado) throw new Error("Nenhuma senha funcionou");

  // 2) Lista de OS
  await page.goto("/operacao?tab=os", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  console.log("[TESTE-SIMPLES] lista de OS aberta. URL=" + page.url());

  // 3) Abrir Nova OS (tentativas genéricas)
  await page.screenshot({ path: "test-results/e2e/teste-simples-lista.png" });
  const btnNova = page
    .getByRole("button")
    .or(page.getByRole("link"))
    .filter({ hasText: /Nova (OS|Ordem)|Criar OS|Nova Ordem/i })
    .first();
  if (await btnNova.count()) {
    await btnNova.click();
    console.log("[TESTE-SIMPLES] botão Nova OS clicado");
  } else {
    const txt = (await page.locator("body").innerText()).slice(0, 600);
    console.log("[TESTE-SIMPLES] botão não achado. Texto da página:\n" + txt);
  }
  await page.waitForTimeout(4000);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(1000);

  // 4) Cliente (Identificação)
  const clienteInput = page.locator('input[placeholder*="Pesquisar"], input[placeholder*="cliente"]').first();
  await clienteInput.click().catch(() => {});
  await clienteInput.type("CLIENTE", { delay: 120 }).catch(() => {});
  await page.waitForTimeout(2500);
  const opcaoCliente = page.locator('[role="option"], [role="menuitem"], li').filter({ hasText: "CLIENTE" }).first();
  if (await opcaoCliente.count()) {
    await opcaoCliente.click().catch(() => {});
    console.log("[TESTE-SIMPLES] cliente selecionado");
  }
  await page.waitForTimeout(1500);

  // 5) Aba Rotas e Paradas
  await page.locator("button, [role='tab'], div").filter({ hasText: "Rotas e Paradas" }).first().click().catch(() => {});
  await page.waitForTimeout(2000);

  // 6) Preencher parada 1 (coleta)
  const logradouro = page.locator('input[placeholder*="Digite o endereço"]').first();
  await logradouro.click().catch(() => {});
  await logradouro.type("Avenida Paulista", { delay: 80 }).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator('input[placeholder="Nº"]').first().fill("1000").catch(() => {});
  await page.waitForTimeout(500);

  // 7) Adicionar parada 2 (entrega)
  await page.locator("button").filter({ hasText: "Adicionar Parada" }).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  const logradouro2 = page.locator('input[placeholder*="Digite o endereço"]').nth(1);
  await logradouro2.click().catch(() => {});
  await logradouro2.type("Rua Augusta", { delay: 80 }).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(1000);

  console.log("[TESTE-SIMPLES] formulário preenchido, clicando em Salvar OS");

  // 8) Salvar
  const btnSalvar = page.getByRole("button").filter({ hasText: "Salvar OS" }).first();
  await btnSalvar.scrollIntoViewIfNeeded().catch(() => {});
  await btnSalvar.click({ force: true }).catch(() => {});
  await page.waitForTimeout(8000);

  // 9) Resultado visível
  const toastOk = await page.getByText(/salva com sucesso/i).isVisible().catch(() => false);
  const toastErr = await page.getByText(/erro ao salvar|Selecione um cliente|Adicione um endereço/i).first().isVisible().catch(() => false);
  console.log(`[TESTE-SIMPLES] sucesso=${toastOk} erro=${toastErr}`);

  await page.screenshot({ path: "test-results/e2e/teste-simples-final.png" });
  console.log("[TESTE-SIMPLES] teste concluído — janela permanece aberta até o timeout");
});
