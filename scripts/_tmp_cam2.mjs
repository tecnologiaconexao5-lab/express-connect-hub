import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const DEV = "a28e7167";
const MAESTRO = path.join(os.homedir(), ".maestro", "bin", "maestro.bat");
const ADB = ["C:\\Users\\DIEGO BALBINO\\Android_SDK\\platform-tools\\adb.exe"].find(existsSync) || "adb";
const adb = (a) => execFileSync(ADB, ["-s", DEV, ...a], { encoding: "utf8", windowsHide: true });
function hier() {
  const q = (a) => (/\s/.test(a) ? `"${a}"` : a);
  const r = spawnSync([MAESTRO, "--device", DEV, "hierarchy", "--no-reinstall-driver"].map(q).join(" "), { encoding: "utf8", windowsHide: true, shell: true, timeout: 120000 });
  return JSON.parse((r.stdout || "").replace(/^\uFEFF/, ""));
}
function walk(n, fn) { fn(n); for (const c of n.children || []) walk(c, fn); }
function center(b) { const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(b || ""); return m ? { x: Math.round((+m[1] + +m[3]) / 2), y: Math.round((+m[2] + +m[4]) / 2) } : null; }
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const tap = (p) => adb(["shell", "input", "tap", String(p.x), String(p.y)]);

const j = hier();
let label = null, btn = null;
walk(j, (n) => { const t = n.attributes?.accessibilityText || ""; const m = /Passo\s+(\d+)\s+de\s+(\d+)\n([^\n]+)/.exec(t); if (m && !label) label = m[3].trim(); });
walk(j, (n) => { const a = n.attributes || {}; if (a.clickable === "true" && (a.accessibilityText || "").trim() === label && !btn) btn = center(a.bounds); });
console.log("label:", label, "btn:", btn);
if (btn) { tap(btn); sleep(2500); }
const j2 = hier();
let cam = null;
walk(j2, (n) => { const a = n.attributes || {}; const t = (a.accessibilityText || a.text || "").trim(); if (a.clickable === "true" && /C.mara/.test(t) && !cam) cam = center(a.bounds); });
console.log("abrir camera:", cam);
if (cam) { tap(cam); sleep(7000); }
console.log("foco:", adb(["shell", "dumpsys", "window"]).split("\n").find((l) => l.includes("mCurrentFocus"))?.trim());
// salva screenshot
adb(["shell", "screencap", "-p", "/sdcard/cam2.png"]);
adb(["pull", "/sdcard/cam2.png", path.join(os.tmpdir(), "opencode", "cam2.png")]);
console.log("screenshot salvo em", path.join(os.tmpdir(), "opencode", "cam2.png"));
