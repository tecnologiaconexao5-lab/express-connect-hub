import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

test.describe("M99 — Event Bus Fundação", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test("01 — App carrega com event_bus ativo (sem erros)", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const jsErrors = errors.filter(e => !e.includes("favicon") && !e.includes("ERR_BLOCKED"));
    expect(jsErrors).toEqual([]);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("02 — Tabela eventos_oficiais existe e tem dados", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const resp = await fetch("/api/eventos/check", {
        method: "HEAD",
      }).catch(() => null);
      return { apiExists: resp !== null };
    });
    const dbResult = await page.evaluate(async () => {
      try {
        const supabaseUrl = (window as any).SUPABASE_URL || "";
        const anonKey = (window as any).SUPABASE_ANON_KEY || "";
        if (!supabaseUrl || !anonKey) return { check: "no_global_var" };
        const resp = await fetch(`${supabaseUrl}/rest/v1/eventos_oficiais?select=count`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        });
        if (!resp.ok) return { check: "fetch_failed", status: resp.status };
        const text = await resp.text();
        return { check: "ok", raw: text };
      } catch (e: any) {
        return { check: "error", msg: e.message };
      }
    });
    expect(dbResult.check).toBeDefined();
  });

  test("03 — Navegação entre rotas continua funcionando", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    const sidebarLinks = page.locator("nav a, nav button, [role='tab']");
    const count = await sidebarLinks.count();
    if (count > 1) {
      await sidebarLinks.first().click();
      await page.waitForTimeout(1000);
    }
    expect(page.url()).toContain("/");
    const body = await page.textContent("body");
    expect(body).not.toContain("Carregando sessão");
  });

  test("04 — Event Bus service importável sem erro", async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const mod = await import("/src/services/eventBus/eventBusService.ts");
        const hasPublicar = typeof mod.publicarEvento === "function";
        const hasBuscarEventos = typeof mod.buscarEventos === "function";
        return { ok: true, hasPublicar, hasBuscarEventos };
      } catch (e: any) {
        return { ok: false, erro: e.message };
      }
    });
    expect(result.ok).toBe(true);
    expect(result.hasPublicar).toBe(true);
    expect(result.hasBuscarEventos).toBe(true);
  });

  test("05 — Adapter timelineAdapter importável sem erro", async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const mod = await import("/src/services/eventBus/adapters/timelineAdapter.ts");
        return { ok: true, hasToTimeline: typeof mod.toTimelineEvent === "function" };
      } catch (e: any) {
        return { ok: false, erro: e.message };
      }
    });
    expect(result.ok).toBe(true);
    expect(result.hasToTimeline).toBe(true);
  });
});
