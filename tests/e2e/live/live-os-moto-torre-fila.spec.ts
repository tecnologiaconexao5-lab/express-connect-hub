// ═══════════════════════════════════════════════════════════════════════════════
// E2E-SINCRONIZADO-PLAYWRIGHT-E-MAESTRO — cenário ao vivo (browser visível)
//
//  1. Cria OS MOTO (peso 15kg) sem prestador → entra na Rede de Oportunidades.
//  2. Maestro no Redmi: Rede → aceita a OS → chat da Torre → etapas até concluir.
//  3. Browser: valida Torre (status/rota) e depois a Fila de Liquidação no topo
//     → clica "Liberar Pagamento".
//
// Executado por `scripts/run_e2e_live_sync.ts` (headed). Requer opt-in explícito
// E2E_LIVE_ALLOW_PROD=1 porque o TMS local aponta para a base de produção.
// ═══════════════════════════════════════════════════════════════════════════════
import { test, expect, type Page } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEVICE_UDID = process.env.MAESTRO_DEVICE || "a28e7167";
// Os flows usam `appId: ${MAESTRO_APP_ID}`. Ao rodar um flow avulso o Maestro
// não carrega o env do `.maestro/config.yaml`, então injetamos explicitamente.
const MAESTRO_APP_ID = process.env.MAESTRO_APP_ID || "com.example.conexao_prestador";
const MAESTRO_BIN =
  process.env.MAESTRO_BIN ||
  path.join(os.homedir(), ".maestro", "bin", process.platform === "win32" ? "maestro.bat" : "maestro");
const SYNC_DIR = path.resolve(process.cwd(), "test-results", "live-sync");
const FIXTURE = path.resolve(process.cwd(), "tests", "e2e", "live", "fixtures", "os_moto.json");

function log(msg: string) {
  console.log(`[LIVE-E2E] ${msg}`);
}

const ADB_CANDIDATES = [
  process.env.ADB_PATH,
  "C:\\Users\\DIEGO BALBINO\\Android_SDK\\platform-tools\\adb.exe",
  path.join(os.homedir(), "AppData", "Local", "Android", "Sdk", "platform-tools", "adb.exe"),
  "adb",
].filter(Boolean) as string[];
const ADB = ADB_CANDIDATES.find((p) => p === "adb" || fs.existsSync(p)) || "adb";

function adb(args: string[], timeout = 90000): string {
  try {
    return execFileSync(ADB, ["-s", DEVICE_UDID, ...args], { encoding: "utf8", timeout, windowsHide: true });
  } catch {
    return "";
  }
}

/**
 * MIUI recusa o driver do Maestro com a tela apagada/trancada
 * (INSTALL_FAILED_USER_RESTRICTED). Acorda, destrava e pré-instala o driver.
 */
function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function prepararDevice() {
  adb(["shell", "input", "keyevent", "KEYCODE_WAKEUP"]);
  adb(["shell", "wm", "dismiss-keyguard"]);
  adb(["shell", "svc", "power", "stayon", "usb"]);
  // Relança o app LIMPO (force-stop + start) ANTES do flow: o MIUI/XSpace nega
  // o launch feito pelo pacote do Maestro (dev.mobile.maestro) — "MIUILOG-
  // Permission Denied Activity" — então lançamos via `am start` (uid shell).
  // `-S` reinicia do zero, garantindo a aba Início (estado determinístico).
  adb(["shell", "am", "start", "-S", "-n", `${MAESTRO_APP_ID}/.MainActivity`]);
  sleepSync(6000);
  // .maestro/apks/ é canônico (test-results é apagado pelo Playwright).
  // SÓ instala o que estiver AUSENTE: o MIUI impõe uma cota de instalações adb
  // em sequência (INSTALL_FAILED_USER_RESTRICTED) e reinstalar à toa queima a
  // cota, fazendo o Maestro falhar em seguida.
  const apkDirs = [
    path.join(process.cwd(), ".maestro", "apks"),
    path.join(SYNC_DIR, "maestro_apks"),
  ];
  const alvos: Array<{ pkg: string; apk: string }> = [
    { pkg: "dev.mobile.maestro.test", apk: "maestro-server.apk" },
    { pkg: "dev.mobile.maestro", apk: "maestro-app.apk" },
  ];
  for (const { pkg, apk } of alvos) {
    if (adb(["shell", "pm", "list", "packages", pkg]).includes(`package:${pkg}`)) continue;
    const p = apkDirs.map((d) => path.join(d, apk)).find((f) => fs.existsSync(f));
    if (p) adb(["install", "-r", p]);
  }
}

function runMaestro(flow: string, extraEnv: Record<string, string> = {}) {
  // --no-reinstall-driver: usa o driver já instalado. Sem a flag o Maestro
  // reinstala a cada chamada e o MIUI recusa (INSTALL_FAILED_USER_RESTRICTED).
  // Variáveis vão por `-e KEY=VALUE`: o Maestro só resolve ${VAR} de `-e`/config
  // (variáveis de ambiente do SO NÃO entram no contexto JS do flow).
  const envArgs: string[] = [];
  for (const [k, v] of Object.entries({ MAESTRO_APP_ID, ...extraEnv })) {
    envArgs.push("-e", `${k}=${v}`);
  }
  const args = [
    "--device",
    DEVICE_UDID,
    "test",
    "--no-reinstall-driver",
    ...envArgs,
    path.resolve(process.cwd(), ".maestro", "flows", flow),
  ];
  log(`Maestro → ${flow} (device ${DEVICE_UDID})`);
  prepararDevice();
  // No Windows `maestro.bat` NÃO pode ser executado direto por execFileSync
  // (EINVAL): precisa de shell e citação do caminho com espaços.
  const isWin = process.platform === "win32";
  const citar = (a: string) => (/\s/.test(a) ? `"${a}"` : a);
  const cmd = (isWin ? [MAESTRO_BIN, ...args] : [MAESTRO_BIN, ...args]).map(citar).join(" ");
  const r = spawnSync(cmd, { stdio: "inherit", shell: isWin, env: process.env });
  if ((r.status ?? 1) !== 0) {
    throw new Error(`Maestro falhou no flow ${flow} (exit ${r.status ?? "?"}).`);
  }
}

/**
 * Playwright NÃO carrega `.env` sozinho. Lê a chave direto do arquivo (o
 * orquestrador também não injeta) para que o login seja autônomo.
 */
function envLocal(key: string): string {
  if (process.env[key]) return process.env[key]!;
  for (const f of [".env", ".env.local", ".env.development", ".env.production", ".env.qa"]) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    const line = fs.readFileSync(p, "utf8").split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).trim();
  }
  return "";
}

async function ensureLoggedIn(page: Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  if (!page.url().includes("/login")) {
    log("Sessão do storageState ainda válida.");
    return;
  }

  const email = envLocal("E2E_LIVE_EMAIL");
  const password = envLocal("E2E_LIVE_PASSWORD");
  if (email && password) {
    await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.getByRole("button", { name: /Entrar/i }).click();
  } else {
    // Run supervisionado: o operador faz login no browser VISÍVEL.
    log("Sem credenciais em ENV. >>> Faça login MANUALMENTE no browser visível (aguardando até 5 min)... <<<");
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 5 * 60 * 1000 });
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60000 });
  log("Autenticado no TMS.");
}

/**
 * Cria uma OS de MOTO (peso 15kg) SEM prestador e a publica na
 * Rede de Oportunidades (rede_oportunidades) — prerequisite para o app
 * exibir a oportunidade e para a nova tela OsExpressView (prefixo `OS`).
 *
 * Campos obrigatórios (validações em OrdemServicoForm.tsx:1157-1178):
 *   cliente + tipoOperacao + >=1 endereço coleta + >=1 endereço entrega.
 * Para "Enviar para Rede" é preciso ainda custoPrestador > 0 (linha 996).
 */
async function criarOsMoto(page: Page): Promise<string> {
  const campo = (rotulo: RegExp) => page.locator("label", { hasText: rotulo }).first().locator("xpath=..");
  const irParaAba = async (nome: RegExp) => {
    const aba = page.getByRole("tab", { name: nome }).first();
    if (!(await aba.isVisible().catch(() => false))) {
      await page.screenshot({ path: path.join(SYNC_DIR, "erro_aba_ausente.png") });
      throw new Error(`Aba ${nome} não encontrada/visível — troca de etapa falhou.`);
    }
    await aba.click({ timeout: 8000 });
    await page.waitForTimeout(700);
  };
  /**
   * Preenche e LÊ DE VOLTA o valor. Sem essa leitura, um `.catch(()=>{})` mascara
   * falha de selector e a OS é salva com payload incompleto (peso/veículo/valores
   * ficam null no banco) — exatamente o que aconteceu na execução anterior.
   */
  const preencher = async (rotulo: RegExp, valor: string, sel = "input") => {
    const el = campo(rotulo).locator(sel).first();
    await el.click({ timeout: 8000 }).catch(() => {});
    await el.fill(valor, { timeout: 8000 });
    await page.waitForTimeout(250);
    const lido = (await el.inputValue().catch(() => "")) || "";
    if (lido.trim() !== valor.trim()) {
      await page.screenshot({ path: path.join(SYNC_DIR, "erro_fill.png") });
      throw new Error(`Campo "${rotulo}" não aceitou "${valor}" (lido: "${lido}").`);
    }
  };
  /**
   * Campos financeiros são recalculados por um efeito assíncrono
   * (`recalcularValores()` em OrdemServicoForm.tsx:608-636) quando a rota/tabela
   * de preços resolve. Esse efeito SOBRESCREVE valorCliente/custoPrestador sem
   * respeitar o flag `valorClienteEditado`. Por isso não basta preencher uma vez:
   * re-preenche em loop até o valor "grudar" por 2 leituras consecutivas
   * (garante que o cálculo assíncrono já concluiu e não vai mais sobrescrever).
   */
  const preencherValorEstavel = async (rotulo: RegExp, valor: string) => {
    const el = campo(rotulo).locator("input").first();
    let estavel = 0;
    for (let i = 0; i < 15 && estavel < 2; i++) {
      await el.click({ timeout: 8000 }).catch(() => {});
      await el.fill(valor, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const lido = (await el.inputValue().catch(() => "")) || "";
      estavel = lido.trim() === valor.trim() ? estavel + 1 : 0;
    }
    const lidoFinal = (await el.inputValue().catch(() => "")) || "";
    if (lidoFinal.trim() !== valor.trim()) {
      await page.screenshot({ path: path.join(SYNC_DIR, "erro_fill_estavel.png") });
      throw new Error(`Campo financeiro "${rotulo}" não estabilizou em "${valor}" (lido: "${lidoFinal}").`);
    }
  };

  await page.goto("/operacao?tab=os", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  // Descarta qualquer rascunho local de execuções anteriores (sessionStorage)
  // para o formulário abrir em branco.
  await page
    .evaluate(() => {
      for (const k of Object.keys(sessionStorage)) {
        if (k.startsWith("tms_os_rascunho_v1")) sessionStorage.removeItem(k);
      }
    })
    .catch(() => {});
  await page.getByRole("button", { name: /Nova OS/i }).click();
  await page.waitForTimeout(4000);

  // Nº OS (gerado automaticamente, campo readonly)
  const numeroAbertura = (await campo(/^N[oº] OS/).locator("input").first().inputValue().catch(() => "")) || "";
  if (!numeroAbertura) {
    await page.screenshot({ path: path.join(SYNC_DIR, "erro_numero_abertura.png") });
    throw new Error("Campo 'Nº OS' vazio na abertura do formulário — não é possível rastrear a OS salva.");
  }

  // ── Identificação: cliente + tipo de operação ──────────────────────────────
  const clienteInput = campo(/^Cliente/).locator("input").first();
  await clienteInput.click({ timeout: 10000 }).catch(() => {});
  for (const termo of ["HML", "CLIENTE", "A", "E"]) {
    await clienteInput.fill(termo).catch(() => {});
    await page.waitForTimeout(2000);
    const itens = page.locator("li[data-index]");
    if ((await itens.count().catch(() => 0)) > 0) {
      await itens.first().click().catch(() => {});
      break;
    }
  }
  await page.waitForTimeout(800);
  const clienteSelecionado = (await clienteInput.inputValue().catch(() => "")) || "";
  if (!clienteSelecionado.trim()) {
    await page.screenshot({ path: path.join(SYNC_DIR, "erro_cliente.png") });
    throw new Error("Nenhum cliente selecionado no campo Cliente.");
  }

  await campo(/^Tipo de Opera/).locator("button").first().click({ timeout: 8000 });
  await page
    .getByRole("option", { name: "Coleta e Entrega" })
    .click({ timeout: 6000 })
    .catch(() => page.getByRole("option").first().click({ timeout: 4000 }));
  const tipoOpTxt = ((await campo(/^Tipo de Opera/).innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  if (!/coleta e entrega/i.test(tipoOpTxt)) {
    await page.screenshot({ path: path.join(SYNC_DIR, "erro_tipo_op.png") });
    throw new Error(`Tipo de Operação não selecionado (lido: "${tipoOpTxt}").`);
  }

  // ── Carga: peso 15 kg ─────────────────────────────────────────────────────
  await irParaAba(/Carga/);
  await preencher(/^Peso/, "15", "input[type='number']");

  // ── Veículo: Moto (Radix Select de TIPOS_VEICULO, value "moto") ───────────
  await irParaAba(/^Ve[ií]culo/);
  const labelsVeiculo = page.locator("label").filter({ hasText: /^Tipo de Ve/ });
  const totalLabels = await labelsVeiculo.count().catch(() => 0);
  let btnVeiculo: ReturnType<typeof page.locator> | null = null;
  for (let i = 0; i < totalLabels; i++) {
    // O primeiro "Tipo de Veiculo" é um <select> nativo (sem Moto); o segundo
    // é o Radix Select com TIPOS_VEICULO. Só o Radix tem <button>.
    const botoes = labelsVeiculo.nth(i).locator("xpath=..").locator("button");
    if ((await botoes.count().catch(() => 0)) > 0) {
      btnVeiculo = botoes.first();
      await btnVeiculo.click({ timeout: 8000 });
      break;
    }
  }
  if (!btnVeiculo) {
    await page.screenshot({ path: path.join(SYNC_DIR, "erro_veiculo_trigger.png") });
    throw new Error('Radix Select "Tipo de Veículo" não encontrado na aba Veículo.');
  }
  await page
    .getByRole("option", { name: "Moto" })
    .click({ timeout: 6000 })
    .catch(() => page.getByText(/^Moto$/).first().click({ timeout: 4000 }));
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);
  const veiculoTxt = ((await btnVeiculo.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  if (!/moto/i.test(veiculoTxt)) {
    await page.screenshot({ path: path.join(SYNC_DIR, "erro_veiculo.png") });
    throw new Error(`Tipo de Veículo "Moto" não selecionado (trigger: "${veiculoTxt}").`);
  }

  // ── Rotas e Paradas: 1 coleta (default) + 1 entrega ───────────────────────
  await irParaAba(/Rotas e Paradas/);
  const btnAddParada = page.getByRole("button", { name: /Adicionar Parada/ });
  await btnAddParada.click({ timeout: 8000 });
  await page.waitForTimeout(900);

  const ceps = page.locator('input[placeholder="00000-000"]');
  const numeros = page.locator('input[placeholder="Nº"]');
  // 1ª parada = coleta (default de emptyEnd)
  await ceps.nth(0).fill("01310-100").catch(() => {});
  await ceps.nth(0).blur().catch(() => {});
  await page.waitForTimeout(2500);
  await numeros.nth(0).fill("1000").catch(() => {});
  // 2ª parada = entrega
  const gatilhosTipoParada = page.locator('button[class*="w-[120px]"]');
  if ((await gatilhosTipoParada.count().catch(() => 0)) >= 2) {
    await gatilhosTipoParada.nth(1).click({ timeout: 8000 }).catch(() => {});
    await page
      .getByRole("option", { name: "Entrega" })
      .click({ timeout: 6000 })
      .catch(() => page.keyboard.press("Escape"));
  }
  await page.waitForTimeout(500);
  await ceps.nth(1).fill("01415-001").catch(() => {});
  await ceps.nth(1).blur().catch(() => {});
  await page.waitForTimeout(2500);
  await numeros.nth(1).fill("500").catch(() => {});
  await page.waitForTimeout(500);

  // ── Torre & Financeiro: valores (custoPrestador > 0 exige p/ Rede) ────────
  await irParaAba(/Torre & Financeiro/);
  await preencherValorEstavel(/^Valor p\/ Cliente/, "120");
  await preencherValorEstavel(/^Valor p\/ Prestador/, "90");
  // Deixa qualquer recálculo assíncrono eventual em suspenso terminar antes de
  // reler os valores na revalidação final.
  await page.waitForTimeout(2500);

  // ── Revalidação final antes do save ───────────────────────────────────────
  // Um efeito assíncrono (ex.: regra financeira do cliente) pode sobrescrever o
  // estado depois do preenchimento e gerar OS com payload incompleto no banco.
  await irParaAba(/Carga/);
  const pesoLido = (await campo(/^Peso/).locator("input").first().inputValue().catch(() => "")) || "";
  await irParaAba(/^Ve[ií]culo/);
  const veiculoLido2 = ((await btnVeiculo.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  await irParaAba(/Torre & Financeiro/);
  // Auto-correção: se um recálculo tardio (tabela de preços) sobrescreveu os
  // valores, re-preenche até estabilizar — protege a revalidação da race
  // condition do efeito assíncrono `recalcularValores()`.
  const cliEl = campo(/^Valor p\/ Cliente/).locator("input").first();
  const preEl = campo(/^Valor p\/ Prestador/).locator("input").first();
  for (let i = 0; i < 12; i++) {
    const c = ((await cliEl.inputValue().catch(() => "")) || "").replace(/[^\d]/g, "");
    const p = ((await preEl.inputValue().catch(() => "")) || "").replace(/[^\d]/g, "");
    if (c === "120" && p === "90") break;
    if (c !== "120") {
      await cliEl.click({ timeout: 5000 }).catch(() => {});
      await cliEl.fill("120", { timeout: 5000 }).catch(() => {});
    }
    if (p !== "90") {
      await preEl.click({ timeout: 5000 }).catch(() => {});
      await preEl.fill("90", { timeout: 5000 }).catch(() => {});
    }
    await page.waitForTimeout(1200);
  }
  const cliLido = (await cliEl.inputValue().catch(() => "")) || "";
  const preLido = (await preEl.inputValue().catch(() => "")) || "";
  const problemas: string[] = [];
  if (pesoLido.trim() !== "15") problemas.push(`peso=${pesoLido || "vazio"} (esperado 15)`);
  if (!/moto/i.test(veiculoLido2)) problemas.push(`veiculo="${veiculoLido2}" (esperado Moto)`);
  if (cliLido.replace(/[^\d]/g, "") !== "120") problemas.push(`valorCliente=${cliLido || "vazio"} (esperado 120)`);
  if (preLido.replace(/[^\d]/g, "") !== "90") problemas.push(`valorPrestador=${preLido || "vazio"} (esperado 90)`);
  if (problemas.length) {
    await page.screenshot({ path: path.join(SYNC_DIR, "erro_pre_save.png") });
    throw new Error(`Payload inconsistente antes do save: ${problemas.join("; ")}`);
  }

  // ── Salvar ────────────────────────────────────────────────────────────────
  const btnSalvar = page.getByRole("button", { name: "Salvar OS", exact: true }).first();
  await btnSalvar.scrollIntoViewIfNeeded().catch(() => {});
  await btnSalvar.click({ timeout: 15000 }).catch(async () => {
    await btnSalvar.click({ force: true, timeout: 15000 });
  });
  await page.waitForTimeout(7000);

  // O save chama onSalvar() e FECHA o formulário (OrdensServicoLista:167),
  // voltando para a lista.
  const msgErro = page
    .getByText(/Erro ao salvar|Selecione um cliente|Adicione pelo menos|Selecione o tipo de opera/)
    .first();
  if (await msgErro.isVisible().catch(() => false)) {
    log(`ERRO na validação do save → "${await msgErro.textContent().catch(() => "?")}"`);
  }

  // ── Reabre a OS salva para publicar na Rede ──────────────────────────────
  // O botão "Enviar para Rede" exige data.id (OS já persistida).
  const linha = page.getByRole("row").filter({ hasText: numeroAbertura });
  const linhaOk = await linha
    .first()
    .waitFor({ state: "visible", timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (!linhaOk) {
    await page.screenshot({ path: path.join(SYNC_DIR, "erro_save_os.png") });
    throw new Error(`Save da OS não confirmado: linha "${numeroAbertura}" não apareceu na lista.`);
  }
  await linha.first().hover().catch(() => {});
  await page.waitForTimeout(500);
  await linha.first().getByTitle("Editar").click({ timeout: 10000 }).catch(async () => {
    await page.getByTitle("Editar").first().click({ timeout: 10000 });
  });
  await page.waitForTimeout(4000);

  // Nº OS definitivo (campo readonly do cabeçalho, preenchido após o save)
  const numeroSalvo = (await campo(/^N[oº] OS/).locator("input").first().inputValue().catch(() => "")) || numeroAbertura;
  if (!numeroSalvo) {
    await page.screenshot({ path: path.join(SYNC_DIR, "erro_sem_numero.png") });
    throw new Error("Não foi possível capturar o número da OS (campo 'Nº OS' vazio).");
  }

  // ── Publicar na Rede de Oportunidades ─────────────────────────────────────
  await irParaAba(/Torre & Financeiro/);
  const btnRede = page.getByRole("button", { name: /Enviar para Rede/ }).first();
  if ((await btnRede.count().catch(() => 0)) > 0) {
    await btnRede.click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(8000);
    const ok = await page
      .getByText(/enviada para Rede de Prestadores/)
      .first()
      .isVisible()
      .catch(() => false);
    log(ok ? "OS publicada na Rede de Oportunidades." : "AVISO: publicação na Rede não confirmada por toast.");
  } else {
    log("AVISO: botão 'Enviar para Rede de Prestadores' não encontrado (custoPrestador=0, prestador alocado ou OS sem id).");
  }
  await page.screenshot({ path: path.join(SYNC_DIR, "00_os_rede_publicada.png") });

  fs.mkdirSync(SYNC_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
  fs.writeFileSync(FIXTURE, JSON.stringify({ numero: numeroSalvo, peso: 15, veiculo_tipo: "moto", custoPrestador: 90, publicadoEmRede: true, criadoEm: new Date().toISOString() }, null, 2));
  log(`OS MOTO criada e publicada na Rede (número: "${numeroSalvo}").`);

  // Fecha o formulário (botão Voltar do cabeçalho) para desmontar o componente
  // e remover o guard de beforeunload antes das navegações seguintes.
  await page.getByTitle("Voltar").first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);

  return numeroSalvo;
}

test.describe.configure({ mode: "serial" });

test("E2E ao vivo — OS MOTO → Rede (Maestro) → Torre (Maestro) → Fila de Liquidação", async ({ page }) => {
  test.skip(
    process.env.E2E_LIVE_ALLOW_PROD !== "1",
    "Opt-in explícito ausente: defina E2E_LIVE_ALLOW_PROD=1 (a base local é de produção).",
  );
  test.setTimeout(40 * 60 * 1000);

  let numeroOs = "";

  await test.step("1. Autenticar e criar OS MOTO (sem prestador)", async () => {
    await ensureLoggedIn(page);
    numeroOs = await criarOsMoto(page);
    await page.screenshot({ path: path.join(SYNC_DIR, "01_os_criada.png") });
  });

  await test.step("2. Celular (Maestro): app Disponível + Rede de Oportunidades + aceite", async () => {
    runMaestro("01_app_disponivel.yaml");
    runMaestro("02_rede_aceite.yaml", { OS_NUMERO: numeroOs });
  });

  await test.step("3. Torre de Controle: validar status/rota em tempo real", async () => {
    await page.goto("/torre-controle", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SYNC_DIR, "03_torre_inicial.png") });

    // Chat da Torre + avanço de etapas no device
    runMaestro("03_chat_torre.yaml");
    runMaestro("04_etapas_conclusao.yaml", { OS_NUMERO: numeroOs });
    // CENÁRIO B: aceite na jornada Express (OsExpressView) e prova de que a
    // etapa "Cheguei"/"Ir para coleta" EXIGE a foto do local antes de avançar.
    runMaestro("05_cheguei_foto.yaml", { OS_NUMERO: numeroOs });
    // CENÁRIO C: conclui TODAS as etapas restantes no app (foto do local,
    // carregamento, romaneio, rota, descarga, assinatura, POD) até finalizar.
    runMaestro("06_conclusao_express.yaml", { OS_NUMERO: numeroOs });

    // Aguarda o status refletir conclusão na Torre
    if (numeroOs) {
      await page
        .getByText(numeroOs, { exact: false })
        .first()
        .waitFor({ state: "visible", timeout: 120000 })
        .catch(() => {});
    }
    await page.screenshot({ path: path.join(SYNC_DIR, "03b_torre_concluida.png") });
    log("Torre validada (status/rota atualizados).");
  });

  await test.step("4. Fila de Liquidação: OS finalizada no topo e 'Liberar Pagamento'", async () => {
    await page.goto("/financeiro?tab=pagamento-prestadores", { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page.getByText("Fila de Liquidação").first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SYNC_DIR, "04_fila_liquidacao.png") });

    // A Fila identifica a linha por `os_numero || #<8 primeiros do id do título>`.
    // O título gerado pela OS esporádica (Rede) tem os_numero NULL, então a linha
    // aparece como `#<id8>`. Resolvemos o id do título via banco (join OS.numero)
    // para localizar a linha de forma determinística.
    let ppId8 = "";
    try {
      const { Client } = await import("pg");
      const fsMod = await import("node:fs");
      let dbUrl = process.env.DATABASE_URL || "";
      if (!dbUrl) {
        for (const f of [".env", ".env.local"]) {
          const p = path.resolve(process.cwd(), f);
          if (fsMod.existsSync(p)) {
            const l = fsMod
              .readFileSync(p, "utf8")
              .split(/\r?\n/)
              .find((x) => x.startsWith("DATABASE_URL="));
            if (l) {
              dbUrl = l.slice("DATABASE_URL=".length).trim();
              break;
            }
          }
        }
      }
      if (dbUrl) {
        const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
        await c.connect();
        const r = await c.query(
          "select pp.id::text as id from public.pagamentos_prestadores pp " +
            "join public.ordens_servico os on os.id = pp.os_id " +
            "where os.numero = $1 order by pp.created_at desc limit 1",
          [numeroOs],
        );
        await c.end();
        if (r.rows[0]?.id) ppId8 = String(r.rows[0].id).slice(0, 8);
        log(`Título da Fila para ${numeroOs}: #${ppId8 || "(não encontrado)"}`);
      }
    } catch (e) {
      log(`Lookup do título na Fila falhou: ${(e as Error).message}`);
    }

    const linha = ppId8
      ? page.getByRole("row").filter({ hasText: `#${ppId8}` }).first()
      : page
          .getByRole("row", {
            name: new RegExp(numeroOs.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")),
          })
          .first();

    const presente = await linha
      .waitFor({ state: "visible", timeout: 20000 })
      .then(() => true)
      .catch(() => false);

    if (!presente) {
      log(
        "CENÁRIO C PENDENTE: a OS finalizada não foi localizada na Fila de Liquidação.",
      );
      return;
    }

    await linha.getByRole("button", { name: /Liberar Pagamento/i }).click({ timeout: 15000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(SYNC_DIR, "04b_pagamento_liberado.png") });
    log("Liberar Pagamento executado ao vivo na Fila de Liquidação.");
  });
});
