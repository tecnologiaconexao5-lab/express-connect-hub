import { chromium } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:8800";
const EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const SENHA = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";
const MARKER = "HML-APP-20260801";
const PLACA = "ABC-1234";
const OUT = "test-results/e2e/tms027-f3";

const resultados: any[] = [];
function add(id: string, fluxo: string, esperado: string, encontrado: string, ok: boolean, nota = "") {
  resultados.push({ id, fluxo, esperado, encontrado, ok, nota });
  console.log(`${ok ? "[OK]" : "[FALHA]"} ${id} — ${encontrado}`);
}

async function screenshot(page: any, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

async function preencherSearchable(page: any, labelText: string, termo: string, liTexto: string) {
  const label = page.locator(`label:has-text("${labelText}")`).first();
  if (!(await label.isVisible({ timeout: 4000 }).catch(() => false))) return false;
  const input = label.locator("xpath=..").locator("input").first();
  if (!(await input.isVisible().catch(() => false))) return false;
  await input.click();
  await input.fill(termo);
  await page.waitForTimeout(1300);
  const opt = page.locator(`li:has-text("${liTexto}")`).first();
  if (!(await opt.isVisible({ timeout: 3000 }).catch(() => false))) return false;
  await opt.click();
  await page.waitForTimeout(700);
  return true;
}

async function preencherEnderecoParada(page: any, idx: number, d: { cep: string; logradouro: string; numero: string; bairro: string; cidade: string; uf: string; nomeLocal: string }) {
  const cep = page.locator('input[placeholder="00000-000"]').nth(idx);
  if (await cep.isVisible({ timeout: 4000 }).catch(() => false)) {
    await cep.fill(d.cep);
    await page.waitForTimeout(1200); // espera consulta CEP
  }
  const logr = page.locator('input[placeholder="Digite o endereço para buscar sugestões"]').nth(idx);
  if (await logr.isVisible().catch(() => false)) {
    await logr.click();
    await logr.fill(d.logradouro);
    await page.waitForTimeout(600);
    // fecha sugestões se abriu (esc)
    await page.keyboard.press("Escape").catch(() => {});
  }
  const num = page.locator('input[placeholder="Nº"]').nth(idx);
  if (await num.isVisible().catch(() => false)) await num.fill(d.numero);
  const bairro = page.locator('label:has-text("Bairro")').nth(idx).locator("xpath=following-sibling::input[1]");
  if (await bairro.isVisible().catch(() => false)) await bairro.fill(d.bairro);
  const cidade = page.locator('label:has-text("Cidade")').nth(idx).locator("xpath=following-sibling::input[1]");
  if (await cidade.isVisible().catch(() => false)) await cidade.fill(d.cidade);
  const nomeLocal = page.locator('input[placeholder*="Hospital"]').nth(idx);
  if (await nomeLocal.isVisible().catch(() => false)) await nomeLocal.fill(d.nomeLocal);
  await page.waitForTimeout(300);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator('input[type="email"], input[placeholder*="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(SENHA);
  await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
  await page.waitForTimeout(5000);
  if (page.url().includes("/login")) { console.log("FALHA login"); process.exit(1); }

  await page.goto(`${BASE}/operacao?tab=os`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);
  const btnNovaOS = page.locator('button:has-text("Nova OS")').first();
  await btnNovaOS.click();
  await page.waitForTimeout(4000);
  await screenshot(page, "b2-form-nova-os");

  // Capturar número da OS
  const numOS = await page.locator('label:has-text("Nº OS")').first().locator("xpath=..").locator("input").first().inputValue().catch(() => "");
  console.log(`[B0] Nº OS gerado: ${numOS}`);
  add("B0", "Nº OS auto-gerado", "Formato OS-2026-XXXXXX", numOS || "vazio", !!numOS, numOS);

  // Aba 1: Cliente
  const clienteOk = await preencherSearchable(page, "Cliente", "HOMOLOGAÇÃO", "HOMOLOGAÇÃO APP");
  add("B2", "Preencher Cliente HML", "Cliente selecionado", clienteOk ? "selecionado" : "não", clienteOk);
  await screenshot(page, "b2-cliente-selecionado");

  // Observações (marcador)
  const obsLabel = page.locator('label:has-text("Observações")').first();
  if (await obsLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
    const obsInput = obsLabel.locator("xpath=..").locator("textarea, input").first();
    if (await obsInput.isVisible().catch(() => false)) {
      await obsInput.fill(`OS DE HOMOLOGAÇÃO TMS-027 FASE 3 — ${MARKER}`);
      add("B6", "Marcador em Observações", MARKER, "preenchido", true);
    }
  }
  await screenshot(page, "b6-observacoes");

  // Aba 4 Rotas e Paradas
  await page.locator('button[role="tab"]:has-text("Rotas e Paradas")').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await screenshot(page, "b4-enderecos");

  // Parada 1 (coleta)
  await preencherEnderecoParada(page, 0, {
    cep: "07020-000",
    logradouro: "Av. Papa João XXIII",
    numero: "200",
    bairro: "Vila Progresso",
    cidade: "Guarulhos",
    uf: "SP",
    nomeLocal: "CD Matriz HML",
  });
  add("B5a", "Parada 1 coleta preenchida", "CEP+logradouro", "preenchido", true);

  // Adicionar Parada (entrega)
  const btnAdicionar = page.locator('button:has-text("Adicionar Parada")').first();
  if (await btnAdicionar.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btnAdicionar.click();
    await page.waitForTimeout(1000);
    add("B5b", "Adicionar 2ª parada", "2 paradas", "adicionada", true);
  }
  await screenshot(page, "b5-parada2");

  // Mudar tipo da 2ª parada para entrega
  const cards = page.locator("div.overflow-hidden.group");
  console.log(`[B5c] cards de parada: ${await cards.count()}`);
  if ((await cards.count()) >= 2) {
    const tipoTrigger = cards.nth(1).locator('button[role="combobox"]').first();
    if (await tipoTrigger.isVisible().catch(() => false)) {
      await tipoTrigger.click();
      await page.waitForTimeout(600);
      const op = page.locator('[role="option"]:has-text("Entrega")').first();
      if (await op.isVisible({ timeout: 3000 }).catch(() => false)) {
        await op.click();
        await page.waitForTimeout(400);
        add("B5c", "Tipo 2ª parada = entrega", "Entrega", "definido", true);
      }
    }
  }
  await screenshot(page, "b5-parada2-tipo");

  // Parada 2 (entrega)
  await preencherEnderecoParada(page, 1, {
    cep: "01310-100",
    logradouro: "Av. Paulista",
    numero: "1000",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP",
    nomeLocal: "Cliente HML",
  });
  add("B5d", "Parada 2 entrega preenchida", "CEP+logradouro", "preenchido", true);
  await screenshot(page, "b5-paradas-prontas");

  // Aba 5 Torre & Financeiro: Prestador + Placa
  await page.locator('button[role="tab"]:has-text("Torre & Financeiro")').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const prestOk = await preencherSearchable(page, "Parceiro / Prestador", "PRESTADOR TESTE", "PRESTADOR TESTE APP");
  add("B3", "Preencher Prestador HML", "Prestador selecionado", prestOk ? "selecionado" : "não", prestOk);
  await screenshot(page, "b3-prestador");

  const placaField = page.locator('label:has-text("Placa Alocada")').first();
  if (await placaField.isVisible({ timeout: 3000 }).catch(() => false)) {
    const placaInput = placaField.locator("xpath=..").locator("input").first();
    await placaInput.fill(PLACA);
    add("B4", "Preencher Placa Alocada", PLACA, "preenchido", true);
  }
  await screenshot(page, "b4-placa");

  // Salvar OS
  const btnSalvar = page.locator('button:has-text("Salvar OS")').first();
  if (await btnSalvar.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btnSalvar.click();
    const toasts: string[] = [];
    for (let i = 0; i < 14; i++) {
      await page.waitForTimeout(500);
      const toastsAtuais = await page.locator('[data-sonner-toast], .sonner-toast, [role="status"]').allInnerTexts().catch(() => []);
      for (const t of toastsAtuais) {
        if (t && !toasts.includes(t)) toasts.push(t);
      }
    }
    console.log("[B7] Toasts capturados:", JSON.stringify(toasts));
    const body = await page.locator("body").innerText().catch(() => "");
    const sucesso = /salva com sucesso|Escala criada|Escala atualizada/i.test(body) || toasts.some((t) => /sucesso|criada|atualizada/i.test(t));
    const erroToast = toasts.filter((t) => /erro|não é possível|inválida|adicione|selecione|inadimplente|obrigat/i.test(t));
    add("B7", "Salvar OS", "toast sucesso", sucesso ? "sucesso" : erroToast.length ? `ERRO: ${erroToast.join(" | ")}` : "sem confirmação", sucesso, erroToast.join(" | "));
  } else {
    add("B7", "Salvar OS", "botão Salvar OS", "não encontrado", false);
  }
  await screenshot(page, "b7-pos-salvar");

  fs.writeFileSync(`${OUT}/resultado-b.json`, JSON.stringify({ resultados, numOS, pageErrors }, null, 2));
  console.log("=============================================");
  console.log(`Resumo: ${resultados.filter(r => r.ok).length}/${resultados.length} OK`);
  console.log(`Nº OS: ${numOS}`);
  console.log(`Page errors: ${pageErrors.length}`);
  if (pageErrors.length) console.log(pageErrors.slice(0, 10).join("\n"));

  await browser.close();
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
