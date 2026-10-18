/* eslint-disable no-console */
// ═══════════════════════════════════════════════════════════════════════════════
// E2E-SINCRONIZADO-PLAYWRIGHT-E-MAESTRO — Orquestrador
//
// Executa o cenário ao vivo ponta a ponta:
//   Browser visível (Playwright headed)  ⇄  Celular físico (Maestro / Redmi)
//
// Uso:
//   npx tsx scripts/run_e2e_live_sync.ts --check                # só verificação
//   npx tsx scripts/run_e2e_live_sync.ts --allow-prod           # executa (opt-in)
//   npx tsx scripts/run_e2e_live_sync.ts --device=a28e7167 --base=http://localhost:8800
//
// Pré-requisitos: TMS rodando (:8800), Maestro instalado, Redmi conectado com
// "Instalação via USB" habilitada (MIUI) e app do prestador instalado.
// ═══════════════════════════════════════════════════════════════════════════════
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const PROD_REF = "uwrvzsjtpgaifkktpepn";
const QA_REF = "aqpfayildtcnrkfeeyjg";

type Check = { nome: string; ok: boolean; blocking: boolean; detalhe: string };

function arg(name: string, def?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : def;
}
const FLAG = (name: string) => process.argv.includes(`--${name}`);

const BASE_URL = arg("base", process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8800")!;
const DEVICE = arg("device", process.env.MAESTRO_DEVICE || "a28e7167")!;
const MAESTRO =
  process.env.MAESTRO_BIN ||
  path.join(os.homedir(), ".maestro", "bin", process.platform === "win32" ? "maestro.bat" : "maestro");
const CHECK_ONLY = FLAG("check");
const ALLOW_PROD = FLAG("allow-prod");

function readEnv(key: string): string {
  for (const f of [".env", ".env.local", ".env.development", ".env.qa"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const line = fs.readFileSync(p, "utf8").split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).trim();
  }
  return "";
}

function run(cmd: string, args: string[], timeout = 45000) {
  const isWin = process.platform === "win32";
  // .bat (maestro.bat) exige shell no Windows; cita o caminho com espaços.
  const shellCmd = isWin && /\s/.test(cmd) ? `"${cmd}"` : cmd;
  return spawnSync(shellCmd, args, { encoding: "utf8", timeout, windowsHide: true, shell: isWin });
}

// adb não está no PATH desta máquina — procura em locais conhecidos.
const ADB_CANDIDATES = [
  process.env.ADB_PATH,
  "C:\\Users\\DIEGO BALBINO\\Android_SDK\\platform-tools\\adb.exe",
  path.join(os.homedir(), "AppData", "Local", "Android", "Sdk", "platform-tools", "adb.exe"),
  "adb",
].filter(Boolean) as string[];
const ADB = ADB_CANDIDATES.find((p) => p === "adb" || fs.existsSync(p)) || "adb";

/**
 * MIUI/HyperOS recusa instalar o driver do Maestro enquanto a tela está
 * apagada/trancada (INSTALL_FAILED_USER_RESTRICTED). Acorda + destrava o
 * device e mantém a tela acesa via USB antes de qualquer invocação.
 */
function wakeDevice(timeout = 20000): boolean {
  const cmd: Array<[string, string[]]> = [
    [ADB, ["-s", DEVICE, "shell", "input", "keyevent", "KEYCODE_WAKEUP"]],
    [ADB, ["-s", DEVICE, "shell", "wm", "dismiss-keyguard"]],
    [ADB, ["-s", DEVICE, "shell", "svc", "power", "stayon", "usb"]],
    [ADB, ["-s", DEVICE, "shell", "settings", "put", "system", "screen_off_timeout", "1800000"]],
  ];
  for (const [c, a] of cmd) {
    const r = run(c, a, timeout);
    if (r.status !== 0 && c !== "adb") return false;
  }
  return true;
}

async function checkServer(): Promise<Check> {
  try {
    const res = await fetch(BASE_URL, { method: "GET" });
    return { nome: "Servidor TMS", ok: res.ok, blocking: true, detalhe: `${BASE_URL} → HTTP ${res.status}` };
  } catch (e: any) {
    return { nome: "Servidor TMS", ok: false, blocking: true, detalhe: `${BASE_URL} inacessível (${e?.message})` };
  }
}

function checkPlaywright(): Check {
  const dir = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  const hasChromium =
    fs.existsSync(dir) && fs.readdirSync(dir).some((n) => /^chromium-\d+/.test(n));
  const v = run("npx", ["playwright", "--version"]);
  return {
    nome: "Playwright (chromium headed)",
    ok: hasChromium,
    blocking: true,
    detalhe: hasChromium ? `${(v.stdout || "").trim()} • chromium instalado` : "chromium ausente — rode: npx playwright install chromium",
  };
}

function checkMaestro(): Check {
  const v = run(MAESTRO, ["--version"]);
  const out = `${v.stdout || ""}${v.stderr || ""}`.trim();
  return { nome: "Maestro CLI", ok: v.status === 0, blocking: true, detalhe: out.split(/\r?\n/)[0] || "maestro não encontrado" };
}

function pkgInstalled(pkg: string): boolean {
  const r = run(ADB, ["-s", DEVICE, "shell", "pm", "list", "packages", pkg], 30000);
  return `${r.stdout || ""}`.includes(`package:${pkg}`);
}

function checkDevice(): Check {
  // 1) Acorda/destrava o Redmi: MIUI recusa instalar driver com tela apagada.
  wakeDevice();

  // 2) Driver do Maestro = 2 APKs (nomes de pacote reais abaixo). O MIUI
  //    (INSTALL_FAILED_USER_RESTRICTED) impõe uma "cota" de instalações adb
  //    em sequência, então SÓ instala o que estiver AUSENTE — reinstalar à toa
  //    queima a cota e faz o Maestro falhar em seguida.
  //    .maestro/apks/ é canônico (não é apagado pelo Playwright a cada run).
  const apkDirs = [
    path.join(ROOT, ".maestro", "apks"),
    path.join(ROOT, "test-results", "live-sync", "maestro_apks"),
  ];
  const apkDe = (f: string) => apkDirs.map((d) => path.join(d, f)).find((p) => fs.existsSync(p));
  const alvos: Array<{ pkg: string; apk: string }> = [
    { pkg: "dev.mobile.maestro.test", apk: "maestro-server.apk" },
    { pkg: "dev.mobile.maestro", apk: "maestro-app.apk" },
  ];
  const driver: string[] = [];
  for (const { pkg, apk } of alvos) {
    if (pkgInstalled(pkg)) {
      driver.push(`${pkg}(já instalado)`);
      continue;
    }
    const p = apkDe(apk);
    if (!p) {
      driver.push(`${pkg}(apk ausente)`);
      continue;
    }
    const r = run(ADB, ["-s", DEVICE, "install", "-r", p], 120000);
    driver.push(`${pkg}${`${r.stdout || ""}`.includes("Success") ? "(instalado)" : "(falhou)"}`);
  }

  // 3) --no-reinstall-driver é OBRIGATÓRIO aqui: sem a flag o Maestro tenta
  //    reinstalar o driver a cada chamada e o MIUI recusa com
  //    INSTALL_FAILED_USER_RESTRICTED, mesmo com o driver já instalado.
  const attempt = () => run(MAESTRO, ["--device", DEVICE, "hierarchy", "--no-reinstall-driver"], 60000);
  let r = attempt();
  let out = `${r.stdout || ""}${r.stderr || ""}`;

  // 4) Retry com nova acordada caso o driver ainda tenha sido recusado.
  if (out.includes("INSTALL_FAILED_USER_RESTRICTED")) {
    wakeDevice();
    r = attempt();
    out = `${r.stdout || ""}${r.stderr || ""}`;
  }

  if (out.includes("INSTALL_FAILED_USER_RESTRICTED")) {
    return {
      nome: "Dispositivo (Redmi)",
      ok: false,
      blocking: true,
      detalhe: `${DEVICE} conectado, porém o driver Maestro foi RECUSADO (INSTALL_FAILED_USER_RESTRICTED) com a tela acordada. Desbloqueie o Redmi manualmente e mantenha a tela ligada.`,
    };
  }
  if (r.status === 0) {
    const drv = driver.length ? ` • driver: ${driver.join(", ")}` : "";
    return { nome: "Dispositivo (Redmi)", ok: true, blocking: true, detalhe: `${DEVICE} pronto (driver Maestro OK${drv})` };
  }
  return { nome: "Dispositivo (Redmi)", ok: false, blocking: true, detalhe: `${DEVICE} indisponível: ${out.split(/\r?\n/)[0] || "sem resposta"}` };
}

function checkFlows(): Check {
  const dir = path.join(ROOT, ".maestro", "flows");
  const flows = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".yaml")) : [];
  return { nome: "Fluxos Maestro", ok: flows.length >= 4, blocking: false, detalhe: `${flows.length} flow(s): ${flows.join(", ") || "nenhum"}` };
}

function checkAmbiente(): Check {
  const url = process.env.VITE_SUPABASE_URL || readEnv("VITE_SUPABASE_URL");
  const ref = url.includes(QA_REF) ? QA_REF : url.includes(PROD_REF) ? PROD_REF : "?";
  const prod = ref === PROD_REF;
  return {
    nome: "Ambiente de dados",
    ok: !prod || ALLOW_PROD,
    blocking: true,
    detalhe: prod
      ? `PRODUÇÃO (${ref}) — ${ALLOW_PROD ? "override autorizado (--allow-prod)" : "BLOQUEADO. Use QA ou passe --allow-prod"}.`
      : `QA/desconhecido (${ref}) — seguro.`,
  };
}

function printReport(checks: Check[]) {
  console.log("\n" + "═".repeat(74));
  console.log("  E2E AO VIVO (Playwright headed + Maestro) — PRONTIDÃO");
  console.log("═".repeat(74));
  for (const c of checks) {
    const tag = c.ok ? "OK " : c.blocking ? "BLOCK" : "WARN ";
    console.log(`  [${tag}] ${c.nome.padEnd(28)} ${c.detalhe}`);
  }
  console.log("═".repeat(74));
  const blockers = checks.filter((c) => !c.ok && c.blocking);
  const verdict = blockers.length === 0 ? "READY ✅" : `BLOCKED ❌ (${blockers.length} bloqueio(s))`;
  console.log(`  VEREDITO: ${verdict}`);
  console.log("═".repeat(74) + "\n");
  return blockers;
}

async function main() {
  const checks = [await checkServer(), checkPlaywright(), checkMaestro(), checkDevice(), checkFlows(), checkAmbiente()];
  const blockers = printReport(checks);

  if (CHECK_ONLY) {
    process.exit(blockers.length === 0 ? 0 : 2);
  }
  if (blockers.length > 0) {
    console.log("Execução abortada: resolva os bloqueios acima (ou rode com --check).\n");
    process.exit(2);
  }

  console.log("▶ Iniciando Playwright HEADED (browser visível) + Maestro no dispositivo...\n");
  const args = ["playwright", "test", "tests/e2e/live", "--config", "playwright.live.config.ts", "--headed", "--workers=1"];
  const res = spawnSync("npx", args, {
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: BASE_URL,
      MAESTRO_DEVICE: DEVICE,
      MAESTRO_BIN: MAESTRO,
      E2E_LIVE_ALLOW_PROD: ALLOW_PROD ? "1" : "",
    },
    shell: process.platform === "win32",
  });
  process.exit(res.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
