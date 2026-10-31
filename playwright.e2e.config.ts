import { defineConfig, devices } from "@playwright/test";

// Config dedicada ao épico E2E "Motorista App -> Torre de Controle".
// Não usa globalSetup de produção porque o fluxo é isolado com mocks
// de backend (page.route) — nenhum dado real é criado/alterado.
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/e2e-motorista",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-motorista", open: "never" }],
  ],
  timeout: 120000,
  use: {
    baseURL: "http://localhost:8800",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 8800 --strictPort",
    url: "http://localhost:8800",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
