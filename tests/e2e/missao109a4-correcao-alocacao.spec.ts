import { test, expect, Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";

const EVIDENCE = path.resolve("docs/homologacao/missao-109-a4");
const OS1_ID = "bf466936-b5b5-4526-b9e4-fa77229eb4dd";
const OS1_NUM = "OS-202607-426505";
const OS2_ID = "313b4bac-31ed-4a38-ae27-0a97ade7a06f";
const OS2_NUM = "OS-202607-912256";
const PREST_ID = "e6646799-fbac-453e-a3ef-afdfc01a7085";

const supabase = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

let aloc1Id: string | null = null;
let aloc2Id: string | null = null;

function ensureDir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
async function screen(page: Page, name: string) {
  ensureDir(EVIDENCE); await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), fullPage: true }).catch(() => {});
}
async function saveJson(d: any, n: string) { ensureDir(EVIDENCE); fs.writeFileSync(path.join(EVIDENCE, n), JSON.stringify(d, null, 2)); }

async function login(page: Page) {
  await page.goto("http://localhost:8800/login", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"]').first().fill("tamiris.castilho@conexaoexpress.com.br");
  await page.locator('input[type="password"]').first().fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  expect(page.url()).not.toContain("/login");
}

async function abrirOSEHParaEdicao(page: Page, osNum: string) {
  await page.locator('button:has-text("Apoio Operacional")').first().click();
  await page.waitForTimeout(1000);
  await page.locator('button:has-text("Ordens de Serviço")').first().click();
  await page.waitForTimeout(3000);
  const editBtn = page.locator(`tr:has-text("${osNum}") [title="Editar"]`).first();
  await expect(editBtn).toHaveCount(1, { timeout: 5000 });
  await editBtn.click({ force: true });
  await page.waitForTimeout(2000);
}

async function preencherDadosAlocacao(page: Page) {
  // Tab Torre
  await page.locator('button:has-text("5. Torre")').first().click();
  await page.waitForTimeout(1500);
  // Data
  await page.locator('input[type="date"]').first().fill(new Date().toISOString().split("T")[0]);
  // Prestador
  await page.locator('input[placeholder="Buscar..."]').last().click();
  await page.locator('input[placeholder="Buscar..."]').last().fill("PRESTADOR TESTE");
  await page.waitForTimeout(2000);
  await page.locator("text=PRESTADOR TESTE APP").first().click();
  await page.waitForTimeout(1000);
  // Placa
  await page.locator('input[placeholder="ABC-1234"]').first().fill("ABC1T23");
  // Tab Veiculo → Fiorino
  await page.locator('button:has-text("3. Veículo")').first().click();
  await page.waitForTimeout(1000);
  const combs = page.locator('[role="combobox"]');
  const cc = await combs.count();
  for (let i = 0; i < cc; i++) {
    const txt = await combs.nth(i).textContent().catch(() => "");
    if (!txt || txt.includes("Selecionar") || txt.match(/VUC|Toco|Truck/)) {
      await combs.nth(i).click();
      await page.waitForTimeout(300);
      const fio = page.locator('[role="option"]:has-text("Fiorino")').first();
      if (await fio.isVisible({ timeout: 1000 }).catch(() => false)) {
        await fio.click(); await page.waitForTimeout(500); break;
      }
      await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    }
  }
  // Voltar e Salvar
  await page.locator('button:has-text("5. Torre")').first().click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Salvar OS")').first().click({ timeout: 20000 });
  await page.waitForTimeout(6000);
}

test.describe("M109-A4", () => {
  test("OS1: Alocacao automatica via interface", async ({ page }) => {
    await login(page); await screen(page, "01-login");
    await abrirOSEHParaEdicao(page, OS1_NUM);
    await screen(page, "02-os1-edit");
    await preencherDadosAlocacao(page);
    await screen(page, "03-pos-salvar");

    const { data: alocs } = await supabase.from("alocacoes_escala").select("*").eq("ordem_servico_id", OS1_ID);
    if (alocs && alocs.length > 0) {
      aloc1Id = alocs[0].id;
      console.log(`\n=== ALOCACAO OS1 ===`);
      console.log(`ID: ${aloc1Id}`);
      console.log(`Status: ${alocs[0].status}`);
      console.log(`Aceite: ${alocs[0].aceite_prestador}`);
      console.log(`Prestador: ${alocs[0].prestador_id} (esperado: ${PREST_ID})`);
      console.log(`Placa: ${alocs[0].placa}`);
      console.log(`Tipo: ${alocs[0].tipo_veiculo}`);
      console.log(`OS vinculada: ${alocs[0].ordem_servico_id}`);
      console.log(`Tenant: ${alocs[0].tenant_id}`);
      console.log(`Total: ${alocs.length}`);

      expect(alocs[0].prestador_id).toBe(PREST_ID);
      expect(alocs[0].aceite_prestador).toBe(false);
      expect(alocs[0].data_aceite).toBeNull();
      expect(alocs.length).toBe(1);
      expect(alocs[0].ordem_servico_id).toBe(OS1_ID);
    } else {
      throw new Error("Nenhuma alocacao criada!");
    }
    await saveJson(alocs, "resultado-supabase-os1.json");
  });

  test("Idempotencia: salvar novamente sem duplicar", async ({ page }) => {
    expect(aloc1Id).toBeTruthy();
    await login(page);
    await abrirOSEHParaEdicao(page, OS1_NUM);
    await page.locator('button:has-text("5. Torre")').first().click();
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Salvar OS")').first().click({ timeout: 20000 });
    await page.waitForTimeout(6000);

    const { data: alocs } = await supabase.from("alocacoes_escala").select("id").eq("ordem_servico_id", OS1_ID);
    console.log(`Alocacoes apos 2o save: ${alocs?.length || 0}`);
    expect(alocs?.length).toBe(1);
    if (alocs && alocs[0]) expect(alocs[0].id).toBe(aloc1Id);
    await saveJson(alocs, "validacao-duplicidade.json");
  });

  test("OS2: Segunda operacao independente", async ({ page }) => {
    await login(page);
    await abrirOSEHParaEdicao(page, OS2_NUM);
    await preencherDadosAlocacao(page);

    const { data: alocs } = await supabase.from("alocacoes_escala").select("*").eq("ordem_servico_id", OS2_ID);
    if (alocs && alocs.length > 0) {
      aloc2Id = alocs[0].id;
      console.log(`\n=== ALOCACAO OS2 ===`);
      console.log(`ID: ${aloc2Id}`);
      console.log(`Status: ${alocs[0].status}`);
      console.log(`Aceite: ${alocs[0].aceite_prestador}`);
      console.log(`Prestador: ${alocs[0].prestador_id}`);
      console.log(`OS vinculada: ${alocs[0].ordem_servico_id}`);
      console.log(`Total: ${alocs.length}`);

      expect(alocs[0].prestador_id).toBe(PREST_ID);
      expect(alocs[0].aceite_prestador).toBe(false);
      expect(alocs[0].ordem_servico_id).toBe(OS2_ID);
      expect(alocs.length).toBe(1);
      expect(aloc2Id).not.toBe(aloc1Id);
    } else {
      throw new Error("Nenhuma alocacao criada para OS2!");
    }
    await saveJson(alocs, "resultado-supabase-os2.json");
  });

  test("Validacao final: ambas OSHs prontas para App", async () => {
    const { data: alocs1 } = await supabase.from("alocacoes_escala").select("*").eq("ordem_servico_id", OS1_ID);
    const { data: alocs2 } = await supabase.from("alocacoes_escala").select("*").eq("ordem_servico_id", OS2_ID);

    console.log(`\nOS1 alocacoes: ${alocs1?.length} (esperado: 1)`);
    console.log(`OS2 alocacoes: ${alocs2?.length} (esperado: 1)`);

    const a1 = alocs1?.[0];
    const a2 = alocs2?.[0];

    const checks = {
      "OS1 unica alocacao": alocs1?.length === 1,
      "OS2 unica alocacao": alocs2?.length === 1,
      "OS1 prestador correto": a1?.prestador_id === PREST_ID,
      "OS2 prestador correto": a2?.prestador_id === PREST_ID,
      "OS1 aceite pendente": a1?.aceite_prestador === false,
      "OS2 aceite pendente": a2?.aceite_prestador === false,
      "OS1 data aceite nula": a1?.data_aceite === null,
      "OS2 data aceite nula": a2?.data_aceite === null,
      "OS1 status valido": ["planejada", "aguardando_aceite"].includes(a1?.status),
      "OS2 status valido": ["planejada", "aguardando_aceite"].includes(a2?.status),
      "OS1 IDs diferentes": aloc1Id !== aloc2Id,
      "Ambas tem tenant": !!a1?.tenant_id && !!a2?.tenant_id,
    };
    for (const [k, v] of Object.entries(checks)) console.log(`${v ? "PASS" : "FAIL"} | ${k}`);
    const allPass = Object.values(checks).every(Boolean);
    console.log(`\nPronto para App Motorista: ${allPass ? "SIM" : "NAO"}`);
    expect(allPass).toBe(true);
  });
});
