import { test, expect, Page, ConsoleMessage, Route } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { loginAdmin } from "./helpers/auth";

const SCREENSHOT_DIR = "test-results/e2e/m136c2-navegacao";
const TRACE_DIR = "test-results/e2e/m136c2-traces";

const ALL_ROUTES = [
  { modulo: "Dashboard Executivo", rota: "/dashboard" },
  { modulo: "Torre de Controle", rota: "/torre-controle" },
  { modulo: "Comercial", rota: "/comercial" },
  { modulo: "Cadastros Base", rota: "/cadastros" },
  { modulo: "Clientes", rota: "/cadastros/clientes" },
  { modulo: "Prestadores", rota: "/cadastros/prestadores" },
  { modulo: "Análise Documentos", rota: "/cadastros/analise-documentos" },
  { modulo: "Veículos", rota: "/cadastros/veiculos" },
  { modulo: "Cadastros Auxiliares", rota: "/cadastros/auxiliares" },
  { modulo: "Operação", rota: "/operacao" },
  { modulo: "Frota", rota: "/frota" },
  { modulo: "Combustíveis", rota: "/combustiveis" },
  { modulo: "Financeiro", rota: "/financeiro" },
  { modulo: "Fiscal", rota: "/fiscal" },
  { modulo: "Contratos", rota: "/contratos" },
  { modulo: "Recrutamento", rota: "/recrutamento" },
  { modulo: "SLA", rota: "/sla" },
  { modulo: "Seguros", rota: "/seguros" },
  { modulo: "Relatórios", rota: "/relatorios" },
  { modulo: "Biblioteca", rota: "/biblioteca" },
  { modulo: "Governança", rota: "/governanca" },
  { modulo: "Configurações", rota: "/configuracoes" },
  { modulo: "Central IA", rota: "/central-ia" },
  { modulo: "Comunicação", rota: "/comunicacao" },
  { modulo: "Central Comunicação", rota: "/central-comunicacao" },
  { modulo: "Monitor API", rota: "/monitor-api" },
  { modulo: "Portal Cliente", rota: "/portal-cliente" },
  { modulo: "App Prestador", rota: "/app-prestador" },
  { modulo: "Integrações TMS", rota: "/integracoes" },
  { modulo: "Controle Pátio", rota: "/controle-patio" },
  { modulo: "Admin Tenants", rota: "/admin/tenants" },
  { modulo: "Admin Conectores", rota: "/admin/conectores" },
];

const URL_TABS: Record<string, string[]> = {
  "/comercial": ["orcamentos", "crm", "marketing", "propostas", "tabela", "simulador", "automacao"],
  "/operacao": ["solicitacoes", "os", "escala", "roteirizacao", "ocorrencias", "pod", "devolucoes", "reentregas"],
  "/cadastros/auxiliares": ["unidades", "filiais", "centros-custo"],
  "/frota": ["manutencao", "abastecimento", "documentos", "custos"],
  "/financeiro": ["dashboard", "receber", "inadimplencia", "pagar", "fluxo", "dre", "plano-contas", "conciliacao", "lotes", "seguros-auto", "contabilidade"],
  "/fiscal": ["cte", "mdfe", "fechamento", "xmls"],
  "/contratos": ["modelos", "gerados", "anexos", "configs"],
  "/recrutamento": ["operacoes", "nova-operacao", "prestadores", "crm", "documentos", "ia", "onboarding", "score", "automacoes", "portal", "talentos"],
  "/sla": ["cliente", "nps", "entrega", "performance"],
  "/seguros": ["configuracao", "apolices", "regras-cliente", "regras-calculo", "alertas", "sinistros"],
  "/relatorios": ["extrato", "faturamento", "margem", "prestadores", "volume", "exportador"],
  "/governanca": ["auditoria", "historico", "permissoes", "lgpd"],
  "/configuracoes": ["geral", "empresa", "acessos", "integracoes", "central-integracoes"],
  "/monitor-api": ["monitor", "sefaz", "ciot", "nfse"],
};

interface NavResult {
  modulo: string;
  rota: string;
  tab?: string;
  status: "ok" | "fail" | "timeout" | "blank" | "erro_console" | "nao_encontrado";
  statusCode?: number;
  bodyLength: number;
  consoleErrors: number;
  pageErrors: number;
  durationMs: number;
  infiniteLoading: boolean;
  disabledButtons: string[];
  screenshot?: string;
}

function setupCollectors(page: Page) {
  const consoleErrors: ConsoleMessage[] = [];
  const pageErrors: Error[] = [];
  const httpErrors: { url: string; status: number }[] = [];

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg);
  });
  page.on("pageerror", (err: Error) => pageErrors.push(err));
  page.on("response", (resp) => {
    if (resp.status() >= 400) httpErrors.push({ url: resp.url(), status: resp.status() });
  });

  return { consoleErrors, pageErrors, httpErrors };
}

async function navigateToRoute(page: Page, rota: string, tab?: string): Promise<NavResult> {
  const start = Date.now();
  const { consoleErrors, pageErrors } = setupCollectors(page);

  const url = tab ? `${rota}?tab=${tab}` : rota;
  const result: NavResult = {
    modulo: "",
    rota,
    tab,
    status: "ok",
    bodyLength: 0,
    consoleErrors: 0,
    pageErrors: 0,
    durationMs: 0,
    infiniteLoading: false,
    disabledButtons: [],
  };

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    const bodyText = await page.locator("body").textContent().catch(() => "");
    result.bodyLength = bodyText?.length || 0;
    result.consoleErrors = consoleErrors.length;
    result.pageErrors = pageErrors.length;
    result.durationMs = Date.now() - start;

    const hasCarregando = bodyText?.includes("Carregando") || bodyText?.includes("sessão") || false;
    result.infiniteLoading = hasCarregando;

    const disabledBtns = await page.locator("button[disabled]").allTextContents().catch(() => []);
    result.disabledButtons = disabledBtns.filter((b: string) => b.trim().length > 0);

    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      result.status = "erro_console";
    }
    if (result.bodyLength < 200) {
      result.status = "blank";
    }
    if (bodyText?.includes("Carregando sessão") && result.durationMs > 10000) {
      result.status = "timeout";
      result.infiniteLoading = true;
    }
  } catch (e: any) {
    result.status = "fail";
    result.durationMs = Date.now() - start;
  }

  return result;
}

test.describe("M136-C.2 — Navegação Completa Enterprise", () => {
  const resultados: NavResult[] = [];

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, "m136c2-nav");
  });

  test("01 — Login e verificação do menu", async ({ page }) => {
    await page.waitForSelector("nav, [class*='sidebar'], [class*='Sidebar']", { timeout: 15000 });
    const sidebarVisible = await page.locator("nav, [class*='sidebar'], [class*='Sidebar']").first().isVisible();
    expect(sidebarVisible).toBeTruthy();
  });

  for (const { modulo, rota } of ALL_ROUTES) {
    test(`02 — ${modulo} (${rota})`, async ({ page }, testInfo) => {
      testInfo.setTimeout(60000);
      const r = await navigateToRoute(page, rota);
      r.modulo = modulo;

      if (r.status === "fail" || r.status === "blank") {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `fail-${modulo.replace(/\s+/g, "-").toLowerCase()}.png`),
          fullPage: true,
        });
        await page.context().tracing.start({ screenshots: true, snapshots: true });
      }

      resultados.push(r);

      if (rota === "/portal-cliente") {
        const finalUrl = page.url();
        expect(finalUrl).toContain("portal-cliente");
      } else {
        expect(r.status).not.toBe("fail");
        expect(r.status).not.toBe("blank");
        expect(r.bodyLength).toBeGreaterThan(200);
      }
    });
  }

  for (const [rota, tabs] of Object.entries(URL_TABS)) {
    for (const tab of tabs) {
      const moduloName = ALL_ROUTES.find((r) => r.rota === rota)?.modulo || rota;
      test(`03 — ${moduloName} > aba ${tab}`, async ({ page }, testInfo) => {
        testInfo.setTimeout(60000);
        const mod = ALL_ROUTES.find((r) => r.rota === rota);
        const r = await navigateToRoute(page, rota, tab);
        r.modulo = `${mod?.modulo || rota} > ${tab}`;

        resultados.push(r);

        expect(r.status).not.toBe("fail");
        expect(r.status).not.toBe("blank");
        expect(r.bodyLength).toBeGreaterThan(150);
      });
    }
  }
});
