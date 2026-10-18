/**
 * Playwright config dedicado ao AUTO-E2E-CENARIO-02
 * (Regras de Bloqueio Operacional).
 *
 * Diferenças em relação ao playwright.config.ts:
 *  - Executa APENAS o spec com-02-operacional-bloqueios.spec.ts.
 *  - SEM globalSetup: o spec NÃO toca o banco real — todo tráfego Supabase
 *    (`/rest/v1/**`) é interceptado por page.route com um banco em memória,
 *    logo o guard-rail de produção (que bloquearia a execução) não se aplica.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["com-02-operacional-bloqueios.spec.ts"],
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/e2e/com-02-results.json" }],
  ],
  timeout: 180000,
  use: {
    baseURL: "http://localhost:8800",
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 8800 --strictPort",
    url: "http://localhost:8800",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
