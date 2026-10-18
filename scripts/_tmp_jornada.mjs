import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const DEV = process.env.DEV || "a28e7167";
const APP = process.env.MAESTRO_APP_ID || "com.example.conexao_prestador";
const MAESTRO = process.env.MAESTRO_BIN || path.join(os.homedir(), ".maestro", "bin", process.platform === "win32" ? "maestro.bat" : "maestro");
const ADB_C = [process.env.ADB_PATH, "C:\\Users\\DIEGO BALBINO\\Android_SDK\\platform-tools\\adb.exe", "adb"].filter(Boolean);
const ADB = ADB_C.find((p) => p === "adb" || existsSync(p)) || "adb";
const MAX = Number(process.env.MAX || 20);

function adb(args) {
  return execFileSync(ADB, ["-s", DEV, ...args], { encoding: "utf8", timeout: 60000, windowsHide: true });
}
function hier() {
  const isWin = process.platform === "win32";
  const q = (a) => (/\s/.test(a) ? `"${a}"` : a);
  const cmd = [MAESTRO, "--device", DEV, "hierarchy", "--no-reinstall-driver"].map(q).join(" ");
  const r = spawnSync(cmd, { encoding: "utf8", timeout: 120000, windowsHide: true, shell: isWin });
  if ((r.status ?? 1) !== 0) throw new Error(`hierarchy falhou: ${r.stderr || ""}`);
  return JSON.parse((r.stdout || "").replace(/^\uFEFF/, ""));
}
function walk(n, fn) { fn(n); for (const c of n.children || []) walk(c, fn); }
function boundsCenter(b) {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(b || "");
  if (!m) return null;
  return { x: Math.round((+m[1] + +m[3]) / 2), y: Math.round((+m[2] + +m[4]) / 2) };
}

function findCard(j) {
  let card = null;
  walk(j, (n) => {
    const t = n.attributes?.accessibilityText || "";
    const m = /Passo\s+(\d+)\s+de\s+(\d+)\n([^\n]+)/.exec(t);
    if (m && !card) card = { passo: +m[1], total: +m[2], label: m[3].trim() };
  });
  return card;
}
function findButtonByLabel(j, label) {
  let hit = null;
  walk(j, (n) => {
    const a = n.attributes || {};
    if (a.clickable === "true" && (a.accessibilityText || "").trim() === label) {
      hit = boundsCenter(a.bounds);
    }
  });
  return hit;
}
function findAnyButton(j, labels) {
  let hit = null;
  walk(j, (n) => {
    const a = n.attributes || {};
    if (a.clickable === "true") {
      const t = (a.accessibilityText || a.text || "").trim();
      for (const l of labels) if (t === l || t.includes(l)) { hit = { label: t, ...boundsCenter(a.bounds) }; }
    }
  });
  return hit;
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

for (let i = 0; i < MAX; i++) {
  const j = hier();
  const card = findCard(j);
  if (!card) { console.log(`[${i}] sem card de proximo passo — fim?`); break; }
  const btn = findButtonByLabel(j, card.label);
  console.log(`[${i}] Passo ${card.passo}/${card.total} -> "${card.label}" btn=${btn ? `${btn.x},${btn.y}` : "NAO ENCONTRADO"}`);
  if (!btn) break;
  adb(["shell", "input", "tap", String(btn.x), String(btn.y)]);
  sleep(3000);
  // Drena dialogos simples (Confirmar/Aceitar/Salvar/OK)
  const j2 = hier();
  const dlg = findAnyButton(j2, ["Confirmar", "Aceitar", "Salvar", "OK", "Continuar"]);
  if (dlg && dlg.label !== card.label) {
    console.log(`     dialog -> "${dlg.label}" @${dlg.x},${dlg.y}`);
    adb(["shell", "input", "tap", String(dlg.x), String(dlg.y)]);
    sleep(2500);
  }
  if (card.label.includes("Finalizar operação") || card.label.includes("Finalizar entrega")) {
    console.log("     (acao terminal executada)");
  }
}
console.log("fim.");
