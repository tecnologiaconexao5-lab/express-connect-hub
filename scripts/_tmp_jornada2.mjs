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
  if ((r.status ?? 1) !== 0) throw new Error(`hierarchy falhou: ${r.stderr || ""}`);
  return JSON.parse((r.stdout || "").replace(/^\uFEFF/, ""));
}
function walk(n, fn) { fn(n); for (const c of n.children || []) walk(c, fn); }
function center(b) { const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(b || ""); return m ? { x: Math.round((+m[1] + +m[3]) / 2), y: Math.round((+m[2] + +m[4]) / 2) } : null; }
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function scan(j) {
  const out = { card: null, btn: null, confirm: null, pular: null, edit: null, textos: [] };
  walk(j, (n) => {
    const a = n.attributes || {};
    const t = (a.accessibilityText || a.text || "").trim();
    if (t) out.textos.push(t);
    const m = /Passo\s+(\d+)\s+de\s+(\d+)\n([^\n]+)/.exec(t);
    if (m && !out.card) out.card = { passo: +m[1], total: +m[2], label: m[3].trim() };
    if (a.clickable === "true") {
      if (a.class?.includes("EditText") && !out.edit) out.edit = center(a.bounds);
      if (t === "Confirmar" && !out.confirm) out.confirm = center(a.bounds);
      if (t === "Pular" && !out.pular) out.pular = center(a.bounds);
    }
  });
  if (out.card) {
    walk(j, (n) => { const a = n.attributes || {}; if (a.clickable === "true" && (a.accessibilityText || "").trim() === out.card.label && !out.btn) out.btn = center(a.bounds); });
  }
  return out;
}
const tap = (p) => { if (p) adb(["shell", "input", "tap", String(p.x), String(p.y)]); };

// 1) drena diálogo aberto (foto atual)
let s = scan(hier());
if (s.pular) { console.log("drenando diálogo: Pular"); tap(s.pular); sleep(2500); }

for (let i = 0; i < MAX; i++) {
  s = scan(hier());
  if (!s.card) { console.log(`[${i}] sem card (fim?)`); break; }
  console.log(`[${i}] Passo ${s.card.passo}/${s.card.total} -> "${s.card.label}"`);
  tap(s.btn);
  sleep(3000);

  // diálogos
  let d = scan(hier());
  if (d.pular) {
    console.log(`     -> Pular`);
    tap(d.pular);
    sleep(2500);
  } else if (d.edit && /romaneio/i.test(s.card.label)) {
    console.log(`     -> digita romaneio`);
    tap(d.edit); sleep(700);
    adb(["shell", "input", "text", "HML-E2E-0001"]); sleep(700);
    const c = scan(hier()).confirm; tap(c); sleep(2500);
  } else if (d.edit && /km/i.test(s.card.label)) {
    console.log(`     -> digita KM`);
    tap(d.edit); sleep(700);
    adb(["shell", "input", "text", "1000"]); sleep(700);
    const c = scan(hier()).confirm; tap(c); sleep(2500);
  } else if (d.confirm) {
    console.log(`     -> Confirmar`);
    tap(d.confirm);
    sleep(2500);
  }
  if (/Finalizar/i.test(s.card.label)) console.log("     (passo terminal)");
}
console.log("fim da jornada.");
