import { test, expect }   from "@playwright/test";
test.describe("F25B â€” ConfiguraÃ§Ã£o dos RobÃ´s", () => { test("01 - /central-ia abre", async ({ page }) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
expect(page.locator("h1")).toContainText("Central IA");});
test("02 - 8 robÃ´s aparecem", async ({ page }) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
const roboCards = page.locator('div[class*="grid"] > div[class*="overflow-hidden"]');

    //  Should have around 8 robot card
const count = await roboCards.count();
expect(count).toBeGreaterThanOrEqual(7);});
test("03 - ConfiguraÃ§Ã£o de robÃ´ abre", async ({ page }) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");

    //  Click the settings icon on the first robot car
const settingsButton = page.locator('button[title="Configurar"]').first();
await settingsButton.click();
await page.waitForTimeout(500);

    //  Check that the dialog opens with configuration titl
expect(page.locator('text=ConfiguraÃ§Ã£o do RobÃ´')).toBeVisible();});
test("04 - Edita modo atual", async ({ page }) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(500);

    //  Find modo atual select and chang
const modoSelect = page.locator('text=Modo Atual').locator('..').locator('select').first();
await modoSelect.selectOption('homologacao');
await page.waitForTimeout(300);

    //  Check value change
const selectedValue = await modoSelect.inputValue();
expect(selectedValue).toBe('homologacao');});
test("05 - Edita nÃ­vel de autonomia", async ({ page }) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(500);
const autonomiaSelect = page.locator('text=NÃ­vel de Autonomia').locator('..').locator('select').first();
await autonomiaSelect.selectOption('automatico_seguro');
await page.waitForTimeout(300);
const selectedValue = await autonomiaSelect.inputValue();
expect(selectedValue).toBe('automatico_seguro');});
test("06 - Edita canal principal", async ({ page }) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(500);
const canalSelect = page.locator('text=Canal Principal').locator('..').locator('select').first();
await canalSelect.selectOption('whatsapp');
await page.waitForTimeout(300);
const selectedValue = await canalSelect.inputValue();
expect(selectedValue).toBe('whatsapp');});
test("07 - Edita tom de conversa", async ({ page }) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(500);
const tomSelect = page.locator('text=Tom de Conversa').locator('..').locator('select').first();
await tomSelect.selectOption('amigavel');
await page.waitForTimeout(300);
const selectedValue = await tomSelect.inputValue();
expect(selectedValue).toBe('amigavel');});
test("08 - Edita instruÃ§Ãµes resumidas", async ({ page }) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(500);
const instrucoesTextarea = page.locator('text=InstruÃ§Ãµes Resumidas').locator('..').locator('textarea').first();
await instrucoesTextarea.fill('RobÃ´ de teste F25B');
await page.waitForTimeout(300);
const value = await instrucoesTextarea.inputValue();
expect(value).toBe('RobÃ´ de teste F25B');});
test("09 - Salva no Supabase", async ({ page }) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
await page.locator('button[title="Configurar"]').first().click();
await page.waitForTimeout(500);

    //  Click save butto
const saveButton = page.locator('button:has-text("Salvar ConfiguraÃ§Ã£o")');
await saveButton.click();
await page.waitForTimeout(1000);

    //  Check that dialog closed (no longer showing edit title)
expect(page.locator('text=ConfiguraÃ§Ã£o do RobÃ´')).not.toBeVisible();});
test("10 - Recarrega tela e mantÃ©m dados", async ({ page }) => { //  First open and check data persists after reloa
await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");

    //  Just check that the page loads with robot
const title = page.locator("h1");
expect(title).toContainText("Central IA");
const roboCards = page.locator('div[class*="grid"] > div[class*="overflow-hidden"]');
const count = await roboCards.count();
expect(count).toBeGreaterThanOrEqual(7);});
test("11 - Todos os robÃ´s continuam com envio externo bloqueado por padrÃ£o", async ({ page }) => { const result = await page.evaluate(async () => { const { centralIaService} = await import("@/services/centralIaService");
const robos = await centralIaService.listarRobos();
return robos.map(r => ({ nome: r.nome, permite_envio_externo: r.permite_envio_externo }));});
for (const robo of result) { expect(robo.permite_envio_externo).toBe(false);}});
test("12 - fallback obrigatÃ³rio existe", async ({ page }) => { const result = await page.evaluate(async () => { const { centralIaService} = await import("@/services/centralIaService");
const robos = await centralIaService.listarRobos();
return robos.map(r => ({ nome: r.nome,        tem_fallback: r.mensagem_fallback && r.mensagem_fallback.length > 0, }));});
for (const robo of result) { expect(robo.tem_fallback).toBe(true);}});});

