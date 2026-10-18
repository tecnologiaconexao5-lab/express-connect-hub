import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["tms0072a-setup-sessao.spec.ts", "tms0072-fase2-*.spec.ts", "tms0072-fase45-*.spec.ts", "tms0072-fase678-*.spec.ts", "tms0072-fase9-interface.spec.ts", "tms0072-schema-*.spec.ts"],
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/e2e/tms0072a-results.json" }],
  ],
  timeout: 600000,
  use: {
    baseURL: "http://localhost:8800",
  trace: "off",
  screenshot: "on",
  headless: false,
  },
  projects: [
    {
      name: "chromium-setup",
      use: {
        ...devices["Desktop Chrome"],
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      },
    },
  ],
});
