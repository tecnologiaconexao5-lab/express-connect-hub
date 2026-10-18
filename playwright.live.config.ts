// ============================================================================
// E2E-SINCRONIZADO-PLAYWRIGHT-E-MAESTRO — config Playwright do teste AO VIVO
// (browser visível/headed) contra o TMS local. Executado pelo orquestrador
// `scripts/run_e2e_live_sync.ts`.
//
// NÃO usa o global-setup padrão (que bloqueia produção). A proteção de
// ambiente é feita pelo orquestrador + pelo guard no início do spec
// (exige E2E_LIVE_ALLOW_PROD=1 para ambiente de produção).
// ============================================================================
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/live",
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  timeout: 20 * 60 * 1000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8800",
    headless: false,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    storageState: "tests/e2e/.auth/storageState.json",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { slowMo: 250 },
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium-live",
      use: { ...devices["Desktop Chrome"], headless: false },
    },
  ],
});
