/**
 * ADM-APP-02D.2-R2 — Preparação híbrida: liberar o Prestador A (fixture
 * 02D2 FIXTURE PREST A) no aplicativo pelo fluxo REAL do TMS local (PC),
 * porque o Auth Gate homologado do App (AG-07J.7 / AuthStatusMapper) só
 * concede /home quando (status ativo|Aprovado) AND liberado_app = true.
 * Sem isso a prova física de visualização do documento no Redmi fica
 * bloqueada na tela "Cadastro enviado para análise" (fail-closed).
 *
 * Regras da missão (R2):
 *  - Ação SOMENTE no prestador FIXTURE (dados de teste), nunca em prestador real.
 *  - Fluxo 100% de UI do TMS (PC/Playwright), sem update direto no banco.
 *  - Coerência E2E-05D preservada: switch só efetivo com status "ativo".
 *
 * Screenshots: test-results/02d2/d2r2_tms_liberar_{ante,apos}.png
 */
import { test, expect, Page } from "@playwright/test";

const EMAIL = "adm02d2_tms@teste.com";
const SENHA = "Adm02d2!Tms_2026";

const PRESTADOR_A_NOME = "02D2 FIXTURE PREST A";

const SHOT_ANTE = "test-results/02d2/d2r2_tms_liberar_ante.png";
const SHOT_APOS = "test-results/02d2/d2r2_tms_liberar_apos.png";

const errosConsole: string[] = [];

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  const emailInput = page
    .locator('input[type="email"], input[placeholder*="email"]')
    .first();
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(SENHA);
  await page.locator('button:has-text("Entrar")').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: 30000,
  });
  await page.waitForTimeout(2500);
}

async function navegar(page: Page, caminho: string, tituloPai: string, tituloFilho: string) {
  await page.goto(caminho, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";
  if (bodyText.includes("Carregando sessão")) {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    const pai = page.locator(`button[title="${tituloPai}"]`).first();
    if (await pai.isVisible().catch(() => false)) {
      const aberto = await page.locator(`button[title="${tituloFilho}"]`).first().isVisible().catch(() => false);
      if (!aberto) await pai.click();
      await page.waitForTimeout(600);
    }
    await page.locator(`button[title="${tituloFilho}"]`).first().click({ timeout: 15000 });
    await page.waitForTimeout(2500);
  }
}

test.describe("ADM-APP-02D.2-R2 — liberar Prestador A (fixture) no app via TMS", () => {
  test("switch 'Liberado no Aplicativo' ligado e persistido pelo TMS", async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") errosConsole.push(msg.text());
    });

    await login(page);

    await navegar(page, "/cadastros/prestadores", "Cadastros Base", "Prestadores");
    await expect(
      page.getByRole("heading", { name: /Prestadores/i }).first()
    ).toBeVisible({ timeout: 15000 });

    const busca = page.locator('input[placeholder*="Buscar por nome"]');
    await busca.waitFor({ state: "visible", timeout: 15000 });
    await busca.fill(PRESTADOR_A_NOME);
    await page.waitForTimeout(2000);

    const linha = page.locator("tbody tr", { hasText: /02D2 FIXTURE PREST A/i }).first();
    await expect(linha, "Prestador A não apareceu na lista do TMS").toBeVisible({ timeout: 15000 });
    await linha.click();
    await page.waitForTimeout(3500);

    const abaDados = page.locator('button[role="tab"]:has-text("Dados Gerais")').first();
    await expect(abaDados).toBeVisible({ timeout: 15000 });
    await abaDados.click();
    await page.waitForTimeout(1200);

    // O fixture nasceu sem cpf_cnpj (insert mínimo do fixture.mjs) e o
    // handleSave exige "Nome completo", "CPF/CNPJ", "Tipo de parceiro" e
    // "Status" -> sem CPF o save é recusado com toast de validação.
    // Preenche pelo CAMPO REAL da UI (fluxo do TMS), com o CPF TESTE
    // gerado na R1 (37921704697: tabela=0, RPC app_s6=false, não usado).
    const inputCpf = page.locator('label:text-is("CPF / CNPJ") + input').first();
    await expect(inputCpf, "campo CPF / CNPJ não existe na aba Dados Gerais").toBeVisible({ timeout: 15000 });
    if (!(await inputCpf.inputValue())) {
      await inputCpf.fill("37921704697");
      console.log("[INFO] CPF/CNPJ do fixture preenchido pela UI do TMS: 37921704697");
    }

    const switchLoc = page.locator("#liberado_app").first();
    await expect(switchLoc, "switch #liberado_app não existe na aba Dados Gerais").toBeVisible({ timeout: 15000 });
    await switchLoc.scrollIntoViewIfNeeded();

    await page.screenshot({ path: SHOT_ANTE, fullPage: true });
    console.log(`[SHOT] ${SHOT_ANTE}`);

    const antes = await switchLoc.getAttribute("data-state");
    console.log("[INFO] data-state antes:", antes);

    const cardLiberado = page.locator("div.rounded-lg, div.border, div.card").filter({ hasText: /Liberado no Aplicativo/i }).first();
    const textoAntes = await cardLiberado.innerText().catch(() => "");
    console.log("[INFO] card antes:", JSON.stringify(textoAntes));

    if (antes !== "checked") {
      await switchLoc.click();
      await page.waitForTimeout(600);
    }
    const depois = await switchLoc.getAttribute("data-state");
    expect(depois, "switch não ficou checked após clique").toBe("checked");

    const btnSalvar = page.locator('button:has-text("Salvar Prestador")').first();
    await expect(btnSalvar).toBeVisible({ timeout: 15000 });
    await btnSalvar.click();

    await expect(
      page.locator(".sonner-toast, [data-sonner-toast]", { hasText: "Prestador atualizado com sucesso!" }).first(),
      "toast de sucesso do save não apareceu"
    ).toBeVisible({ timeout: 30000 });
    console.log("[OK] toast 'Prestador atualizado com sucesso!' visível");

    await page.waitForTimeout(2000);
    await page.screenshot({ path: SHOT_APOS, fullPage: true });
    console.log(`[SHOT] ${SHOT_APOS}`);

    const errosRelevantes = errosConsole.filter((e) =>
      /SUPABASE ERROR|Erro ao salvar prestador|Erro ao salvar dados/i.test(e)
    );
    expect(errosRelevantes, `erros ao salvar: ${errosRelevantes.join(" | ")}`).toHaveLength(0);
  });
});
