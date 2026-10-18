import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "fin-master-3623d-prestador-e2e.spec.ts",
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  timeout: 180000,
  use: {
    baseURL: "http://localhost:8800",
    trace: "on-first-retry",
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
});
