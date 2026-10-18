import { test, expect }   from "@playwright/test";
import path   from "path";
import { createClient }   from "@supabase/supabase-js";
const SCREENSHOT_DIR = "test-results/e2e/f25fa3-biblioteca";
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TEST_DIR = path.resolve("test-results/f25fa3-files");
async function login(page) {
await page.goto("/", {

    waitUntil: "domcontentloaded"});
await page.waitForTimeout(2000);
const loginForm = page.locator('input[type="email"], input[placeholder*="email"], button:has-text("Entrar")');
if (await loginForm.first().isVisible().catch(() => false)) {
await page.locator('input[type="email"], input[placeholder*="email"]').first().fill("tamiris.castilho@conexaoexpress.com.br");
await page.locator('input[type="password"]').first().fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
await page.locator('button:has-text("Entrar")').click();
await page.waitForTimeout(3000);}};
test.describe("F25FA.3 â€” Biblioteca de Arquivos para Treinamento", () => {
test("Upload PDF, imagem, alterar status, filtrar + console limpo", async ({ page }) => {
    //  === PREPARAÃ‡ÃƒO ==
    const jsErrors = [];
const networkErrors = [];

    page.on("console", (msg) => {
if (msg.type() === "error") {
const text = msg.text();
if (text.includes("400") || text.includes("Failed to load resource")) networkErrors.push(text);

        else jsErrors.push(text);}});

    page.on("pageerror", (err) => jsErrors.push(`Page Error: ${err.message}`));
const fs = await import("fs");
if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, {

      recursive: true});

    //  Criar arquivos de teste reai
const pdfPath = path.join(TEST_DIR, "teste-treinamento.pdf");
const imgPath = path.join(TEST_DIR, "teste-treinamento.png");

    fs.writeFileSync(pdfPath, "%PDF-1.4 Fake PDF for testing F25FA.3");
const imgBuffer = Buffer.alloc(100, 0x89);

    imgBuffer[0] = 0x89;

    imgBuffer[1] = 0x50;

    imgBuffer[2] = 0x4e;

    imgBuffer[3] = 0x47;

    imgBuffer[4] = 0x0d;

    imgBuffer[5] = 0x0a;

    imgBuffer[6] = 0x1a;

    imgBuffer[7] = 0x0a;

    fs.writeFileSync(imgPath, imgBuffer);

    //  Limpar dados de teste anteriore
await supabase.from("treinamento_arquivos_ia").delete().ilike("nome_original", "teste-treinamento%");

    //  === LOGIN + NAVEGAÃ‡ÃƒO ==
    await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto("/central-ia", {

      waitUntil: "domcontentloaded"});
await page.waitForTimeout(3000);

    //  Verificar que a pÃ¡gina carregou os robÃ´
await page.waitForTimeout(2000);

    //  Tentar encontrar o botÃ£o Configurar (pode ser button, svg ou outro elemento com title
const editBtn = page.locator('button[title="Configurar"], [title="Configurar"]').first();
expect(editBtn).toBeVisible({ timeout: 10000 });
await page.waitForTimeout(500);
await editBtn.click();
await page.waitForTimeout(2500);
const dialog = page.locator('[role="dialog"]').first();
expect(dialog).toBeVisible({ timeout: 3000 });

    //  === TESTE 1: ABA BIBLIOTECA ==
    const bibliotecaTab = dialog.locator('[role="tab"]').filter({ hasText: "Biblioteca" }).first();
expect(bibliotecaTab).toBeVisible({ timeout: 3000 });
await bibliotecaTab.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-aba-biblioteca.png"),      fullPage: false, });

    //  Verificar que o tÃ­tulo "Upload Arquivo" estÃ¡ visÃ­ve
expect(dialog.locator('button:has-text("Upload Arquivo")')).toBeVisible({ timeout: 3000 });

    //  === TESTE 2: UPLOAD PDF ==
    const fileInput = dialog.locator('input[type="file"]');
await fileInput.setInputFiles(pdfPath);
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-upload-pdf.png"),      fullPage: false, });

    //  Verificar que o PDF aparece na list
const bodyText = await page.locator("body").textContent();
expect(bodyText).toContain("teste-treinamento.pdf");
expect(bodyText).not.toContain("ErrorBoundary");

    //  Verificar no banc
const {

      data: pdfReg} = await supabase      .from("treinamento_arquivos_ia")      .select("*")      .eq("nome_original", "teste-treinamento.pdf")      .single();
expect(pdfReg).not.toBeNull();
expect(pdfReg.mime_type).toContain("pdf");
expect(pdfReg.status).toBe("ativo");
expect(pdfReg.tamanho_bytes).toBeGreaterThan(0);
expect(pdfReg.robo_id).toBeTruthy();
const pdfId = pdfReg.id;
const pdfPathStorage = pdfReg.caminho_storage;

    console.log(`PDF registrado: ${pdfId} / storage: ${pdfPathStorage}`);

    //  Verificar que o arquivo estÃ¡ no Storag
const {

      data: storageFile} = await supabase.storage.from("biblioteca-global").list("treinamento-ia", {

      limit: 100});
const encontradoStorage = storageFile?.some((f) => f.name === pdfPathStorage.split("/").pop());
expect(encontradoStorage).toBe(true);

    console.log("PDF confirmado no Storage");

    //  === TESTE 3: UPLOAD IMAGEM ==
    await fileInput.setInputFiles(imgPath);
await page.waitForTimeout(3000);
const bodyText2 = await page.locator("body").textContent();
expect(bodyText2).toContain("teste-treinamento.png");
const {

      data: imgReg} = await supabase      .from("treinamento_arquivos_ia")      .select("*")      .eq("nome_original", "teste-treinamento.png")      .single();
expect(imgReg).not.toBeNull();
expect(imgReg.mime_type).toContain("png");
const imgId = imgReg.id;

    console.log(`Imagem registrada: ${imgId}`);

    //  === TESTE 4: FILTRO POR TIPO ==
    await dialog.locator('label:has-text("Tipo")').locator('..').locator('[role="combobox"]').first().click();
await page.waitForTimeout(300);

    //  Selecionar tipo "imagem"
    await page.getByRole('option', {

      name: 'imagem', exact: true}).click();
await page.waitForTimeout(500);
const bodyFiltro = await page.locator("body").textContent();
expect(bodyFiltro).toContain("teste-treinamento.png");
expect(bodyFiltro).not.toContain("teste-treinamento.pdf");

    console.log("Filtro por tipo funcionando");

    //  Resetar filtr
await dialog.locator('label:has-text("Tipo")').locator('..').locator('[role="combobox"]').first().click();
await page.waitForTimeout(200);
await page.getByRole('option', {

      name: 'Todos os tipos', exact: true}).click();
await page.waitForTimeout(500);

    //  === TESTE 5: ARQUIVAR E REATIVAR ===    // Clicar no botÃ£o "Arquivar" do PD
const pdfCard = dialog.locator(`text="teste-treinamento.pdf"`).first();
expect(pdfCard).toBeVisible({ timeout: 3000 });
const pdfCardContainer = pdfCard.locator("..").locator("..");
const arquivarBtn = pdfCardContainer.locator('button:has-text("Arquivar")');
if (await arquivarBtn.isVisible().catch(() => false)) {
await arquivarBtn.click();
await page.waitForTimeout(1000);}
    //  Verificar que o status mudo
const {

      data: pdfArquivado} = await supabase      .from("treinamento_arquivos_ia")      .select("status")      .eq("id", pdfId)      .single();
expect(pdfArquivado.status).toBe("arquivado");

    console.log("PDF arquivado com sucesso");

    //  Reativa
const pdfCard2 = dialog.locator(`text="teste-treinamento.pdf"`).first();
const pdfCardContainer2 = pdfCard2.locator("..").locator("..");
const ativarBtn = pdfCardContainer2.locator('button:has-text("Ativar")');
if (await ativarBtn.isVisible().catch(() => false)) {
await ativarBtn.click();
await page.waitForTimeout(1000);}    const {

      data: pdfAtivo} = await supabase      .from("treinamento_arquivos_ia")      .select("status")      .eq("id", pdfId)      .single();
expect(pdfAtivo.status).toBe("ativo");

    console.log("PDF reativado");

    //  === TESTE 6: LIMPEZA ===    // Excluir ambos os arquivos via U
for (const nome of ["teste-treinamento.pdf", "teste-treinamento.png"]) {
const card = dialog.locator(`text="${nome}"`).first();
if (await card.isVisible().catch(() => false)) {
const container = card.locator("..").locator("..");

        // Accept confirm dialog        page.once("dialog", (d) => d.accept());
await container.locator('button:has-text("Excluir")').click();
await page.waitForTimeout(1500);}
      //  Fallback: deletar direto do banc
await supabase.from("treinamento_arquivos_ia").delete().eq("nome_original", nome);}    console.log("Dados de teste removidos");

    //  === TESTE 7: CONSOLE LIMPO ==
    const realJsErrors = jsErrors.filter(e => !e.includes("validateDOMNesting") && !e.includes("Warning"));

    console.log(`Erros JS reais: ${realJsErrors.length}`);

    console.log(`Network errors: ${networkErrors.length}`);

    realJsErrors.forEach(e => console.log(`  ${e}`));
expect(realJsErrors.length).toBe(0);});});

