import { defineConfig, devices } from "@playwright/test";

// Testes visuais com backend 100% mockado (nenhum dado real é tocado):
// dispensam o guard de produção e usam uma pasta de artefatos própria.
const dualApp = process.argv.some((arg) => arg.includes("interacao-tms-app"));
const showcaseVisual = process.argv.some((arg) => arg.includes("jornada-visual-motorista"));
const masterVisual = process.argv.some((arg) => arg.includes("jornada-completa-tms-app"));
const fluxoMockado = dualApp || showcaseVisual || masterVisual;
const pastaArtefatos = masterVisual ? "master" : dualApp ? "dual" : "showcase";

export default defineConfig({
  testDir: ".",
  testMatch: ["tests/e2e/**/*.spec.ts", "e2e/**/*.spec.ts"],
  ...(fluxoMockado ? { outputDir: `./test-results/${pastaArtefatos}` } : {}),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: fluxoMockado
    ? [
        ["html", { outputFolder: `playwright-report-${pastaArtefatos}`, open: "never" }],
        ["list"],
      ]
    : [
        ["html", { outputFolder: "playwright-report" }],
        ["json", { outputFile: "test-results/e2e/results.json" }],
        ["list"],
      ],
  timeout: 120000,
  globalSetup: fluxoMockado ? undefined : "./tests/e2e/global-setup.ts",
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
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 8800 --strictPort",
    url: "http://localhost:8800",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
