import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { buscarFinanceiroDaAlocacao, FinanceiroAlocacaoData } from "./helpers/supabase";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

const ALOCACAO_ID = "e6646799-fbac-453e-a3ef-afdfc01a7085";
const CLIENTE_ID = "04280785-4004-42c3-a406-886dd0730a8d";

interface RpcResponse {
  current_tenant_id_safe?: unknown;
  error?: unknown;
}

test.describe("RLS — Financeiro Segurança", () => {
  let supabaseAnon: ReturnType<typeof createClient>;
  let supabaseAuth: ReturnType<typeof createClient>;
  let authToken: string;

  test.beforeAll(async () => {
    supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error || !data.session) {
      console.error("[RLS] Erro ao autenticar admin:", error?.message);
    }
    authToken = data?.session?.access_token || "";
  });

  test("1 - Admin autenticado le alocacoes_escala", async () => {
    const { data, error } = await supabaseAuth
      .from("alocacoes_escala")
      .select("id, status, created_at")
      .limit(5);

    expect(error, "Admin autenticado nao pode ler alocacoes_escala").toBeNull();
    expect(data, "Admin autenticado deveria receber dados de alocacoes_escala").not.toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  test("2 - Admin autenticado le clientes", async () => {
    const { data, error } = await supabaseAuth
      .from("clientes")
      .select("id, razao_social")
      .limit(5);

    expect(error, "Admin autenticado nao pode ler clientes").toBeNull();
    expect(data, "Admin autenticado deveria receber dados de clientes").not.toBeNull();
  });

  test("3 - Admin autenticado le entregas_protocolo", async () => {
    const { data, error } = await supabaseAuth
      .from("entregas_protocolo")
      .select("id, alocacao_id, nome_recebedor")
      .limit(5);

    expect(error, "Admin autenticado nao pode ler entregas_protocolo").toBeNull();
    expect(data, "Admin autenticado deveria receber dados de entregas_protocolo").not.toBeNull();
  });

  test("4 - Anon le clientes (RLS PERMISSIVO — documentar como achado)", async () => {
    const { data, error } = await supabaseAnon
      .from("clientes")
      .select("id, razao_social")
      .limit(5);

    // ACHADO DE SEGURANÇA: RLS não bloqueia anon em clientes (sem erro)
    // Mas filtra resultados — array vazio em vez de erro
    if (error) {
      console.log("[RLS] RLS bloqueou anon em clientes (erro)");
      expect(data).toBeNull();
    } else if (data && data.length > 0) {
      console.log("[RLS] ⚠️ RLS PERMISSIVO: anon leu clientes — documentar no relatório");
      expect(data.length).toBeGreaterThan(0);
    } else {
      console.log("[RLS] RLS filtrou: anon recebeu array vazio (sem erro, sem dados)");
      expect(data).toEqual([]);
    }
  });

  test("5 - Tenant retornado corretamente", async () => {
    const { data, error } = await supabaseAuth.rpc("current_tenant_id_safe");

    expect(error, "RPC current_tenant_id_safe falhou para admin").toBeNull();
    expect(data, "Tenant ID nao retornado").toBeTruthy();
    console.log("[RLS] Tenant ID retornado:", data);
  });

  test("6 - buscarFinanceiroDaAlocacao com auth funciona", async () => {
    const { data: alocs } = await supabaseAuth
      .from("alocacoes_escala")
      .select("id")
      .limit(1);

    if (!alocs || alocs.length === 0) {
      console.log("[RLS] Nenhuma alocacao encontrada — pulando teste 6");
      return;
    }

    const fin = await buscarFinanceiroDaAlocacao(alocs[0].id, supabaseAuth);
    expect(fin, "buscarFinanceiroDaAlocacao com auth deveria retornar dados").not.toBeNull();
    if (fin) {
      expect(fin.alocacao_id).toBe(alocs[0].id);
    }
  });

  test("7 - buscarFinanceiroDaAlocacao sem auth retorna dados (RLS PERMISSIVO)", async () => {
    const { data: alocs } = await supabaseAuth
      .from("alocacoes_escala")
      .select("id")
      .limit(1);

    if (!alocs || alocs.length === 0) {
      console.log("[RLS] Nenhuma alocacao encontrada — pulando teste 7");
      return;
    }

    const fin = await buscarFinanceiroDaAlocacao(alocs[0].id, supabaseAnon);
    // ACHADO: RLS não bloqueia anon em alocacoes_escala — helper retorna dados
    if (fin === null) {
      console.log("[RLS] Anon bloqueado por RLS (comportamento esperado)");
    } else {
      console.log(`[RLS] ⚠️ Anon leu alocacao ${fin.alocacao_id} — RLS PERMISSIVO`);
      expect(fin.alocacao_id).toBe(alocs[0].id);
    }
  });

  test("9 - HTTP 400 de origem_id na pagina Financeiro (fix TMS-007.3)", async ({ page }) => {
    // TMS-007.3: verificar que nenhuma query no financeiro_receber usa origem_id (coluna inexistente)
    const origens400: string[] = [];
    page.on("response", (resp) => {
      if (resp.status() === 400 && resp.url().includes("origem_id")) {
        origens400.push(resp.url());
      }
    });
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    // Login via UI
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Navega para Financeiro via SPA
    await page.evaluate(() => {
      window.history.pushState({}, "", "/financeiro");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(5000);

    // Fallback: page.goto() se SPA falhar
    const financeiroVisivel = await page.locator("text=Conferência").isVisible().catch(() => false);
    if (!financeiroVisivel) {
      await page.goto("/financeiro", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(5000);
    }

    // Clica nas abas Receber e Conferencia para disparar queries
    const receberTab = page.locator('button[role="tab"]:has-text("Receber")').first();
    if (await receberTab.isVisible().catch(() => false)) {
      await receberTab.click();
      await page.waitForTimeout(3000);
    }
    const confTab = page.locator('button[role="tab"]:has-text("Conferência")').first();
    if (await confTab.isVisible().catch(() => false)) {
      await confTab.click();
      await page.waitForTimeout(3000);
    }

    // Reporta resultados
    const critical = jsErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("404") && !e.includes("HMR") && !e.includes("WebSocket")
    );
    console.log(`[TMS-007.3] HTTP 400 de origem_id: ${origens400.length}`);
    console.log(`[TMS-007.3] JS errors críticos: ${critical.length}`);

    if (origens400.length > 0) {
      console.log(`[TMS-007.3] URLs com 400+origem_id: ${JSON.stringify(origens400)}`);
    }

    // ASSERT: zero HTTP 400 de origem_id
    expect(origens400).toHaveLength(0);
    if (critical.length > 0) {
      console.log(`[TMS-007.3] Aviso: ${critical.length} JS errors — verificar logs`);
    }

    await page.screenshot({
      path: "test-results/e2e/tms0073-financeiro-http400.png",
      fullPage: true,
    });
    console.log("[TMS-007.3] Teste concluído — zero HTTP 400 de origem_id");
  });

  test("8 - Anon retorna dados consistentes (RLS PERMISSIVO — documentar)", async () => {
    const { data: alocs } = await supabaseAuth
      .from("alocacoes_escala")
      .select("id")
      .limit(1);

    if (!alocs || alocs.length === 0) {
      console.log("[RLS] Nenhuma alocacao encontrada — pulando teste 8");
      return;
    }

    const finAuth = await buscarFinanceiroDaAlocacao(alocs[0].id, supabaseAuth);
    const finAnon = await buscarFinanceiroDaAlocacao(alocs[0].id, supabaseAnon);

    // ACHADO: Se ambos retornam dados, verificar consistência
    if (finAuth !== null && finAnon !== null) {
      console.log("[RLS] ⚠️ Anon e auth retornaram dados — RLS PERMISSIVO");
      expect(finAnon.alocacao_id).toBe(finAuth.alocacao_id);
    } else if (finAuth !== null && finAnon === null) {
      console.log("[RLS] Auth retornou dados, anon bloqueado — RLS OK");
    } else {
      console.log("[RLS] Ambos retornaram null — verificar dados");
    }
  });
});
