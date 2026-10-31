// ============================================================
// E2E — Fluxo do Motorista (App Mobile -> Cadastro -> Análise)
// ============================================================
// Robô funcional de onboarding do prestador:
//   1. abre a versão mobile do site (/login -> /cadastro-prestador)
//   2. preenche os 5 passos com um motorista fictício (Moto / ABC-1234)
//   3. assina, envia e valida a tela "Aguardando análise"
//
// A camada de backend é mockada via `page.route` para que o teste rode
// sem tocar em produção nem no Supabase real (nenhum INSERT/DELETE).
// ============================================================

import { test, expect, devices, type Page } from "@playwright/test";

test.use({ ...devices["iPhone 13"], browserName: "chromium" });

const CANDIDATO_ID = "e2e-motorista-joao-piloto";
const MOTORISTA = {
  nome: "João Piloto E2E",
  cpf: "52998224725",
  nascimento: "1990-05-10",
  modelo: "Honda CG 160",
  placa: "ABC-1234",
  ano: "2024",
};

// PNG 1x1 válido (transparente) para os uploads de documentos.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function mockBackend(page: Page) {
  // Auth: sem sessão real — o cadastro é público.
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );

  // PostgREST: INSERT de candidato responde com id; leituras retornam vazio.
  await page.route("**/rest/v1/**", (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const accept = request.headers()["accept"] || "";
      const body = accept.includes("pgrst.object")
        ? { id: CANDIDATO_ID }
        : [{ id: CANDIDATO_ID }];
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify(body),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  // Edge Functions / Storage usados pelo pós-processamento do candidato.
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
    name: `documento-e2e-${indice}.png`,
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
}

async function avancar(page: Page) {
  await page.getByRole("button", { name: /Continuar/ }).click();
}

async function selecionarOpcao(page: Page, indiceCombobox: number, opcao: string) {
  await page.getByRole("combobox").nth(indiceCombobox).click();
  await page.getByRole("option", { name: opcao, exact: true }).click();
}

async function assinarNoCanvas(page: Page) {
  const canvas = page.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas de assinatura não encontrado");

  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3, { steps: 12 });
  await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();

  await page.getByRole("button", { name: /Confirmar/ }).click();
  await expect(page.getByText("Assinatura registrada")).toBeVisible();
}

test.describe("Fluxo do Motorista — Cadastro E2E", () => {
  test("motorista fictício conclui o onboarding e fica aguardando análise", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await mockBackend(page);

    // 1) Versão mobile do site
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Conexão Express/i }).first()).toBeVisible();

    // 2) Cadastro de prestador (rota pública do onboarding)
    await page.goto("/cadastro-prestador", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Dados Pessoais")).toBeVisible();

    // Passo 1 — Dados Pessoais
    await page.getByLabel("Nome Completo").fill(MOTORISTA.nome);
    await page.getByLabel("CPF").fill(MOTORISTA.cpf);
    await page.getByLabel("Data de Nascimento").fill(MOTORISTA.nascimento);
    await enviarArquivo(page, 0); // selfie
    await enviarArquivo(page, 1); // CNH
    await expect(page.locator('img[alt="Tire sua selfie"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('img[alt="Foto da CNH (frente)"]')).toBeVisible({ timeout: 30000 });
    await avancar(page);

    // Passo 2 — Veículo
    await expect(page.getByText("Informações do seu veículo")).toBeVisible();
    await selecionarOpcao(page, 0, "Moto");
    await page.getByLabel("Modelo").fill(MOTORISTA.modelo);
    await page.getByLabel("Placa").fill(MOTORISTA.placa);
    await expect(page.getByLabel("Placa")).toHaveValue("ABC1234");
    await page.getByLabel("Ano").fill(MOTORISTA.ano);
    await selecionarOpcao(page, 1, "Até 500 kg");
    await enviarArquivo(page, 0); // foto do veículo
    await avancar(page);

    // Passo 3 — Documentos
    await expect(page.getByText("Envie seus documentos digitalizados")).toBeVisible();
    await enviarArquivo(page, 0); // CRLV
    await enviarArquivo(page, 1); // Comprovante de residência
    await page.getByLabel("Banco").fill("Banco E2E");
    await page.getByLabel("Chave PIX").fill(MOTORISTA.cpf);
    await avancar(page);

    // Passo 4 — Disponibilidade
    await expect(page.getByText("Defina sua área e horários de atuação")).toBeVisible();
    await page.getByRole("button", { name: "Grande SP", exact: true }).click();
    await selecionarOpcao(page, 0, "Carga Seca");
    await page.getByRole("button", { name: "Municipal", exact: true }).click();
    await avancar(page);

    // Passo 5 — Assinatura
    await expect(page.getByText("Aceite os termos e assine digitalmente")).toBeVisible();
    await page.getByText("Aceito os termos da LGPD").click();
    await page.getByText("Aceito o contrato de prestação de serviços").click();
    await page.getByText("Aceito o termo de responsabilidade").click();
    await assinarNoCanvas(page);

    // 3) Enviar cadastro
    await page.getByRole("button", { name: /Finalizar Cadastro/ }).click();

    // 4) Tela final — "Aguardando análise" com os dados do motorista
    await expect(page.getByRole("heading", { name: "Cadastro Completo!" })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText("Aguardando análise")).toBeVisible();
    await expect(page.getByText(MOTORISTA.nome)).toBeVisible();
    await expect(page.getByText(/Moto/)).toBeVisible();
    await expect(page.getByText(/ABC1234/)).toBeVisible();

    expect(consoleErrors).toEqual([]);

    await page.screenshot({ path: "test-results/e2e-motorista/onboarding-concluido.png" });
  });
});
