import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DEV = process.env.DEV || "a28e7167";
const MAESTRO = process.env.MAESTRO_BIN || path.join(os.homedir(), ".maestro", "bin", "maestro.bat");
const ADB = [process.env.ADB_PATH, "C:\\Users\\DIEGO BALBINO\\Android_SDK\\platform-tools\\adb.exe", "adb"].find((p) => p === "adb" || (p && existsSync(p))) || "adb";
const MAX = Number(process.env.MAX || 25);

const adb = (a) => execFileSync(ADB, ["-s", DEV, ...a], { encoding: "utf8", windowsHide: true });
function hier() {
  const q = (a) => (/\s/.test(a) ? `"${a}"` : a);
  const cmd = [MAESTRO, "--device", DEV, "hierarchy", "--no-reinstall-driver"].map(q).join(" ");
  const r = spawnSync(cmd, { encoding: "utf8", windowsHide: true, shell: true, timeout: 120000 });
  if ((r.status ?? 1) !== 0) return JSON.parse("{}");
  return JSON.parse((r.stdout || "").replace(/^\uFEFF/, ""));
}
function walk(n, fn) { fn(n); for (const c of n.children || []) walk(c, fn); }
function center(b) { const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(b || ""); return m ? { x: Math.round((+m[1] + +m[3]) / 2), y: Math.round((+m[2] + +m[4]) / 2) } : null; }
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const tap = (p) => { if (p) { adb(["shell", "input", "tap", String(p.x), String(p.y)]); sleep(2200); } };

function scan(j) {
  const out = { card: null, btn: null, confirm: null, pular: null, editar: null, abrir: null, concluido: null };
  walk(j, (n) => {
    const a = n.attributes || {};
    const t = (a.accessibilityText || a.text || "").trim();
    const m = /Passo\s+(\d+)\s+de\s+(\d+)\n([^\n]+)/.exec(t);
    if (m && !out.card) out.card = { passo: +m[1], total: +m[2], label: m[3].trim() };
    if (a.clickable === "true") {
      if (a.class?.includes("EditText") && !out.editar) out.editar = center(a.bounds);
      if (t === "Confirmar" && !out.confirm) out.confirm = center(a.bounds);
      if (t === "Pular" && !out.pular) out.pular = center(a.bounds);
      if (/^Abrir/.test(t) && !out.abrir) out.abrir = center(a.bounds);
      if (/Conclu/.test(t) && !out.concluido) out.concluido = center(a.bounds);
    }
  });
  if (out.card) walk(j, (n) => { const a = n.attributes || {}; if (a.clickable === "true" && (a.accessibilityText || "").trim() === out.card.label && !out.btn) out.btn = center(a.bounds); });
  return out;
}
function foco() { try { return adb(["shell", "dumpsys", "window"]).split("\n").find((l) => l.includes("mCurrentFocus"))?.trim() || ""; } catch { return ""; } }

// drena diálogo aberto
let s = scan(hier());
if (s.pular) { console.log("drenando: Pular"); tap(s.pular); }

for (let i = 0; i < MAX; i++) {
  s = scan(hier());
  if (!s.card) { console.log(`[${i}] sem card (fim da jornada?)`); break; }
  const lbl = s.card.label;
  console.log(`[${i}] Passo ${s.card.passo}/${s.card.total} -> "${lbl}"`);
  tap(s.btn);
  let d = scan(hier());

  if (d.abrir) {
    console.log("     -> câmera");
    tap(d.abrir);
    sleep(3000);
    // shutter + concluir (MIUI OneShotCamera)
    for (let k = 0; k < 3; k++) {
      adb(["shell", "input", "tap", "540", "2034"]); // disparador
      sleep(4000);
      const c = scan(hier());
      if (c.concluido) { tap(c.concluido); break; }
    }
    sleep(6000);
  } else if (d.editar) {
    const val = /km/i.test(lbl) ? (/(final)/i.test(lbl) ? "1200" : "1000") : "HML-E2E-0001";
    console.log(`     -> digita "${val}"`);
    tap(d.editar);
    adb(["shell", "input", "text", val]); sleep(900);
    const c = scan(hier()).confirm; tap(c);
    sleep(2500);
  } else if (d.pular && /assinatura/i.test(lbl)) {
    console.log("     -> Assinatura (desenho)");
    // desenha no canvas central
    adb(["shell", "input", "swipe", "300", "1300", "760", "1500", "400"]);
    adb(["shell", "input", "swipe", "760", "1500", "340", "1700", "400"]);
    sleep(1200);
    const c = scan(hier()).confirm; tap(c);
    sleep(2500);
  } else if (d.confirm) {
    console.log("     -> Confirmar");
    tap(d.confirm);
  } else if (d.pular) {
    console.log("     -> Pular (tentativa de avanço)");
    tap(d.pular);
    sleep(1500);
    const c2 = scan(hier()).confirm; if (c2) { tap(c2); sleep(2000); }
  } else {
    console.log("     -> (sem diálogo reconhecido)");
  }
  if (/Finalizar/i.test(lbl)) console.log("     (terminal)");
}
console.log("fim.");
