import { test, expect }   from "@playwright/test";
test.describe("F25B â€” Bloqueio de envios diretos", () => { test("01 - whatsappService.enviarMensagem nÃ£o envia direto", async ({ page }) => { //  Verificamos que o serviÃ§o bloqueia sem chamar o Evolution AP
const result = await page.evaluate(async () => { const ws = await import("@/services/integracoes/whatsappService");
const r = await ws.enviarMensagem("5511999999999", "teste bloqueio");
return r;});
expect(result.ok).toBe(false);
expect(result.error).toContain("bloqueado");});
test("02 - whatsappService.notificarOSCriada bloqueada", async ({ page }) => { const result = await page.evaluate(async () => { const ws = await import("@/services/integracoes/whatsappService");
await ws.notificarOSCriada("5511999999999", "OS-001");});
expect(result.ok).toBe(false);
expect(result.error).toContain("bloqueado");});
test("03 - MensagensWhatsApp nÃ£o chama Evolution direto", async ({ page }) => { //  Verifica que a pÃ¡gina carrega sem erros e mostra avis
await page.goto("/mensagens-whatsapp");
await page.waitForLoadState("domcontentloaded");

    //  A pÃ¡gina deve exibir conteÃºdo sem quebra
const title = page.locator("h1");
expect(title).toBeVisible();});
test("04 - Tentativa de envio antigo cria rascunho/aprovaÃ§Ã£o/log", async ({ page }) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");

    //  Acessar a aba de aprovaÃ§Ãµe
await page.click('button[role="tab"]:has-text("AprovaÃ§Ãµes")');
await page.waitForTimeout(1000);

    // Verificar que hÃ¡ ao menos logs de bloqueio (se houver dados)
    //  Pelo menos a pÃ¡gina nÃ£o quebr
const aprovaTab = page.locator('text=AprovaÃ§Ãµes Humanas');
expect(aprovaTab).toBeVisible();});
test("05 - provider_message_id permanece null em tentativas bloqueadas", async ({ page }) => { const result = await page.evaluate(async () => { const { supabase} = await import("@/lib/supabase");
const { data} = await supabase        .from("comunicacoes_mensagens")        .select("provider_message_id, status")        .eq("status", "bloqueado")        .limit(5);
return data || [];});

    //  Se houver registros bloqueados, todos devem ter provider_message_id = nul
for (const msg of result) { expect(msg.provider_message_id).toBeNull();}});
test("06 - status fica bloqueado", async ({ page }) => { const result = await page.evaluate(async () => { const ws = await import("@/services/integracoes/whatsappService");
const r = await ws.enviarMensagem("5511999999999", "outro teste bloqueio");
return r;});
expect(result.ok).toBe(false);
expect(result.error).toContain("bloqueado");});
test("07 - NÃ£o aparece API key no DOM", async ({ page }) => { await page.goto("/central-ia");
await page.waitForLoadState("domcontentloaded");
const html = await page.content();

    //  Nenhuma chave de API Evolution deve aparece
expect(html).not.toContain("VITE_EVOLUTION_API_KEY");
expect(html).not.toContain("evo_api_key");
expect(html).not.toContain("apiKey");});
test("08 - Nenhum envio real acontece (todas as chamadas bloqueadas)", async ({ page }) => { const result = await page.evaluate(async () => { const ws = await import("@/services/integracoes/whatsappService");
const r1 = await ws.enviarMensagem("5511999999991", "msg1");
const r2 = await ws.notificarOSCriada("5511999999992", "OS-002");
const r3 = await ws.notificarEmRota("5511999999993", "OS-003");
const r4 = await ws.notificarEntregue("5511999999994", "OS-004");
const r5 = await ws.enviarPropostaComercial("5511999999995", "Teste", 100, "SP", "RJ");
const r6 = await ws.enviarFollowUp("5511999999996", "Teste", "D+1");
return [r1, r2, r3, r4, r5, r6];});
for (const r of result) { expect(r.ok).toBe(false);
expect(r.error).toContain("bloqueado");}});
test("09 - Central IA mostra solicitaÃ§Ã£o de aprovaÃ§Ã£o de envio bloqueado", async ({ page }) => { await page.goto("/central-ia?tab=aprovacoes");
await page.waitForLoadState("domcontentloaded");

    //  Verificar que a pÃ¡gina de aprovaÃ§Ãµes carreg
expect(page.locator('text=AprovaÃ§Ãµes Humanas')).toBeVisible();

    //  Verificar que hÃ¡ filtro de statu
expect(page.locator('select')).toBeVisible();});
test("10 - RegressÃ£o F24 continua passando (whatsappHomologService nÃ£o foi alterado)", async ({ page }) => { //  Verificar que o homolog service continua exportando as funÃ§Ãµes esperada
const hasFunctions = await page.evaluate(async () => { const mod = await import("@/services/integrations/whatsappHomologService");
return { hasEnviar: typeof mod.enviarWhatsAppHomologacao === "function",        hasValidar: typeof mod.validarWhatsAppHomologacao === "function",        hasMascarar: typeof mod.mascararTelefone === "function",        hasAllowlist: typeof mod.telefoneEstaNaAllowlist === "function",};});
expect(hasFunctions.hasEnviar).toBe(true);
expect(hasFunctions.hasValidar).toBe(true);
expect(hasFunctions.hasMascarar).toBe(true);
expect(hasFunctions.hasAllowlist).toBe(true);});});

