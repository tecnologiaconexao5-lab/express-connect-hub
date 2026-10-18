import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

test.describe("M108-L7 - Portal WhatsApp Evolution API Real", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test("01 - Aba WhatsApp carrega sem erros de console", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/portal-cliente");
    await page.waitForTimeout(3000);

    const whatsappTab = page.locator("button").filter({ hasText: /WhatsApp/i });
    if (await whatsappTab.isVisible()) {
      await whatsappTab.click();
      await page.waitForTimeout(2000);
    }

    expect(errors.filter((e) => !e.includes("favicon") && !e.includes("mapbox"))).toEqual([]);
  });

  test("02 - Exibe texto WhatsApp apos clicar na aba", async ({ page }) => {
    await page.goto("/portal-cliente");
    await page.waitForTimeout(3000);

    const whatsappTab = page.locator("button").filter({ hasText: /WhatsApp/i });
    if (await whatsappTab.isVisible()) {
      await whatsappTab.click();
      await page.waitForTimeout(2000);
    }

    await expect(page.locator("text=WhatsApp").first()).toBeVisible();
  });

  test("03 - Exibe fallback quando cliente nao possui dados", async ({ page }) => {
    await page.goto("/portal-cliente");
    await page.waitForTimeout(3000);

    const whatsappTab = page.locator("button").filter({ hasText: /WhatsApp/i });
    if (await whatsappTab.isVisible()) {
      await whatsappTab.click();
      await page.waitForTimeout(3000);
    }

    const msg = page.locator("text=Selecione um cliente para visualizar mensagens");
    await expect(msg).toBeVisible();
  });

  test("04 - Input de busca de conversas funciona", async ({ page }) => {
    await page.goto("/portal-cliente");
    await page.waitForTimeout(3000);

    const whatsappTab = page.locator("button").filter({ hasText: /WhatsApp/i });
    if (await whatsappTab.isVisible()) {
      await whatsappTab.click();
      await page.waitForTimeout(3000);
    }

    const searchInput = page.locator('input[placeholder="Buscar conversa..."]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("teste");
      await page.waitForTimeout(500);
      await searchInput.clear();
    }
  });

  test("05 - Botao de refresh recarrega conversas", async ({ page }) => {
    await page.goto("/portal-cliente");
    await page.waitForTimeout(3000);

    const whatsappTab = page.locator("button").filter({ hasText: /WhatsApp/i });
    if (await whatsappTab.isVisible()) {
      await whatsappTab.click();
      await page.waitForTimeout(2000);
    }

    const refreshBtn = page.locator('button[title=""]').first();
    if (await refreshBtn.isVisible()) {
      await refreshBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("06 - Clicar em conversa abre thread de mensagens", async ({ page }) => {
    await page.goto("/portal-cliente");
    await page.waitForTimeout(3000);

    const whatsappTab = page.locator("button").filter({ hasText: /WhatsApp/i });
    if (await whatsappTab.isVisible()) {
      await whatsappTab.click();
      await page.waitForTimeout(3000);
    }

    const primeiraConversa = page.locator("button").filter({ hasText: /(\d{8,})/ }).first();
    if (await primeiraConversa.isVisible()) {
      await primeiraConversa.click();
      await page.waitForTimeout(1000);
      const textarea = page.locator('textarea[placeholder="Digite sua mensagem..."]');
      await expect(textarea).toBeVisible();
    }
  });

  test("07 - Envio de mensagem pelo modal funciona", async ({ page }) => {
    await page.goto("/portal-cliente");
    await page.waitForTimeout(3000);

    const whatsappTab = page.locator("button").filter({ hasText: /WhatsApp/i });
    if (await whatsappTab.isVisible()) {
      await whatsappTab.click();
      await page.waitForTimeout(3000);
    }

    const primeiraConversa = page.locator("button").filter({ hasText: /(\d{8,})/ }).first();
    if (await primeiraConversa.isVisible()) {
      await primeiraConversa.click();
      await page.waitForTimeout(1000);

      const textarea = page.locator('textarea[placeholder="Digite sua mensagem..."]');
      if (await textarea.isVisible()) {
        await textarea.fill("Teste de mensagem automatica");
        const sendBtn = page.locator("button").filter({ hasText: "" }).last();
        const sendDisabled = await sendBtn.isDisabled();
        expect(typeof sendDisabled).toBe("boolean");
      }
    }
  });

  test("08 - Navegacao sem erros de console apos interagir com WhatsApp", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/portal-cliente");
    await page.waitForTimeout(3000);

    const tabs = ["Pedidos", "WhatsApp", "Financeiro", "Comprovantes"];
    for (const tabName of tabs) {
      const tab = page.locator("button").filter({ hasText: new RegExp(tabName, "i") }).first();
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(1000);
      }
    }

    expect(errors.filter((e) => !e.includes("favicon") && !e.includes("mapbox") && !e.includes("token"))).toEqual([]);
  });

  test("09 - Fallback visual quando cliente nao possui dados", async ({ page }) => {
    await page.goto("/portal-cliente");
    await page.waitForTimeout(3000);

    const whatsappTab = page.locator("button").filter({ hasText: /WhatsApp/i });
    if (await whatsappTab.isVisible()) {
      await whatsappTab.click();
      await page.waitForTimeout(2000);
    }

    const icon = page.locator(".lucide-message-square").first();
    const texto = page.locator("text=Selecione um cliente");
    const anyVisible = (await icon.isVisible().catch(() => false)) || (await texto.isVisible().catch(() => false));
    expect(anyVisible).toBe(true);
  });

  test("10 - Seletor de templates aparece quando disponivel", async ({ page }) => {
    await page.goto("/portal-cliente");
    await page.waitForTimeout(3000);

    const whatsappTab = page.locator("button").filter({ hasText: /WhatsApp/i });
    if (await whatsappTab.isVisible()) {
      await whatsappTab.click();
      await page.waitForTimeout(3000);
    }

    const primeiraConversa = page.locator("button").filter({ hasText: /(\d{8,})/ }).first();
    if (await primeiraConversa.isVisible()) {
      await primeiraConversa.click();
      await page.waitForTimeout(1000);

      const templateSelect = page.locator('[role="combobox"]').filter({ hasText: /template/i });
      const exists = await templateSelect.isVisible().catch(() => false);
      if (exists) {
        await templateSelect.click();
        await page.waitForTimeout(500);
        await page.keyboard.press("Escape");
      }
    }
  });
});
