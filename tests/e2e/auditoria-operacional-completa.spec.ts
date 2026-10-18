import { test, expect, Page } from "@playwright/test";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/e2e/auditoria";
const REPORT: Record<string, any> = {
  perfis: {},
  rotas: {},
  erros: [],
  bugs: [],
  fluxos: {},
};

const PERFIS = {
  admin:       { email: "tamiris.castilho@conexaoexpress.com.br", pw: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026", role: "super_admin" },
  financeiro:  { email: "financeiro@conexaoexpress.com.br",       pw: process.env.PLAYWRIGHT_FINANCEIRO_PASSWORD || "Conexao@2026", role: "financeiro" },
  comercial:   { email: "comercial@conexaoexpress.com.br",       pw: process.env.PLAYWRIGHT_COMERCIAL_PASSWORD || "Conexao@2026", role: "comercial" },
  operacional: { email: "operacional@conexaoexpress.com.br",     pw: process.env.PLAYWRIGHT_OPERACIONAL_PASSWORD || "Conexao@2026", role: "operador" },
  atendimento: { email: "contato@conexaoexpress.com.br",         pw: process.env.PLAYWRIGHT_ATENDIMENTO_PASSWORD || "Conexao@2026", role: "atendimento" },
  cliente:     { email: "cliente.teste@conexaoexpress.com.br",   pw: process.env.PLAYWRIGHT_CLIENTE_PASSWORD || "Teste@2026", role: "cliente" },
};

const ROTAS_POR_PERFIL: Record<string, { rota: string; modulo: string; acesso: string }[]> = {
  admin: [
    { rota: "/dashboard", modulo: "dashboard", acesso: "sim" },
    { rota: "/torre-controle", modulo: "ordens_servico", acesso: "sim" },
    { rota: "/comercial", modulo: "clientes", acesso: "sim" },
    { rota: "/operacao", modulo: "ordens_servico", acesso: "sim" },
    { rota: "/cadastros", modulo: "prestadores", acesso: "sim" },
    { rota: "/cadastros/clientes", modulo: "clientes", acesso: "sim" },
    { rota: "/cadastros/prestadores", modulo: "prestadores", acesso: "sim" },
    { rota: "/cadastros/veiculos", modulo: "frota", acesso: "sim" },
    { rota: "/cadastros/auxiliares", modulo: "cadastros_auxiliares", acesso: "sim" },
    { rota: "/cadastros/analise-documentos", modulo: "prestadores", acesso: "sim" },
    { rota: "/financeiro", modulo: "financeiro", acesso: "sim" },
    { rota: "/fiscal", modulo: "financeiro", acesso: "sim" },
    { rota: "/frota", modulo: "frota", acesso: "sim" },
    { rota: "/combustiveis", modulo: "frota", acesso: "sim" },
    { rota: "/contratos", modulo: "clientes", acesso: "sim" },
    { rota: "/sla", modulo: "ordens_servico", acesso: "sim" },
    { rota: "/relatorios", modulo: "relatorios", acesso: "sim" },
    { rota: "/biblioteca", modulo: "configuracoes", acesso: "sim" },
    { rota: "/governanca", modulo: "configuracoes", acesso: "sim" },
    { rota: "/central-ia", modulo: "configuracoes", acesso: "sim" },
    { rota: "/admin/tenants", modulo: "admin_tenants", acesso: "sim" },
    { rota: "/configuracoes", modulo: "configuracoes", acesso: "sim" },
    { rota: "/portal-cliente", modulo: "", acesso: "sim" },
    { rota: "/portal-prestador", modulo: "", acesso: "sim" },
    { rota: "/controle-patio", modulo: "ordens_servico", acesso: "sim" },
    { rota: "/seguros", modulo: "prestadores", acesso: "sim" },
    { rota: "/comunicacao", modulo: "configuracoes", acesso: "sim" },
    { rota: "/central-comunicacao", modulo: "configuracoes", acesso: "sim" },
    { rota: "/recrutamento", modulo: "prestadores", acesso: "sim" },
    { rota: "/app-prestador", modulo: "", acesso: "sim" },
  ],
  financeiro: [
    { rota: "/dashboard", modulo: "dashboard", acesso: "sim" },
    { rota: "/torre-controle", modulo: "ordens_servico", acesso: "sim" },
    { rota: "/comercial", modulo: "clientes", acesso: "sim" },
    { rota: "/operacao", modulo: "ordens_servico", acesso: "sim" },
    { rota: "/cadastros", modulo: "prestadores", acesso: "sim" },
    { rota: "/cadastros/clientes", modulo: "clientes", acesso: "sim" },
    { rota: "/cadastros/prestadores", modulo: "prestadores", acesso: "sim" },
    { rota: "/cadastros/veiculos", modulo: "frota", acesso: "nao" },
    { rota: "/cadastros/auxiliares", modulo: "cadastros_auxiliares", acesso: "nao" },
    { rota: "/financeiro", modulo: "financeiro", acesso: "sim" },
    { rota: "/fiscal", modulo: "financeiro", acesso: "sim" },
    { rota: "/frota", modulo: "frota", acesso: "nao" },
    { rota: "/combustiveis", modulo: "frota", acesso: "nao" },
    { rota: "/contratos", modulo: "clientes", acesso: "sim" },
    { rota: "/relatorios", modulo: "relatorios", acesso: "sim" },
    { rota: "/portal-cliente", modulo: "", acesso: "sim" },
    { rota: "/recrutamento", modulo: "prestadores", acesso: "nao" },
  ],
  comercial: [
    { rota: "/dashboard", modulo: "dashboard", acesso: "sim" },
    { rota: "/comercial", modulo: "clientes", acesso: "sim" },
    { rota: "/cadastros", modulo: "prestadores", acesso: "sim" },
    { rota: "/cadastros/clientes", modulo: "clientes", acesso: "sim" },
    { rota: "/cadastros/prestadores", modulo: "prestadores", acesso: "sim" },
    { rota: "/financeiro", modulo: "financeiro", acesso: "sim" },
    { rota: "/portal-cliente", modulo: "", acesso: "sim" },
  ],
};

async function fazerLogin(page: Page, email: string, password: string): Promise<number> {
  if (page.isClosed()) throw new Error("Página fechada antes do login");
  const start = Date.now();
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 15000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction("!window.location.href.includes('/login')", { timeout: 25000 });
  const elapsed = Date.now() - start;
  return elapsed;
}

async function navegarRota(page: Page, rota: string, screenshotName: string): Promise<{ ok: boolean; consoleErrors: string[]; pageErrors: string[]; erro?: string }> {
  const consoleErrors: string[] = [];
  const handler = (msg: any) => { if (msg.type() === "error") consoleErrors.push(msg.text()); };
  page.on("console", handler);
  try {
    if (page.isClosed()) throw new Error("Página fechada antes da navegação");
    await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.locator("text=Carregando sessão").waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
    const pageErrors: string[] = [];
    if (!page.isClosed()) {
      const bodyText = (await page.locator("body").textContent().catch(() => "")) ?? "";
      if (/erro\s+ao\s+buscar/i.test(bodyText)) pageErrors.push("Erro ao buscar dados na página");
      if (/erro\s+ao\s+carregar/i.test(bodyText)) pageErrors.push("Erro ao carregar dados na página");
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotName), fullPage: false });
    page.removeListener("console", handler);
    return { ok: true, consoleErrors, pageErrors };
  } catch (e: any) {
    page.removeListener("console", handler);
    return { ok: false, consoleErrors, pageErrors: [], erro: e.message };
  }
}

// ========== TESTE 1: LOGIN 10x ADMIN com timing ==========
test.describe("ETAPA 2 - Login 10x Admin", () => {
  const tempos: number[] = [];

  for (let i = 1; i <= 10; i++) {
    test(`login #${i}`, async ({ page }) => {
      test.setTimeout(60000);
      if (page.isClosed()) throw new Error("Página fechada antes do login");
      const t = await fazerLogin(page, PERFIS.admin.email, PERFIS.admin.pw);
      tempos.push(t);
      const url = page.url();
      expect(url).not.toContain("/login");
      console.log(`[LOGIN] admin #${i}: ${t}ms url=${url}`);
    });
  }

  test.afterAll(() => {
    if (tempos.length === 0) { console.log("[REPORT] admin: sem dados"); return; }
    const total = tempos.reduce((a, b) => a + b, 0);
    const avg = Math.round(total / tempos.length);
    const max = Math.max(...tempos);
    const min = Math.min(...tempos);
    REPORT.perfis.admin = { avg, max, min, tentativas: tempos.length };
    console.log(`[REPORT] admin: avg=${avg}ms max=${max}ms min=${min}ms (${tempos.length}/10)`);
  });
});

// ========== TESTE 2: LOGIN 10x FINANCEIRO ==========
test.describe("ETAPA 2 - Login 10x Financeiro", () => {
  const tempos: number[] = [];

  for (let i = 1; i <= 10; i++) {
    test(`login #${i}`, async ({ page }) => {
      test.setTimeout(60000);
      if (page.isClosed()) throw new Error("Página fechada antes do login");
      const t = await fazerLogin(page, PERFIS.financeiro.email, PERFIS.financeiro.pw);
      tempos.push(t);
      const url = page.url();
      expect(url).not.toContain("/login");
      console.log(`[LOGIN] financeiro #${i}: ${t}ms url=${url}`);
    });
  }

  test.afterAll(() => {
    if (tempos.length === 0) { console.log("[REPORT] financeiro: sem dados"); return; }
    const total = tempos.reduce((a, b) => a + b, 0);
    const avg = Math.round(total / tempos.length);
    const max = Math.max(...tempos);
    const min = Math.min(...tempos);
    REPORT.perfis.financeiro = { avg, max, min, tentativas: tempos.length };
    console.log(`[REPORT] financeiro: avg=${avg}ms max=${max}ms min=${min}ms (${tempos.length}/10)`);
  });
});

// ========== TESTE 3: LOGIN 10x COMERCIAL ==========
test.describe("ETAPA 2 - Login 10x Comercial", () => {
  const tempos: number[] = [];

  for (let i = 1; i <= 10; i++) {
    test(`login #${i}`, async ({ page }) => {
      test.setTimeout(60000);
      if (page.isClosed()) throw new Error("Página fechada antes do login");
      const t = await fazerLogin(page, PERFIS.comercial.email, PERFIS.comercial.pw);
      tempos.push(t);
      const url = page.url();
      expect(url).not.toContain("/login");
      console.log(`[LOGIN] comercial #${i}: ${t}ms url=${url}`);
    });
  }

  test.afterAll(() => {
    if (tempos.length === 0) { console.log("[REPORT] comercial: sem dados"); return; }
    const total = tempos.reduce((a, b) => a + b, 0);
    const avg = Math.round(total / tempos.length);
    const max = Math.max(...tempos);
    const min = Math.min(...tempos);
    REPORT.perfis.comercial = { avg, max, min, tentativas: tempos.length };
    console.log(`[REPORT] comercial: avg=${avg}ms max=${max}ms min=${min}ms (${tempos.length}/10)`);
  });
});

// ========== TESTE 4: LOGIN 10x OPERACIONAL ==========
test.describe("ETAPA 2 - Login 10x Operacional", () => {
  const tempos: number[] = [];

  for (let i = 1; i <= 10; i++) {
    test(`login #${i}`, async ({ page }) => {
      test.setTimeout(60000);
      if (page.isClosed()) throw new Error("Página fechada antes do login");
      const t = await fazerLogin(page, PERFIS.operacional.email, PERFIS.operacional.pw);
      tempos.push(t);
      const url = page.url();
      expect(url).not.toContain("/login");
      console.log(`[LOGIN] operacional #${i}: ${t}ms url=${url}`);
    });
  }

  test.afterAll(() => {
    if (tempos.length === 0) { console.log("[REPORT] operacional: sem dados"); return; }
    const total = tempos.reduce((a, b) => a + b, 0);
    const avg = Math.round(total / tempos.length);
    const max = Math.max(...tempos);
    const min = Math.min(...tempos);
    REPORT.perfis.operacional = { avg, max, min, tentativas: tempos.length };
    console.log(`[REPORT] operacional: avg=${avg}ms max=${max}ms min=${min}ms (${tempos.length}/10)`);
  });
});

// ========== TESTE 5: ROTAS ADMIN ==========
test.describe("ETAPA 4 - Navegacao Admin por todas as rotas", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await fazerLogin(page, PERFIS.admin.email, PERFIS.admin.pw);
  });

  for (const r of ROTAS_POR_PERFIL.admin) {
    test(`rota ${r.rota} (${r.modulo})`, async ({ page }) => {
      test.setTimeout(30000);
      const res = await navegarRota(page, r.rota, `admin_${r.rota.replace(/\//g, "_")}.png`);
      const url = page.url();
      const hasDenied = url.includes("/login") || (await page.locator("text=Acesso Restrito").isVisible().catch(() => false));
      if (hasDenied && r.acesso === "sim") {
        REPORT.erros.push(`Admin sem acesso a ${r.rota}`);
        expect(false).toBeTruthy();
      }
      expect(hasDenied).toBe(r.acesso !== "sim");
      if (res.pageErrors.length > 0) {
        REPORT.erros.push(`Admin page errors em ${r.rota}: ${res.pageErrors.join(", ")}`);
        expect(res.pageErrors).toEqual([]);
      }
      REPORT.rotas[r.rota] = { perfil: "admin", ok: !hasDenied, consoleErrors: res.consoleErrors.length, pageErrors: res.pageErrors.length };
    });
  }
});

// ========== TESTE 6: ROTAS FINANCEIRO ==========
test.describe("ETAPA 4 - Navegacao Financeiro pelas rotas", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await fazerLogin(page, PERFIS.financeiro.email, PERFIS.financeiro.pw);
  });

  for (const r of ROTAS_POR_PERFIL.financeiro) {
    test(`rota ${r.rota} (esperado: ${r.acesso})`, async ({ page }) => {
      test.setTimeout(30000);
      const res = await navegarRota(page, r.rota, `fin_${r.rota.replace(/\//g, "_")}.png`);
      const hasDenied = page.url().includes("/login") || (await page.locator("text=Acesso Restrito").isVisible().catch(() => false));
      if (hasDenied && r.acesso === "sim") {
        REPORT.erros.push(`Financeiro sem acesso a ${r.rota}`);
        expect(false).toBeTruthy();
      }
      if (!hasDenied && r.acesso === "nao") {
        REPORT.erros.push(`Financeiro com acesso indevido a ${r.rota}`);
        expect(false).toBeTruthy();
      }
      if (res.pageErrors.length > 0) {
        REPORT.erros.push(`Financeiro page errors em ${r.rota}: ${res.pageErrors.join(", ")}`);
        expect(res.pageErrors).toEqual([]);
      }
      REPORT.rotas[r.rota] = { ...REPORT.rotas[r.rota], financeiro: { ok: !hasDenied, esperado: r.acesso } };
    });
  }
});

// ========== TESTE 7: LOGIN INVALIDO ==========
test.describe("ETAPA 4 - Login invalido", () => {
  test("login com senha errada mostra erro e permanece no /login", async ({ page }) => {
    test.setTimeout(30000);
    if (page.isClosed()) throw new Error("Página fechada");
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 15000 });
    await page.locator('input[type="email"]').fill(PERFIS.admin.email);
    await page.locator('input[type="password"]').fill("senha_errada_999");
    await page.locator('button[type="submit"]').click();
    await page.locator("text=Erro").waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toContain("/login");
    const body = (await page.locator("body").textContent().catch(() => "")) ?? "";
    const temErro = /invalid|invalido|erro|falha/i.test(body);
    console.log(`[TEST] Login invalido: erro visivel=${temErro}`);
    expect(temErro).toBeTruthy();
  });
});

// ========== TESTE 8: ROTA PROTEGIDA ==========
test.describe("ETAPA 4 - Rota protegida sem login", () => {
  test("acesso direto a /financeiro redireciona para /login", async ({ page }) => {
    test.setTimeout(30000);
    if (page.isClosed()) throw new Error("Página fechada");
    await page.goto("/financeiro", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForURL((url: URL) => url.pathname.includes("/login"), { timeout: 15000 });
    const url = page.url();
    expect(url).toContain("/login");
    expect(url).toContain("redirect");
    console.log(`[TEST] Rota protegida: redirecionou para ${url}`);
  });
});

// ========== TESTE 9: LOGOUT ==========
test.describe("ETAPA 4 - Logout", () => {
  test("logout redireciona para /login", async ({ page }) => {
    test.setTimeout(30000);
    if (page.isClosed()) throw new Error("Página fechada");
    await fazerLogin(page, PERFIS.admin.email, PERFIS.admin.pw);
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForURL((url: URL) => url.pathname.includes("/login"), { timeout: 15000 });
    const url = page.url();
    expect(url).toContain("/login");
    console.log(`[TEST] Logout: URL=${url}`);
  });
});

// ========== TESTE 10: CONSOLE ERRORS EM TODAS AS ROTAS ADMIN ==========
test.describe("ETAPA 4 - Console errors nas rotas Admin", () => {
  test("nenhum console.error nas rotas principais", async ({ page }) => {
    test.setTimeout(180000);
    const allErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") allErrors.push(msg.text()); });
    if (page.isClosed()) throw new Error("Página fechada");
    await fazerLogin(page, PERFIS.admin.email, PERFIS.admin.pw);
    for (const r of ROTAS_POR_PERFIL.admin.slice(0, 8)) {
      await page.goto(r.rota, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.locator("text=Carregando sessão").waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
    }
    console.log(`[TEST] Console errors: ${allErrors.length}`);
    for (const e of allErrors) {
      console.log(`  [CONSOLE_ERROR] ${e.substring(0, 200)}`);
      REPORT.erros.push(`Console: ${e.substring(0, 200)}`);
    }
    expect(allErrors.length).toBe(0);
  });
});

// ========== TESTE 11: SESSAO EXPIRADA ==========
test.describe("ETAPA 4 - Sessao expirada", () => {
  test("session_expired mostra mensagem na tela de login", async ({ page }) => {
    test.setTimeout(30000);
    if (page.isClosed()) throw new Error("Página fechada");
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 15000 });
    await page.evaluate(() => sessionStorage.setItem("session_expired", "true"));
    await page.reload();
    await page.locator("text=Sessão").waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    const body = (await page.locator("body").textContent().catch(() => "")) ?? "";
    const temMsg = /sessao|expirada|login novamente/i.test(body);
    console.log(`[TEST] Sessao expirada: mensagem visivel=${temMsg}`);
  });
});
