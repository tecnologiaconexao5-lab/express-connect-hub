// ============================================================
// SHOWCASE VISUAL — Jornada completa do Motorista
// ============================================================
// Demonstração em velocidade humana (slowMo 800 + pausas de leitura):
//   1. Cadastro completo do motorista (Nome, Moto, Placa)
//   2. Torre de Controle aprova o cadastro (mock)
//   3. Login com o novo motorista (mock de Auth)
//   4. App do prestador -> Bottom Menu -> aba "Rede"
//   5. OS fictícia disponível na Rede (valor, rota e distância)
//   6. Abre os detalhes da oportunidade
//
// Execução: npm run test:showcase
// Nenhum dado real é criado/alterado: todas as chamadas são mockadas.
// ============================================================

import { test, expect, devices, type Page } from "@playwright/test";

test.use({
  ...devices["iPhone 13"],
  browserName: "chromium",
  launchOptions: { slowMo: 800 },
});

test.setTimeout(300_000);

const EMAIL = "joao.piloto.e2e@conexaoexpress.com.br";
const SENHA = "demo1234";
const CANDIDATO_ID = "e2e-motorista-joao-piloto";
const PRESTADOR_ID = "e2e-prestador-joao-piloto";

const MOTORISTA = {
  nome: "João Piloto E2E",
  cpf: "52998224725",
  nascimento: "1990-05-10",
  modelo: "Honda CG 160",
  placa: "ABC-1234",
  ano: "2024",
};

const OPORTUNIDADE = {
  id: "op-e2e-001",
  os_id: "os-e2e-001",
  status: "publicada",
  valor_prestador: 185.5,
  veiculo_necessario: { tipo: "Moto", capacidade_kg: 30 },
  regiao: "São Paulo",
  prazo_expiracao: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  ordens_servico: {
    numero: "OS-202610-777001",
    origem: "Rua Augusta, 500 - Consolação, São Paulo/SP",
    destino: "Av. Paulista, 1000 - Bela Vista, São Paulo/SP",
    distancia_km: 12.4,
    tipo_carga: "seca",
    peso: 18,
  },
};

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function jwtDemo(): string {
  const agora = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "user-e2e-joao-piloto",
      email: EMAIL,
      role: "authenticated",
      aud: "authenticated",
      iat: agora,
      exp: agora + 3600,
    }),
  ).toString("base64url");
  return `${header}.${payload}.showcase-assinatura`;
}

async function mostrarLegenda(page: Page, texto: string) {
  console.log(`\n[SHOWCASE] ${texto}`);
  await page.evaluate((titulo) => {
    const id = "showcase-legenda";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.bottom = "88px";
      el.style.transform = "translateX(-50%)";
      el.style.background = "#0f172a";
      el.style.color = "#fff";
      el.style.padding = "8px 16px";
      el.style.borderRadius = "999px";
      el.style.font = "600 12px/1.4 system-ui, sans-serif";
      el.style.boxShadow = "0 8px 24px rgba(0,0,0,.35)";
      el.style.zIndex = "9999";
      el.style.pointerEvents = "none";
      el.style.maxWidth = "90vw";
      el.style.textAlign = "center";
      document.body.appendChild(el);
    }
    el.textContent = `🎬 ${titulo}`;
  }, texto);
  await page.waitForTimeout(1500);
}

async function pausaCena(page: Page, ms = 1500) {
  await page.waitForTimeout(ms);
}

async function mostrarAprovacaoTorre(page: Page) {
  console.log("\n[SHOWCASE] Torre de Controle aprovou o cadastro (mock)");
  await page.evaluate(() => {
    const id = "showcase-aprovacao";
    const el = document.createElement("div");
    el.id = id;
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.background = "rgba(15, 23, 42, 0.55)";
    el.style.backdropFilter = "blur(3px)";
    el.style.zIndex = "9998";
    el.style.pointerEvents = "none";

    const card = document.createElement("div");
    card.style.background = "#fff";
    card.style.borderRadius = "20px";
    card.style.padding = "24px 28px";
    card.style.textAlign = "center";
    card.style.boxShadow = "0 20px 50px rgba(0,0,0,.35)";
    card.style.maxWidth = "300px";
    card.style.font = "system-ui, sans-serif";

    const titulo = document.createElement("p");
    titulo.textContent = "✅ Cadastro aprovado!";
    titulo.style.font = "800 18px/1.3 system-ui, sans-serif";
    titulo.style.color = "#065f46";
    titulo.style.margin = "0 0 6px";

    const texto = document.createElement("p");
    texto.textContent = "Torre de Controle · aprovação instantânea (demonstração)";
    texto.style.font = "500 12px/1.5 system-ui, sans-serif";
    texto.style.color = "#475569";
    texto.style.margin = "0";

    card.appendChild(titulo);
    card.appendChild(texto);
    el.appendChild(card);
    document.body.appendChild(el);
  });
  await pausaCena(page, 3000);
  await page.evaluate(() => document.getElementById("showcase-aprovacao")?.remove());
}

async function mockBackend(page: Page) {
  const session = {
    access_token: jwtDemo(),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "showcase-refresh-token",
    user: {
      id: "user-e2e-joao-piloto",
      aud: "authenticated",
      role: "authenticated",
      email: EMAIL,
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { name: MOTORISTA.nome },
      created_at: new Date().toISOString(),
    },
  };

  const tenantUsuario = {
    papel: "prestador",
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

  await page.route("**/auth/v1/**", (route) => {
    const url = route.request().url();
    if (url.includes("/auth/v1/token")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
  });

  await page.route("**/rest/v1/**", (route) => {
    const request = route.request();
    const url = request.url();

    if (url.includes("/rest/v1/rpc/f_obter_prestador_por_auth")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ prestador_id: PRESTADOR_ID, nome_completo: MOTORISTA.nome }]),
      });
    }

    if (url.includes("/rest/v1/rede_oportunidades")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify([OPORTUNIDADE]),
      });
    }

    if (url.includes("/rest/v1/tenant_usuarios")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([tenantUsuario]),
      });
    }

    if (request.method() === "POST") {
      const accept = request.headers()["accept"] || "";
      const body = accept.includes("pgrst.object") ? { id: CANDIDATO_ID } : [{ id: CANDIDATO_ID }];
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify(body),
      });
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

async function enviarArquivo(page: Page, indice: number) {
  const input = page.locator('input[type="file"]').nth(indice);
  await input.setInputFiles({
    name: `documento-showcase-${indice}.png`,
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
}

async function avancar(page: Page) {
  await page.getByRole("button", { name: /Continuar/ }).click();
  await pausaCena(page, 1200);
}

async function selecionarOpcao(page: Page, indiceCombobox: number, opcao: string) {
  await page.getByRole("combobox").nth(indiceCombobox).click();
  await pausaCena(page, 700);
  await page.getByRole("option", { name: opcao, exact: true }).click();
  await pausaCena(page, 700);
}

async function assinarNoCanvas(page: Page) {
  const canvas = page.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas de assinatura não encontrado");

  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3, { steps: 20 });
  await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2, { steps: 20 });
  await page.mouse.up();
  await pausaCena(page, 1200);

  await page.getByRole("button", { name: /Confirmar/ }).click();
  await expect(page.getByText("Assinatura registrada")).toBeVisible();
  await pausaCena(page, 1200);
}

test.describe("Showcase — Jornada visual do motorista", () => {
  test("cadastro -> aprovação -> login -> Rede -> detalhes da OS", async ({ page }) => {
    await mockBackend(page);

    // ---------- PASSO 1: Cadastro ----------
    await mostrarLegenda(page, "Passo 1/6 — Cadastro do motorista");
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Conexão Express/i }).first()).toBeVisible();
    await pausaCena(page, 1500);

    await page.goto("/cadastro-prestador", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Dados Pessoais")).toBeVisible();
    await pausaCena(page, 1200);

    await page.getByLabel("Nome Completo").fill(MOTORISTA.nome);
    await pausaCena(page, 900);
    await page.getByLabel("CPF").fill(MOTORISTA.cpf);
    await pausaCena(page, 900);
    await page.getByLabel("Data de Nascimento").fill(MOTORISTA.nascimento);
    await pausaCena(page, 900);
    await enviarArquivo(page, 0);
    await enviarArquivo(page, 1);
    await expect(page.locator('img[alt="Tire sua selfie"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('img[alt="Foto da CNH (frente)"]')).toBeVisible({ timeout: 30000 });
    await pausaCena(page, 1500);
    await avancar(page);

    await expect(page.getByText("Informações do seu veículo")).toBeVisible();
    await selecionarOpcao(page, 0, "Moto");
    await page.getByLabel("Modelo").fill(MOTORISTA.modelo);
    await pausaCena(page, 900);
    await page.getByLabel("Placa").fill(MOTORISTA.placa);
    await pausaCena(page, 900);
    await page.getByLabel("Ano").fill(MOTORISTA.ano);
    await pausaCena(page, 900);
    await selecionarOpcao(page, 1, "Até 500 kg");
    await enviarArquivo(page, 0);
    await pausaCena(page, 1500);
    await avancar(page);

    await expect(page.getByText("Envie seus documentos digitalizados")).toBeVisible();
    await enviarArquivo(page, 0);
    await enviarArquivo(page, 1);
    await pausaCena(page, 1500);
    await page.getByLabel("Banco").fill("Banco E2E");
    await pausaCena(page, 900);
    await page.getByLabel("Chave PIX").fill(MOTORISTA.cpf);
    await pausaCena(page, 900);
    await avancar(page);

    await expect(page.getByText("Defina sua área e horários de atuação")).toBeVisible();
    await page.getByRole("button", { name: "Grande SP", exact: true }).click();
    await pausaCena(page, 700);
    await selecionarOpcao(page, 0, "Carga Seca");
    await page.getByRole("button", { name: "Municipal", exact: true }).click();
    await pausaCena(page, 1200);
    await avancar(page);

    await expect(page.getByText("Aceite os termos e assine digitalmente")).toBeVisible();
    await page.getByText("Aceito os termos da LGPD").click();
    await pausaCena(page, 600);
    await page.getByText("Aceito o contrato de prestação de serviços").click();
    await pausaCena(page, 600);
    await page.getByText("Aceito o termo de responsabilidade").click();
    await pausaCena(page, 600);
    await assinarNoCanvas(page);

    await page.getByRole("button", { name: /Finalizar Cadastro/ }).click();
    await expect(page.getByRole("heading", { name: "Cadastro Completo!" })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText("Aguardando análise")).toBeVisible();
    await pausaCena(page, 2500);

    // ---------- PASSO 2: Aprovação da Torre (mock) ----------
    await mostrarLegenda(page, "Passo 2/6 — Torre de Controle aprova o cadastro");
    await mostrarAprovacaoTorre(page);

    // ---------- PASSO 3: Login do novo motorista ----------
    await mostrarLegenda(page, "Passo 3/6 — Login do motorista aprovado");
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill(EMAIL);
    await pausaCena(page, 900);
    await page.locator('input[type="password"]').fill(SENHA);
    await pausaCena(page, 900);
    await page.getByRole("button", { name: /Entrar/ }).click();
    await page.waitForURL(/\/app-prestador/, { timeout: 30000 });
    await pausaCena(page, 2500);

    // ---------- PASSO 4: App do prestador -> Bottom Menu -> Rede ----------
    await mostrarLegenda(page, "Passo 4/6 — Entrando no App do prestador");
    await page.goto("/portal-prestador", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Rede", exact: true })).toBeVisible({
      timeout: 30000,
    });
    await pausaCena(page, 2000);

    await mostrarLegenda(page, "Passo 4/6 — Navegando pelo Bottom Menu até a aba Rede");
    await page.getByRole("button", { name: "Rede", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Rede de Oportunidades/ })).toBeVisible();
    await pausaCena(page, 2000);

    // ---------- PASSO 5: OS fictícia disponível ----------
    await mostrarLegenda(page, "Passo 5/6 — OS disponível na Rede (valor, rota e distância)");
    const card = page.getByTestId("rede-oportunidade-card").first();
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card).toContainText("OS-202610-777001");
    await expect(card).toContainText(/185,50/);
    await expect(card).toContainText("12,4 km");
    await expect(card).toContainText("Rua Augusta");
    await expect(card).toContainText("Av. Paulista");
    await pausaCena(page, 3500);

    // ---------- PASSO 6: Detalhes da OS ----------
    await mostrarLegenda(page, "Passo 6/6 — Abrindo os detalhes da oportunidade");
    await card.click();
    await expect(page.getByRole("heading", { name: "Detalhes da Oportunidade" })).toBeVisible();
    await expect(page.getByText(/185,50/).last()).toBeVisible();
    await expect(page.getByRole("button", { name: /Aceitar Oportunidade/ })).toBeVisible();
    await pausaCena(page, 4000);

    await page.screenshot({ path: "test-results/showcase/jornada-final.png", fullPage: false });
    console.log("\n[SHOWCASE] Jornada concluída ✅");
  });
});
