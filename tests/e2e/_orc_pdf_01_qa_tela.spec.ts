/**
 * ORC-PDF-01-QA-FECHAMENTO — validação visual em navegador LOCAL (TMS :8800)
 * de que a TELA do orçamento continua exibindo distância + duração da rota
 * (a remoção de "Duração estimada" foi SOMENTE do PDF).
 *
 * Regras da micro-missão: sem migration, sem RLS, sem escrita de negócio,
 * sem alterar PDF/código/APP. Este spec é TEMPORÁRIO e será REMOVIDO ao final
 * (arquivos alterados = ZERO).
 *
 * OBS-1 (pré-existente, fora do escopo ORC-PDF-01): a busca da lista
 * ("Buscar por número...") derruba a página com
 * "Cannot read properties of null (reading 'toLowerCase')" quando existe
 * registro com cliente=NULL (5 rascunhos). Linha idêntica já existe em HEAD.
 * Por isso esta validação NÃO usa a caixa de busca: localiza a linha na tabela.
 */
import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const SENHA = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

const ORC_ROTA = "ORC-202609-8659";     // registro real com rota calculada (em_analise)
const ORC_RASCUNHO = "ORC-202607-3557"; // rascunho existente (unico status que expoe Editar)
const CEP_COLETA = "09750-001";
const CEP_ENTREGA = "12221-900";

const DIR = "test-results/orc-pdf-01-qa";
const S_LISTA = path.join(DIR, "01_lista_orc8659.png");
const S_PREVIEW = path.join(DIR, "02_preview_orc8659.png");
const S_FORM = path.join(DIR, "03_form_rascunho_card_rota.png");
const S_CARD = path.join(DIR, "04_card_rota_closeup.png");
const S_OBS_BUSCA = path.join(DIR, "05_observacao_busca_crash.png");

const evid: Record<string, unknown> = {
  missao: "ORC-PDF-01-QA-FECHAMENTO",
  quando: new Date().toISOString(),
  baseURL: "http://localhost:8800",
};

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  const email = page.locator('input[type="email"], input[placeholder*="email"]').first();
  await email.waitFor({ state: "visible", timeout: 15000 });
  await email.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(SENHA);
  await page.locator('button:has-text("Entrar")').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  await page.waitForTimeout(2500);
  evid.login = `OK (${EMAIL})`;
}

async function irParaOrcamentos(page: Page) {
  await page.goto("/comercial?tab=orcamentos", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  const body = (await page.locator("body").innerText().catch(() => "")) || "";
  if (body.includes("Carregando sessão")) {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    const pai = page.locator('button[title="Gestão Comercial"]').first();
    if (await pai.isVisible().catch(() => false)) {
      const filho = page.locator('button[title="Orçamentos"], a[href*="tab=orcamentos"]').first();
      if (!(await filho.isVisible().catch(() => false))) await pai.click();
      await page.waitForTimeout(600);
    }
    await page
      .locator('button[title="Orçamentos"], a[href*="tab=orcamentos"]')
      .first()
      .click({ timeout: 15000 });
    await page.waitForTimeout(2500);
  }
  await page
    .locator('input[placeholder*="Buscar por número"]')
    .waitFor({ state: "visible", timeout: 20000 });

  // Painel de Notificações abre sozinho e cobre a tabela (intercepta cliques).
  await dismissOverlays(page);
}

/** Fecha painéis/dialogos abertos que cobrem a página. */
async function dismissOverlays(page: Page) {
  for (let i = 0; i < 3; i++) {
    const painelNotif = page.locator('text=Notificações').first();
    if (await painelNotif.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      if (await painelNotif.isVisible().catch(() => false)) {
        await page.locator('button:has-text("Marcador"), button:has-text("Ver Histórico")').first().click({ timeout: 3000 }).catch(() => {});
        await page.locator("h1, h2, h3").first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
      continue;
    }
    break;
  }
}

/** Localiza a linha SEM digitar na busca (a busca quebra com cliente=NULL). */
async function acharLinha(page: Page, numero: string) {
  let linha = page.locator("tbody tr", { hasText: numero }).first();
  if (await linha.isVisible().catch(() => false)) return linha;
  const p2 = page.locator("div.flex button").filter({ hasText: /^2$/ }).first();
  if (await p2.isVisible().catch(() => false)) {
    await p2.click();
    await page.waitForTimeout(1500);
    linha = page.locator("tbody tr", { hasText: numero }).first();
  }
  return linha;
}

test("ORC-PDF-01-QA — tela do orçamento mantém distância + duração", async ({ page }) => {
  const errosConsole: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errosConsole.push(m.text());
  });

  await login(page);
  await irParaOrcamentos(page);

  // ---------- 1) ORC-202609-8659 (registro real com rota calculada) ----------
  const linhaRota = await acharLinha(page, ORC_ROTA);
  await expect(linhaRota, `linha ${ORC_ROTA} nao apareceu na lista`).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: S_LISTA, fullPage: false });
  evid.shot_lista = S_LISTA;
  evid.linha_8659_visivel = true;

  await dismissOverlays(page);
  await linhaRota.locator('button[title="Visualizar"]').click({ timeout: 20000 });
  await page.waitForTimeout(2500);
  const previewTxt = (await page.locator("body").innerText().catch(() => "")) || "";
  evid.preview_8659_aberto = previewTxt.includes(ORC_ROTA);
  evid.preview_8659_enderecos = /Endere(os|ços)\s*\/\s*Rotas/i.test(previewTxt);
  evid.preview_8659_possui_literal_duracao_estimada = previewTxt.includes("Duração estimada");
  await page.screenshot({ path: S_PREVIEW, fullPage: true });
  evid.shot_preview = S_PREVIEW;
  console.log("[QA] preview 8659 aberto =", evid.preview_8659_aberto);

  await page.getByRole("button", { name: /Voltar/ }).first().click();
  await page.waitForTimeout(1500);

  // ---------- OBS-1 (observação pré-existente, fora do escopo desta missão) ----------
  try {
    const busca = page.locator('input[placeholder*="Buscar por número"]');
    if (await busca.isVisible().catch(() => false)) {
      await busca.fill("8659");
      await page.waitForTimeout(2500);
      const corpo = (await page.locator("body").innerText().catch(() => "")) || "";
      evid.obs1_busca_crasha = /algo inesperado aconteceu|toLowerCase/i.test(corpo);
      if (evid.obs1_busca_crasha) {
        await page.screenshot({ path: S_OBS_BUSCA, fullPage: false });
        evid.shot_obs_busca = S_OBS_BUSCA;
      }
      console.log("[QA] OBS-1 busca crasha:", evid.obs1_busca_crasha);
      // recupera a página (reload + volta para a lista)
      await page.goto("/comercial?tab=orcamentos", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      await page
        .locator('input[placeholder*="Buscar por número"]')
        .waitFor({ state: "visible", timeout: 20000 });
    }
  } catch (e: any) {
    evid.obs1_erro = String(e?.message || e).slice(0, 200);
  }

  // ---------- 2) rascunho existente -> Editar -> aba Endereços ----------
  const linhaRasc = await acharLinha(page, ORC_RASCUNHO);
  await expect(linhaRasc, `rascunho ${ORC_RASCUNHO} nao apareceu`).toBeVisible({ timeout: 15000 });
  await dismissOverlays(page);
  const btnEditar = linhaRasc.locator('button[title="Editar"]');
  await expect(btnEditar, "sem botao Editar no rascunho").toHaveCount(1);
  await btnEditar.click();
  await page.waitForTimeout(2500);

  let abaEnd = page.getByRole("tab", { name: /Endere/ }).first();
  if (!(await abaEnd.isVisible().catch(() => false))) {
    abaEnd = page.locator('button, [role="tab"]').filter({ hasText: /Endere/ }).first();
  }
  await expect(abaEnd, "aba Endereços do formulário não encontrada").toBeVisible({ timeout: 20000 });
  await abaEnd.click();
  await page.waitForTimeout(1200);

  // Preenche os CEPs dos 2 pontos APENAS em estado local (NENHUM salvar é clicado).
  const ceps = page.locator('input[placeholder="00000-000"]');
  await expect(ceps, "CEPs do formulario nao encontrados").toHaveCount(2, { timeout: 10000 });
  await ceps.nth(0).fill(CEP_COLETA);
  await ceps.nth(0).press("Tab");
  await page.waitForTimeout(2000);
  await ceps.nth(1).fill(CEP_ENTREGA);
  await ceps.nth(1).press("Tab");
  console.log("[QA] CEPs preenchidos (estado local, sem salvar)");

  // ---------- 3) card azul: distância · duração ----------
  const card = page
    .locator("div", { hasText: /Dist.{0,2}ncia Coleta/ })
    .filter({ hasText: /ltima Entrega/ })
    .last();
  await expect(card, "card 'Distância Coleta → Última Entrega' não apareceu").toBeVisible({
    timeout: 60000,
  });
  await page.waitForTimeout(1500);

  const cardTxt = ((await card.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
  evid.card_rota_texto = cardTxt;
  console.log("[QA] CARD:", cardTxt);

  await page.screenshot({ path: S_FORM, fullPage: true });
  evid.shot_form = S_FORM;
  await card.screenshot({ path: S_CARD }).catch(() => {});
  evid.shot_card = S_CARD;

  const temKm = /\d+([.,]\d+)?\s*km/i.test(cardTxt);
  const temDuracao = /\d+\s*h|\d+\s*min/i.test(cardTxt);
  evid.tela_tem_distancia = temKm;
  evid.tela_tem_duracao = temDuracao;

  const bodyTela = (await page.locator("body").innerText().catch(() => "")) || "";
  evid.literal_duracao_estimada_na_tela = bodyTela.includes("Duração estimada");

  expect(temKm, `card sem distância: "${cardTxt}"`).toBe(true);
  expect(temDuracao, `card sem duração: "${cardTxt}"`).toBe(true);
  expect(
    evid.literal_duracao_estimada_na_tela,
    "literal 'Duração estimada' apareceu na tela (deveria existir só no PDF)"
  ).toBe(false);

  // ---------- 4) evidências ----------
  evid.erros_console_relevantes = errosConsole
    .filter((e) => /DistanceService|Mapbox|viacep|toLowerCase/i.test(e))
    .slice(0, 8);

  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, "evidencia.json"), JSON.stringify(evid, null, 2), "utf8");
});
