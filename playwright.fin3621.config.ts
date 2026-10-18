import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "fin-master-3621-sentinelas.spec.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 300000,
  reporter: [
    ["html", { outputFolder: "playwright-report-fin3621" }],
    ["json", { outputFile: "test-results/e2e/fin3621-results.json" }],
    ["list"],
  ],
  use: {
    baseURL: "http://localhost:8801",
    trace: "on",
    screenshot: "on",
    video: "on",
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: "fin3621",
      use: {
        ...devices["Desktop Chrome"],
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      },
    },
  ],
});
