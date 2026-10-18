/**
 * ADM-APP-02D.2 — Prova E2E TMS: fotos/documentos de prestadores via signed URL
 * (bucket `documentos_prestadores` PRIVADO) + correção GAP-01 em AnaliseLote.
 *
 * Itens:
 *  1. Login fixture TMS (adm02d2_tms@teste.com) — botões/campos de login.
 *  2. Detalhe de prestador com foto/documentos → <img> com src
 *     `/object/sign/documentos_prestadores/` (signed URL) e naturalWidth > 0.
 *  3. /cadastros/analise-documentos → aba "Análise em Lote" renderiza lista
 *     (prova GAP-01: SELECT `id, prestador_id, tipo, url` funciona em tela).
 *
 * NÃO altera src/ nem migrations. Screenshots em test-results/02d2/.
 */
import { test, expect, Page } from "@playwright/test";

const EMAIL = "adm02d2_tms@teste.com";
const SENHA = "Adm02d2!Tms_2026";

const SHOT_DETALHE = "test-results/02d2/tms_prestador_detalhe.png";
const SHOT_LOTE = "test-results/02d2/tms_analise_lote.png";

/** Candidatos a prestador com foto (prefixo foto_<id>_) e documentos no bucket. */
const CANDIDATOS = ["FRANKLIN", "BRUNO", "CLAYTON", "CESAR", "DIEGO"];

const errosConsole: string[] = [];

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 15000 });

  // Item 1 — botões/campos de login presentes
  const passInput = page.locator('input[type="password"]').first();
  const btnEntrar = page.locator('button:has-text("Entrar")').first();
  await expect(emailInput).toBeVisible();
  await expect(passInput).toBeVisible();
  await expect(btnEntrar).toBeVisible();

  await emailInput.fill(EMAIL);
  await passInput.fill(SENHA);
  await btnEntrar.click();

  // Sessão estabelecida: sai da tela de login
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  await page.waitForTimeout(2500);
  await expect(page.locator('input[type="password"]').first()).toBeHidden({ timeout: 15000 });
}

/**
 * Navegação SPA. Tenta page.goto direto; se cair no "Carregando sessão..."
 * (bug conhecido de rota lazy em full reload), navega via sidebar.
 */
async function navegar(page: Page, caminho: string, tituloPai: string, tituloFilho: string) {
  await page.goto(caminho, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";
  if (bodyText.includes("Carregando sessão")) {
    console.log(`[NAV] full reload travou em "${caminho}" — usando sidebar (${tituloPai} > ${tituloFilho})`);
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

test.describe("ADM-APP-02D.2 — TMS renderiza docs de prestador com bucket privado", () => {
  test.beforeAll(() => {
    errosConsole.length = 0;
  });

  test("Item 1+2: login fixture + detalhe de prestador com signed URL", async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") errosConsole.push(msg.text());
    });

    // ── Item 1: login ──
    await login(page);
    console.log("[OK] Item 1 — login fixture TMS realizado");

    // ── Item 2: lista de prestadores ──
    await navegar(page, "/cadastros/prestadores", "Cadastros Base", "Prestadores");
    await expect(page.getByRole("heading", { name: /Prestadores/i }).first()).toBeVisible({ timeout: 15000 });

    let detalheAberto = false;
    let candidatoUsado = "";

    for (const nome of CANDIDATOS) {
      const busca = page.locator('input[placeholder*="Buscar por nome"]');
      await busca.waitFor({ state: "visible", timeout: 15000 });
      await busca.fill(nome);
      await page.waitForTimeout(1800);

      const linha = page.locator("tbody tr", { hasText: new RegExp(nome, "i") }).first();
      const temLinha = await linha.count().catch(() => 0);
      if (!temLinha) {
        console.log(`[NAV] candidato "${nome}" não encontrado na lista`);
        continue;
      }

      await linha.click();
      await page.waitForTimeout(3500);

      // Aguarda resolução da foto (signed URL) no card lateral do detalhe
      const imgSigned = page.locator('img[src*="/object/sign/documentos_prestadores/"]').first();
      try {
        await imgSigned.waitFor({ state: "visible", timeout: 12000 });
      } catch {
        console.log(`[NAV] "${nome}" abriu detalhe mas sem signed URL — voltando e tentando próximo`);
        await page.goto("/cadastros/prestadores", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2500);
        continue;
      }

      detalheAberto = true;
      candidatoUsado = nome;
      break;
    }

    expect(detalheAberto, "Nenhum prestador da lista renderizou <img> com signed URL de documentos_prestadores").toBe(true);
    console.log(`[OK] Item 2 — detalhe do prestador candidato "${candidatoUsado}" com signed URL`);

    // Asserções: signed URL no src + imagem realmente carregou
    const img = page.locator('img[src*="/object/sign/documentos_prestadores/"]').first();
    const src = await img.getAttribute("src");
    console.log(`[IMG] src = ${src}`);
    expect(src).toContain("/object/sign/documentos_prestadores/");

    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    console.log(`[IMG] naturalWidth = ${naturalWidth}`);
    expect(naturalWidth, "Imagem via signed URL não carregou (naturalWidth = 0)").toBeGreaterThan(0);

    await page.screenshot({ path: SHOT_DETALHE, fullPage: true });
    console.log(`[SHOT] ${SHOT_DETALHE}`);
  });

  test("Item 3: aba Análise em Lote renderiza lista (GAP-01)", async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") errosConsole.push(msg.text());
    });

    await login(page);
    await navegar(page, "/cadastros/analise-documentos", "Cadastros Base", "Análise de Documentos");

    await expect(page.getByRole("heading", { name: /Análise de Documentos/i }).first()).toBeVisible({ timeout: 15000 });

    // Aba "lote" (default) — clica para garantir estado explícito
    const abaLote = page.locator('button:has-text("Análise em Lote")').first();
    await expect(abaLote).toBeVisible();
    await abaLote.click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole("heading", { name: /Análise em Lote de Documentos/i })).toBeVisible({ timeout: 15000 });

    // Tabela "Prestadores com Documentos" deve renderizar linhas (GAP-01)
    const linhas = page.locator("tbody tr");
    await expect(linhas.first()).toBeVisible({ timeout: 20000 });
    const total = await linhas.count();
    console.log(`[GAP-01] linhas na tabela de lote: ${total}`);
    expect(total, "Tabela da aba Lote vazia — GAP-01 não comprovado em tela").toBeGreaterThan(0);

    // Os documentos conjuntados devem aparecer como badges de tipo (CNH/CRLV/ANTT/...)
    const corpo = await page.locator("tbody").innerText();
    const temBadgeDoc = /CNH|CRLV|ANTT|Comprovante|Documento Pessoal|Ap[óo]lice/i.test(corpo);
    console.log(`[GAP-01] badges de tipo de documento presentes: ${temBadgeDoc}`);
    expect(temBadgeDoc, "Nenhum badge de tipo de documento na tabela (join documentos_prestadores falhou)").toBe(true);

    // Erros de coluna inexistente indicariam regressão do GAP-01
    const errosGap = errosConsole.filter((e) =>
      /documentos_prestadores|column .* does not exist|PGRST204|schema cache/i.test(e)
    );
    console.log(`[GAP-01] erros de console relacionados: ${errosGap.length}`);
    if (errosGap.length) console.log(JSON.stringify(errosGap, null, 2));
    expect(errosGap, `Erros de console indicando SELECT inválido: ${errosGap.join(" | ")}`).toHaveLength(0);

    await page.screenshot({ path: SHOT_LOTE, fullPage: true });
    console.log(`[SHOT] ${SHOT_LOTE}`);
  });
});
