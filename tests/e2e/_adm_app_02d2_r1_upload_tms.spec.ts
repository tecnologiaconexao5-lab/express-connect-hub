/**
 * ADM-APP-02D.2-R1 — Prova híbrida: upload de UM documento TESTE ao
 * Prestador A via fluxo REAL do TMS local (PC), para depois provar a
 * leitura física no APP Android (Redmi) com bucket PRIVADO.
 *
 * Regras da missão (R1-REDMI-CLOSE):
 *  - TMS visual = PC/Playwright (este spec) — NÃO no Redmi.
 *  - UM único documento TESTE (tipo "Outros") vinculado ao Prestador A
 *    (ee4511bb-956e-4ff0-af82-9e61b0bf1870).
 *  - Sem criar usuários/prestadores novos; sem wizard de cadastro.
 *
 * Saída esperada: row em `documentos_prestadores` com url = path estável
 * `doc_ee4511bb-..._Outros_<ts>.png` (NÃO signed URL) + objeto no bucket.
 * Screenshots em test-results/02d2/.
 */
import { test, expect, Page } from "@playwright/test";

const EMAIL = "adm02d2_tms@teste.com";
const SENHA = "Adm02d2!Tms_2026";

const PRESTADOR_A_NOME = "02D2 FIXTURE PREST A";
const TIPO_DOC = "Outros";
const ARQUIVO_TESTE = "scripts/_adm_app_02d2r1_doc_teste.png";

const SHOT_DETALHE = "test-results/02d2/d2r1_tms_upload_ante.png";
const SHOT_APOS = "test-results/02d2/d2r1_tms_upload_apos.png";

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

test.describe("ADM-APP-02D.2-R1 — upload TMS de doc TESTE ao Prestador A", () => {
  test("upload real via TMS local (path doc_<id>_Outros_<ts>)", async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") errosConsole.push(msg.text());
    });

    await login(page);

    // Lista de prestadores → busca Prestador A → abre detalhe
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

    // Aba Documentacao
    const abaDoc = page.locator('button[role="tab"]:has-text("Documentacao")').first();
    await expect(abaDoc).toBeVisible({ timeout: 15000 });
    await abaDoc.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: SHOT_DETALHE, fullPage: true });
    console.log(`[SHOT] ${SHOT_DETALHE}`);

    // Estado antes: card do tipo "Outros" sem doc persistido
    const cardOutros = page.locator("div.rounded-lg, div.border").filter({ hasText: /^Outros/ });
    console.log("[INFO] cards 'Outros' encontrados:", await cardOutros.count());

    // Upload do arquivo TESTE pelo label real do input (fluxo do TMS)
    const inputFile = page.locator(`#doc-upload-${TIPO_DOC}`);
    await expect(inputFile, "input de upload do tipo Outros não existe").toHaveCount(1);
    await inputFile.setInputFiles(ARQUIVO_TESTE);
    console.log(`[UPLOAD] arquivo enviado: ${ARQUIVO_TESTE}`);

    // Sucesso: toast "Outros enviado!" (handleDocUpload)
    await expect(
      page.locator(".sonner-toast, [data-sonner-toast]", { hasText: "Outros enviado!" }).first(),
      "toast de sucesso do upload não apareceu"
    ).toBeVisible({ timeout: 30000 });
    console.log("[OK] toast 'Outros enviado!' visível");

    await page.waitForTimeout(2500);
    await page.screenshot({ path: SHOT_APOS, fullPage: true });
    console.log(`[SHOT] ${SHOT_APOS}`);

    // Asserção em tela: badge do tipo Outros deixou de ser "Pendente"
    const statusOutros = page
      .locator("div.rounded-lg, div.border")
      .filter({ hasText: /^Outros/ })
      .first();
    const texto = await statusOutros.innerText().catch(() => "");
    console.log("[STATUS] card Outros:", JSON.stringify(texto));
    expect(texto, "status do tipo 'Outros' ainda Pendente após upload").not.toMatch(/Pendente/);

    const errosRelevantes = errosConsole.filter((e) =>
      /documentos_prestadores|Upload error|DB error/i.test(e)
    );
    expect(errosRelevantes, `erros no fluxo de upload: ${errosRelevantes.join(" | ")}`).toHaveLength(0);
  });
});
