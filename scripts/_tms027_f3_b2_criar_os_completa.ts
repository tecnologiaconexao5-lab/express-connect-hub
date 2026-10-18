import { chromium } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:8800";
const EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const SENHA = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";
const MARKER = "HML-APP-20260801";
const PLACA = "ABC-1234";
const OUT = "test-results/e2e/tms027-f3";
const HOJE = new Date().toISOString().split("T")[0];

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

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const pageErrors: string[] = [];
  const consoleLogs: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.text().includes("[OS SAVE]") || m.text().includes("[SincronizacaoEscala]")) consoleLogs.push(m.text());
  });

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator('input[type="email"], input[placeholder*="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(SENHA);
  await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
  await page.waitForTimeout(5000);
  if (page.url().includes("/login")) { console.log("FALHA login"); process.exit(1); }

  await page.goto(`${BASE}/operacao?tab=os`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.locator('button:has-text("Nova OS")').first().click();
  await page.waitForTimeout(4000);
  await screenshot(page, "b2-form-nova-os");

  const numOS = await page.locator('label:has-text("Nº OS")').first().locator("xpath=..").locator("input").first().inputValue().catch(() => "");
  console.log(`[B0] Nº OS gerado: ${numOS}`);
  add("B0", "Nº OS auto-gerado", "Formato OS-2026-XXXXXX", numOS || "vazio", !!numOS, numOS);

  // Aba 1: Cliente
  const clienteOk = await preencherSearchable(page, "Cliente", "HOMOLOGAÇÃO", "HOMOLOGAÇÃO APP");
  add("B2", "Preencher Cliente HML", "Cliente selecionado", clienteOk ? "selecionado" : "não", clienteOk);

  // Marcador em Instruções Operacionais da OS
  const instrLabel = page.locator('label:has-text("Instruções Operacionais da OS")').first();
  if (await instrLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
    const ta = instrLabel.locator("xpath=..").locator("textarea").first();
    if (await ta.isVisible().catch(() => false)) {
      await ta.fill(`OS DE HOMOLOGAÇÃO TMS-027 FASE 3 — ${MARKER}`);
      add("B6", "Marcador em Instruções", MARKER, "preenchido", true);
    }
  }

  // Status → Pendente (aba 1)
  const statusField = page.locator('label:has-text("Status Operacional")').first();
  if (await statusField.isVisible({ timeout: 3000 }).catch(() => false)) {
    const trigger = statusField.locator("xpath=..").locator('button[role="combobox"]').first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(600);
      const op = page.locator('[role="option"]').filter({ hasText: "Pendente" }).first();
      if (await op.isVisible({ timeout: 3000 }).catch(() => false)) {
        await op.click();
        await page.waitForTimeout(400);
        add("B6b", "Status inicial = Pendente", "pendente", "definido", true);
      }
    }
  }
  await screenshot(page, "b6-status-pendente");

  // Aba 4 Rotas e Paradas
  await page.locator('button[role="tab"]:has-text("Rotas e Paradas")').first().click().catch(() => {});
  await page.waitForTimeout(1500);

  const preencherEnderecoParada = async (idx: number, d: any) => {
    const cep = page.locator('input[placeholder="00000-000"]').nth(idx);
    if (await cep.isVisible({ timeout: 4000 }).catch(() => false)) {
      await cep.fill(d.cep);
      await page.waitForTimeout(1200);
    }
    const num = page.locator('input[placeholder="Nº"]').nth(idx);
    if (await num.isVisible().catch(() => false)) await num.fill(d.numero);
    const bairro = page.locator('label:has-text("Bairro")').nth(idx).locator("xpath=following-sibling::input[1]");
    if (await bairro.isVisible().catch(() => false)) await bairro.fill(d.bairro);
    const cidade = page.locator('label:has-text("Cidade")').nth(idx).locator("xpath=following-sibling::input[1]");
    if (await cidade.isVisible().catch(() => false)) await cidade.fill(d.cidade);
    const logr = page.locator('input[placeholder="Digite o endereço para buscar sugestões"]').nth(idx);
    if (await logr.isVisible().catch(() => false)) {
      await logr.click();
      await logr.fill(d.logradouro);
      await page.waitForTimeout(600);
      await page.keyboard.press("Escape").catch(() => {});
    }
    const nomeLocal = page.locator('input[placeholder*="Hospital"]').nth(idx);
    if (await nomeLocal.isVisible().catch(() => false)) await nomeLocal.fill(d.nomeLocal);
    await page.waitForTimeout(300);
  };

  await preencherEnderecoParada(0, {
    cep: "07020-000", logradouro: "Av. Papa João XXIII", numero: "200",
    bairro: "Vila Progresso", cidade: "Guarulhos", uf: "SP", nomeLocal: "CD Matriz HML",
  });
  add("B5a", "Parada 1 coleta", "CEP+logradouro", "preenchido", true);

  const btnAdicionar = page.locator('button:has-text("Adicionar Parada")').first();
  if (await btnAdicionar.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btnAdicionar.click();
    await page.waitForTimeout(1000);
  }

  const cards = page.locator("div.overflow-hidden.group");
  if ((await cards.count()) >= 2) {
    const tipoTrigger = cards.nth(1).locator('button[role="combobox"]').first();
    if (await tipoTrigger.isVisible().catch(() => false)) {
      await tipoTrigger.click();
      await page.waitForTimeout(600);
      const op = page.locator('[role="option"]:has-text("Entrega")').first();
      if (await op.isVisible({ timeout: 3000 }).catch(() => false)) {
        await op.click();
        await page.waitForTimeout(400);
      }
    }
  }

  await preencherEnderecoParada(1, {
    cep: "01310-100", logradouro: "Av. Paulista", numero: "1000",
    bairro: "Bela Vista", cidade: "São Paulo", uf: "SP", nomeLocal: "Cliente HML",
  });
  add("B5d", "Parada 2 entrega", "CEP+logradouro", "preenchido", true);
  await screenshot(page, "b5-paradas-prontas");

  // Aba 3 Veículo: selecionar Tipo de Veículo VUC
  await page.locator('button[role="tab"]:has-text("Veículo")').first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const veiculoSelect = page.locator('select').filter({ hasText: "VUC" }).first();
  if (await veiculoSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await veiculoSelect.selectOption("VUC").catch(() => {});
    add("B5g", "Tipo de Veículo VUC", "VUC", "selecionado", true);
  }
  const placaAba3 = page.locator('label:has-text("Placa do Veiculo")').first();
  if (await placaAba3.isVisible({ timeout: 2000 }).catch(() => false)) {
    const inp = placaAba3.locator("xpath=..").locator("input").first();
    await inp.fill(PLACA).catch(() => {});
  }
  await screenshot(page, "b5-veiculo");

  // Aba 5 Torre & Financeiro: Data Programada, Início Previsto, Prestador, Placa
  await page.locator('button[role="tab"]:has-text("Torre & Financeiro")').first().click().catch(() => {});
  await page.waitForTimeout(1500);

  const dataProg = page.locator('label:has-text("Data Programada")').first();
  if (await dataProg.isVisible({ timeout: 3000 }).catch(() => false)) {
    const inp = dataProg.locator("xpath=..").locator("input").first();
    await inp.fill(HOJE);
    add("B5e", "Data Programada hoje", HOJE, "preenchido", true);
  }
  const inicioPrev = page.locator('label:has-text("Início Previsto")').first();
  if (await inicioPrev.isVisible({ timeout: 3000 }).catch(() => false)) {
    const inp2 = inicioPrev.locator("xpath=..").locator("input").first();
    await inp2.fill(`${HOJE}T08:00`);
    add("B5f", "Início Previsto 08:00", "08:00", "preenchido", true);
  }

  const prestOk = await preencherSearchable(page, "Parceiro / Prestador", "PRESTADOR TESTE", "PRESTADOR TESTE APP");
  add("B3", "Preencher Prestador HML", "Prestador selecionado", prestOk ? "selecionado" : "não", prestOk);

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
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(500);
      const toastsAtuais = await page.locator('[data-sonner-toast], .sonner-toast, [role="status"]').allInnerTexts().catch(() => []);
      for (const t of toastsAtuais) if (t && !toasts.includes(t)) toasts.push(t);
    }
    console.log("[B7] Toasts:", JSON.stringify(toasts));
    const body = await page.locator("body").innerText().catch(() => "");
    const sucesso = /salva com sucesso/i.test(body) || toasts.some((t) => /salva com sucesso/i.test(t));
    const escalaOk = toasts.some((t) => /Escala criada|Escala atualizada/i.test(t));
    add("B7", "Salvar OS", "toast sucesso", sucesso ? "sucesso" : "falha", sucesso);
    if (!escalaOk) add("B7b", "Escala criada automaticamente", "Escala criada", "não confirmada", false);
  } else {
    add("B7", "Salvar OS", "botão Salvar OS", "não encontrado", false);
  }
  await screenshot(page, "b7-pos-salvar");
  console.log("[B] Console OS SAVE:", consoleLogs.join("\n"));

  fs.writeFileSync(`${OUT}/resultado-b2.json`, JSON.stringify({ resultados, numOS, pageErrors, consoleLogs }, null, 2));
  console.log(`Resumo: ${resultados.filter((r) => r.ok).length}/${resultados.length} OK`);
  console.log(`Nº OS: ${numOS}`);
  await browser.close();
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
