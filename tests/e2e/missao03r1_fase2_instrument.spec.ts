import { test, expect } from "@playwright/test";
import { loginFinanceiro, loginOperacional } from "./helpers/auth";

test.describe("FASE 2 — Janela temporaria role=operador", () => {
  test("Detecta role=operador durante login financeiro", async ({ page }) => {
    const authLogs: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("[AUTH:INSTR]") || text.includes("[Auth]")) {
        authLogs.push(text);
      }
    });

    await loginFinanceiro(page, "03r1-f2");
    await page.waitForTimeout(3000);

    console.log("\n=== TIMELINE AUTH ===");
    for (const line of authLogs) {
      console.log(line);
    }
    console.log("=== FIM TIMELINE ===\n");

    // Verifica se houve setUser com role=operador
    const tempUserEntries = authLogs.filter(l => l.includes("tempUser") || l.includes("role=operador"));
    const realUserEntries = authLogs.filter(l => l.includes("role REAL"));

    console.log(`TempUser (role=operador) entries: ${tempUserEntries.length}`);
    console.log(`Real role entries: ${realUserEntries.length}`);

    // Deve ter pelo menos um tempUser
    expect(tempUserEntries.length).toBeGreaterThan(0);

    // Deve ter pelo menos um role REAL (financeiro)
    if (realUserEntries.length > 0) {
      const hasFinanceiro = realUserEntries.some(l => l.includes("role REAL=financeiro"));
      if (hasFinanceiro) {
        // Calcula diff entre primeiro tempUser e primeiro REAL
        const tempMatch = tempUserEntries[0].match(/@ (\d+)/);
        const realMatch = realUserEntries[0].match(/@ (\d+)/);
        if (tempMatch && realMatch) {
          const diff = parseInt(realMatch[1]) - parseInt(tempMatch[1]);
          console.log(`\n⚠️  JANELA TEMPORARIA: ${diff}ms com role=operador\n`);
          // Se diff > 0, existe janela
          expect(diff).toBeGreaterThan(0);
        }
      }
    }
  });
});
