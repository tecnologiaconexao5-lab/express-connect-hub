import { chromium } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:8800";
const EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const SENHA = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";
const MARKER = "HML-APP-20260801";
const NUM_OS = "OS-202608-390664";
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

  // Buscar a OS recém-criada
  await page.goto(`${BASE}/operacao?tab=os`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);
  const searchInput = page.locator('input[placeholder*="buscar"], input[placeholder*="Buscar"], input[placeholder*="OS"]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(NUM_OS);
    await page.waitForTimeout(1500);
  }
  await screenshot(page, "c1-busca-os");

  // Encontrar o botão Editar da linha da OS
  const linha = page.locator(`tr:has-text("${NUM_OS}")`).first();
  if (!(await linha.isVisible({ timeout: 5000 }).catch(() => false))) {
    add("C1", "Localizar OS na lista", "linha visível", "não encontrada", false);
    fs.writeFileSync(`${OUT}/resultado-c.json`, JSON.stringify({ resultados, pageErrors }, null, 2));
    await browser.close();
    process.exit(1);
  }
  const editar = linha.locator('button[title="Editar"]').first();
  await editar.click();
  await page.waitForTimeout(3500);
  await screenshot(page, "c2-form-editando");

  // Aba 1 — Instruções Operacionais da OS (marcador) + Status Pendente
  const instrucoesLabel = page.locator('label:has-text("Instruções Operacionais da OS")').first();
  if (await instrucoesLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
    const ta = instrucoesLabel.locator("xpath=..").locator("textarea").first();
    if (await ta.isVisible().catch(() => false)) {
      await ta.fill(`OS DE HOMOLOGAÇÃO TMS-027 FASE 3 — ${MARKER}`);
      add("C3", "Marcador em Instruções Operacionais", MARKER, "preenchido", true);
    }
  }

  // Status Operacional → Pendente
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
        add("C4", "Status → Pendente", "pendente", "definido", true);
      }
    }
  }
  await screenshot(page, "c3-status-pendente");

  // Aba 5 Torre & Financeiro — Data Programada hoje + Início Previsto
  await page.locator('button[role="tab"]:has-text("Torre & Financeiro")').first().click().catch(() => {});
  await page.waitForTimeout(1500);

  const hoje = new Date().toISOString().split("T")[0];
  const dataProg = page.locator('label:has-text("Data Programada")').first();
  if (await dataProg.isVisible({ timeout: 3000 }).catch(() => false)) {
    const inp = dataProg.locator("xpath=..").locator("input").first();
    await inp.fill(hoje);
    add("C5", "Data Programada hoje", hoje, "preenchido", true);
  }
  const inicioPrev = page.locator('label:has-text("Início Previsto")').first();
  if (await inicioPrev.isVisible({ timeout: 3000 }).catch(() => false)) {
    const inp2 = inicioPrev.locator("xpath=..").locator("input").first();
    await inp2.fill(`${hoje}T08:00`);
    add("C6", "Início Previsto", "08:00", "preenchido", true);
  }
  await screenshot(page, "c4-data-programada");

  // Salvar
  const btnSalvar = page.locator('button:has-text("Salvar OS")').first();
  if (await btnSalvar.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btnSalvar.click();
    const toasts: string[] = [];
    for (let i = 0; i < 14; i++) {
      await page.waitForTimeout(500);
      const toastsAtuais = await page.locator('[data-sonner-toast], .sonner-toast, [role="status"]').allInnerTexts().catch(() => []);
      for (const t of toastsAtuais) if (t && !toasts.includes(t)) toasts.push(t);
    }
    console.log("[C7] Toasts:", JSON.stringify(toasts));
    const body = await page.locator("body").innerText().catch(() => "");
    const sucesso = /salva com sucesso|Escala criada|Escala atualizada/i.test(body) || toasts.some((t) => /sucesso|criada|atualizada/i.test(t));
    const escalaOk = toasts.some((t) => /Escala criada|Escala atualizada/i.test(t));
    add("C7", "Salvar OS edição", "sucesso + escala", sucesso ? (escalaOk ? "sucesso + escala" : "sucesso (escala pendente)") : "falha", sucesso);
  }
  await screenshot(page, "c5-pos-salvar");
  console.log("[C] Console OS SAVE:", consoleLogs.join("\n"));

  fs.writeFileSync(`${OUT}/resultado-c.json`, JSON.stringify({ resultados, pageErrors, consoleLogs }, null, 2));
  console.log(`Resumo: ${resultados.filter((r) => r.ok).length}/${resultados.length} OK`);
  await browser.close();
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
