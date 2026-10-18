/**
 * CAD-PERSIST-04B: Quick smoke test — page renders without ErrorBoundary
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:8800";

test("CAD-04B: /cadastros/prestadores renders without useBlocker error", async ({ page }) => {
  // Navigate without login — just check if the page shell loads
  // The important thing is: NO "useBlocker must be used within a data router" error
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(`${BASE}/cadastros/prestadores`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(3000);

  // Check: no useBlocker error
  const hasBlockerError = errors.some(e => e.includes("useBlocker"));
  expect(hasBlockerError).toBe(false);

  // Check: no ErrorBoundary fallback rendered
  const errorBoundary = page.locator("text=Algo deu errado").or(page.locator("text=ErrorBoundary"));
  const hasErrorBoundary = await errorBoundary.count() > 0;
  expect(hasErrorBoundary).toBe(false);
});
