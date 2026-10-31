// ============================================================
// E2E VISUAL — Interação TMS (Torre) x App Mobile (Motorista)
// ============================================================
// Abre DUAS janelas lado a lado (dois contextos/browsers separados):
//   • Desktop  -> Operador na Torre de Controle
//   • Mobile   -> Motorista no App do Prestador (aba Rede)
//
// O Motorista aceita uma OS fictícia e o Operador vê a Torre atualizar
// (timeline/eventos e status da alocação) via refresh do banco mockado.
//
// Execução: npm run test:dual
// Nenhum dado real é criado/alterado: PostgREST/Auth/Functions são mockados.
// ============================================================

import { test, expect, chromium, devices, type Browser, type Page } from "@playwright/test";

test.setTimeout(300_000);

const OS_ID = "os-e2e-dual-001";
const OS_NUMERO = "OS-202610-777001";
const CLIENTE_ID = "cliente-e2e-dual";
const PRESTADOR_ID = "prestador-e2e-joao";
const EMAIL_OPERADOR = "operador.demo@conexaoexpress.com.br";

// Estado compartilhado entre as duas janelas (simula o banco/socket).
const estado = {
  aceita: false,
  aceiteEm: new Date().toISOString(),
};

const OPORTUNIDADE = {
  id: "op-e2e-dual-001",
  os_id: OS_ID,
  status: "publicada",
  valor_prestador: 185.5,
  veiculo_necessario: { tipo: "Moto", capacidade_kg: 30 },
  regiao: "São Paulo",
  prazo_expiracao: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  ordens_servico: {
    numero: OS_NUMERO,
    origem: "Rua Augusta, 500 - Consolação, São Paulo/SP",
    destino: "Av. Paulista, 1000 - Bela Vista, São Paulo/SP",
    distancia_km: 12.4,
    tipo_carga: "seca",
    peso: 18,
  },
};

const OS_DESKTOP = {
  id: OS_ID,
  numero: OS_NUMERO,
  status: "pendente",
  status_operacional: "aguardando_aceite",
  cliente: CLIENTE_ID,
  cliente_id: CLIENTE_ID,
  prestador: PRESTADOR_ID,
  prestador_id: PRESTADOR_ID,
  veiculo_tipo: "Moto",
  placa: "ABC1234",
  origem: "Rua Augusta, 500 - São Paulo/SP",
  destino: "Av. Paulista, 1000 - São Paulo/SP",
  distancia_km: 12.4,
  valor_cliente: 320,
  peso: 18,
  data: new Date().toISOString().slice(0, 10),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  enderecos: [],
  previsao_termino: null,
};

const ALOCACAO = {
  id: "aloc-e2e-dual-001",
  ordem_servico_id: OS_ID,
  prestador_id: PRESTADOR_ID,
  cliente_id: CLIENTE_ID,
  status: "aguardando_aceite",
  finalizada: false,
  data_finalizacao: null,
};

const EVENTO_CRIACAO = {
  id: "ev-criacao",
  event_type: "os.ordem_servico.criada",
  entity_type: "ordem_servico",
  entity_id: OS_ID,
  entity_number: OS_NUMERO,
  status: "pendente",
  source: "tms",
  created_by: "torre-controle",
  visibility: "public",
  payload: {
    os_numero: OS_NUMERO,
    cliente_nome: "Cliente Demo E2E",
    prestador_nome: "João Piloto E2E",
  },
  metadata: {},
  created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  processed_at: null,
  version: 1,
  retry_count: 0,
};

function eventoAceite() {
  return {
    id: "ev-aceite",
    event_type: "escala.alocacao.aceita",
    entity_type: "alocacao",
    entity_id: ALOCACAO.id,
    entity_number: OS_NUMERO,
    status: "aceita",
    source: "app_motorista",
    created_by: "joao.piloto.e2e",
    visibility: "public",
    payload: {
      os_numero: OS_NUMERO,
      cliente_nome: "Cliente Demo E2E",
      prestador_nome: "João Piloto E2E",
    },
    metadata: {},
    created_at: estado.aceiteEm,
    processed_at: null,
    version: 1,
    retry_count: 0,
  };
}

function jwtDemo(email: string, papel: string): string {
  const agora = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: `user-${papel}`,
      email,
      role: "authenticated",
      aud: "authenticated",
      iat: agora,
      exp: agora + 3600,
    }),
  ).toString("base64url");
  return `${header}.${payload}.dual-assinatura`;
}

const TENANT_USUARIO = {
  papel: "operacional",
  status: "ativo",
  tenant_id: "tenant-e2e",
  tenants: {
    id: "tenant-e2e",
    nome: "Conexão Express",
    slug: "conexao-express",
    plano: "pro",
    status: "ativo",
  },
};

async function pausa(ms = 1600) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function legenda(page: Page, lado: "DESKTOP" | "MOBILE", texto: string) {
  console.log(`\n[${lado}] ${texto}`);
  await page.evaluate(
    ({ titulo, cor, distancia }) => {
      const id = "dual-legenda";
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.style.position = "fixed";
        el.style.left = "50%";
        el.style.transform = "translateX(-50%)";
        el.style.color = "#fff";
        el.style.padding = "8px 16px";
        el.style.borderRadius = "999px";
        el.style.font = "700 12px/1.4 system-ui, sans-serif";
        el.style.boxShadow = "0 8px 24px rgba(0,0,0,.35)";
        el.style.zIndex = "99999";
        el.style.pointerEvents = "none";
        el.style.maxWidth = "92vw";
        el.style.textAlign = "center";
        document.body.appendChild(el);
      }
      el.style.bottom = distancia;
      el.style.background = cor;
      el.textContent = `🎬 ${titulo}`;
    },
    {
      titulo: texto,
      cor: lado === "DESKTOP" ? "#1d4ed8" : "#047857",
      distancia: lado === "DESKTOP" ? "18px" : "84px",
    },
  );
  await pausa(1200);
}

async function marcarJanela(page: Page, texto: string, cor: string) {
  await page.evaluate(
    ({ titulo, corFundo }) => {
      const id = "dual-titulo-janela";
      if (document.getElementById(id)) return;
      const el = document.createElement("div");
      el.id = id;
      el.style.position = "fixed";
      el.style.top = "0";
      el.style.left = "0";
      el.style.right = "0";
      el.style.background = corFundo;
      el.style.color = "#fff";
      el.style.padding = "4px 10px";
      el.style.font = "800 11px/1.5 system-ui, sans-serif";
      el.style.textAlign = "center";
      el.style.letterSpacing = "0.06em";
      el.style.zIndex = "99999";
      el.style.pointerEvents = "none";
      el.textContent = titulo;
      document.body.appendChild(el);
    },
    { titulo: texto, corFundo: cor },
  );
}

async function mockTorreDesktop(page: Page) {
  await page.route("**/auth/v1/**", (route) => {
    const url = route.request().url();
    const session = {
      access_token: jwtDemo(EMAIL_OPERADOR, "operacional"),
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "dual-refresh-operador",
      user: {
        id: "user-operacional",
        aud: "authenticated",
        role: "authenticated",
        email: EMAIL_OPERADOR,
        email_confirmed_at: new Date().toISOString(),
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: { name: "Operador Demo" },
        created_at: new Date().toISOString(),
      },
    };
    if (url.includes("/auth/v1/token")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
  });

  await page.route("**/rest/v1/**", (route) => {
    const request = route.request();
    const url = request.url();

    if (url.includes("/rest/v1/tenant_usuarios")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([TENANT_USUARIO]) });
    }

    if (url.includes("/rest/v1/ordens_servico")) {
      const os = { ...OS_DESKTOP, status: estado.aceita ? "em_rota" : "pendente" };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify([os]),
      });
    }

    if (url.includes("/rest/v1/alocacoes_escala")) {
      // Query de alocações sem OS inclui a coluna `metadata` no select.
      if (url.includes("metadata")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      const alocacao = { ...ALOCACAO, status: estado.aceita ? "em_rota" : "aguardando_aceite" };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([alocacao]) });
    }

    if (url.includes("/rest/v1/eventos_oficiais")) {
      const eventos = [EVENTO_CRIACAO, ...(estado.aceita ? [eventoAceite()] : [])];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(eventos) });
    }

    if (url.includes("/rest/v1/clientes")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: CLIENTE_ID, nome_fantasia: "Cliente Demo E2E", razao_social: "Cliente Demo E2E LTDA" }]),
      });
    }

    if (url.includes("/rest/v1/prestadores")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: PRESTADOR_ID, nome_completo: "João Piloto E2E" }]),
      });
    }

    if (request.method() === "POST") {
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "mock-post" }) });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/functions/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/storage/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

async function mockAppMobile(page: Page) {
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );

  await page.route("**/rest/v1/**", (route) => {
    const request = route.request();
    const url = request.url();

    if (url.includes("/rest/v1/rpc/f_obter_prestador_por_auth")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ prestador_id: PRESTADOR_ID, nome_completo: "João Piloto E2E" }]),
      });
    }

    if (url.includes("/rest/v1/rede_oportunidades")) {
      if (request.method() === "PATCH" || request.method() === "PUT") {
        estado.aceita = true;
        estado.aceiteEm = new Date().toISOString();
        console.log("\n[MOBILE] PATCH rede_oportunidades -> aceite gravado no mock");
        return route.fulfill({ status: 204, body: "" });
      }
      const linha = { ...OPORTUNIDADE, status: estado.aceita ? "aceita" : "publicada" };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify([linha]),
      });
    }

    if (request.method() === "POST") {
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "mock-post" }) });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/functions/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/storage/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

test.describe("Interação TMS x App — Torre e Motorista lado a lado", () => {
  test("motorista aceita OS e a Torre reflete o aceite", async () => {
    estado.aceita = false;
    estado.aceiteEm = new Date().toISOString();

    const headed = process.argv.includes("--headed");
    const posicaoDesktop = headed ? ["--window-position=0,0", "--window-size=1000,900"] : [];
    const posicaoMobile = headed ? ["--window-position=1000,0", "--window-size=460,900"] : [];

    let browserDesktop: Browser | null = null;
    let browserMobile: Browser | null = null;

    try {
      browserDesktop = await chromium.launch({ headless: !headed, slowMo: 1000, args: posicaoDesktop });
      browserMobile = await chromium.launch({ headless: !headed, slowMo: 1000, args: posicaoMobile });

      const desktop = await browserDesktop.newContext({
        viewport: { width: 1440, height: 900 },
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      });
      const mobile = await browserMobile.newContext({
        ...devices["iPhone 13"],
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      });

      const pageTorre = await desktop.newPage();
      const pageMotorista = await mobile.newPage();

      await mockTorreDesktop(pageTorre);
      await mockAppMobile(pageMotorista);

      // ---------- Janela 1: Torre de Controle ----------
      await legenda(pageTorre, "DESKTOP", "Janela 1 — Operador abrindo a Torre de Controle");
      await pageTorre.goto("/login", { waitUntil: "domcontentloaded" });
      await pageTorre.locator('input[type="email"]').fill(EMAIL_OPERADOR);
      await pausa(800);
      await pageTorre.locator('input[type="password"]').fill("demo1234");
      await pausa(800);
      await pageTorre.getByRole("button", { name: /Entrar/ }).click();
      await pageTorre.waitForURL(/\/operacao/, { timeout: 30000 });
      await pausa(1200);

      await pageTorre.goto("/torre-controle", { waitUntil: "domcontentloaded" });
      await expect(pageTorre.getByRole("heading", { name: /Torre de Controle Operacional/ })).toBeVisible({
        timeout: 30000,
      });
      await marcarJanela(pageTorre, "TORRE DE CONTROLE — OPERADOR", "#1d4ed8");
      await legenda(pageTorre, "DESKTOP", "Timeline inicial: OS aguardando aceite do motorista");
      await expect(pageTorre.getByText("Timeline Operacional")).toBeVisible();
      await expect(pageTorre.getByText("1 eventos")).toBeVisible({ timeout: 30000 });
      await pausa(2000);

      // ---------- Janela 2: App do Motorista ----------
      await legenda(pageMotorista, "MOBILE", "Janela 2 — Motorista abrindo o App na aba Rede");
      await pageMotorista.goto("/portal-prestador", { waitUntil: "domcontentloaded" });
      await expect(pageMotorista.getByRole("button", { name: "Rede", exact: true })).toBeVisible({
        timeout: 30000,
      });
      await pausa(1200);

      await pageMotorista.getByRole("button", { name: "Rede", exact: true }).click();
      await expect(pageMotorista.getByRole("heading", { name: /Rede de Oportunidades/ })).toBeVisible();
      await marcarJanela(pageMotorista, "APP MOTORISTA — REDE", "#047857");
      await pausa(1500);

      const card = pageMotorista.getByTestId("rede-oportunidade-card").first();
      await expect(card).toBeVisible({ timeout: 30000 });
      await expect(card).toContainText(OS_NUMERO);
      await expect(card).toContainText(/185,50/);
      await expect(card).toContainText("12,4 km");
      await legenda(pageMotorista, "MOBILE", `OS fictícia disponível: ${OS_NUMERO} · R$ 185,50 · 12,4 km`);
      await pausa(2500);

      // ---------- Detalhes + Aceite no Mobile ----------
      await legenda(pageMotorista, "MOBILE", "Abrindo detalhes e aceitando a OS da Rede");
      await card.click();
      await expect(pageMotorista.getByRole("heading", { name: "Detalhes da Oportunidade" })).toBeVisible();
      await pausa(2000);
      await pageMotorista.getByRole("button", { name: /Aceitar Oportunidade/ }).click();
      await expect(pageMotorista.getByText("Oportunidade aceita!")).toBeVisible({ timeout: 15000 });
      await legenda(pageMotorista, "MOBILE", "Aceite enviado — aguardando a Torre reagir");
      await pausa(2500);

      // ---------- Torre reage (refresh do banco mockado) ----------
      await legenda(pageTorre, "DESKTOP", "Torre atualizando: evento de aceite recebido");
      await pageTorre.getByRole("button", { name: "Atualizar", exact: true }).click();
      await expect(pageTorre.getByText("2 eventos")).toBeVisible({ timeout: 30000 });
      await expect(pageTorre.getByText(/escala alocacao aceita/i)).toBeVisible({ timeout: 30000 });
      await expect(pageTorre.getByText(/João Piloto E2E/).first()).toBeVisible();
      await legenda(pageTorre, "DESKTOP", "Status atualizado: OS aceita pelo motorista João Piloto E2E");
      await pausa(3500);

      await pageTorre.screenshot({ path: "test-results/dual/torre-atualizada.png", fullPage: false });
      await pageMotorista.screenshot({ path: "test-results/dual/app-motorista-aceite.png", fullPage: false });

      await desktop.close();
      await mobile.close();
      console.log("\n[DUAL] Interação Torre x App concluída ✅");
    } finally {
      await browserDesktop?.close().catch(() => undefined);
      await browserMobile?.close().catch(() => undefined);
    }
  });
});
