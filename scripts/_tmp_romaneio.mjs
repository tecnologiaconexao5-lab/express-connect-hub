import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os"; import path from "node:path";
const DEV = "a28e7167";
const MAESTRO = path.join(os.homedir(), ".maestro", "bin", "maestro.bat");
const ADB = ["C:\\Users\\DIEGO BALBINO\\Android_SDK\\platform-tools\\adb.exe"].find(existsSync) || "adb";
const adb = (a) => execFileSync(ADB, ["-s", DEV, ...a], { encoding: "utf8", windowsHide: true });
function hier(){ const q=(a)=>(/\s/.test(a)?`"${a}"`:a); const cmd=[MAESTRO,"--device",DEV,"hierarchy","--no-reinstall-driver"].map(q).join(" "); const r=spawnSync(cmd,{encoding:"utf8",windowsHide:true,shell:true,timeout:120000}); return JSON.parse((r.stdout||"").replace(/^\uFEFF/,"")); }
function walk(n,fn){fn(n);for(const c of n.children||[])walk(c,fn);}
function center(b){const m=/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(b||"");return m?{x:Math.round((+m[1]+ +m[3])/2),y:Math.round((+m[2]+ +m[4])/2)}:null;}
const sleep=(ms)=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
const j = hier();
let edit=null, confirm=null, cancel=null;
walk(j,(n)=>{const a=n.attributes||{};const t=(a.accessibilityText||a.text||"").trim();
  if(a.clickable==="true"&&a.class?.includes("EditText")&&!edit) edit=center(a.bounds);
  if(a.clickable==="true"&&t==="Confirmar"&&!confirm) confirm={...center(a.bounds),t};
  if(a.clickable==="true"&&t==="Cancelar"&&!cancel) cancel={...center(a.bounds),t};
});
console.log("edit:",edit,"confirm:",confirm,"cancel:",cancel);
if(edit){ adb(["shell","input","tap",String(edit.x),String(edit.y)]); sleep(800); adb(["shell","input","text","HML-E2E-0001"]); sleep(800); }
const j2=hier(); let c2=null; walk(j2,(n)=>{const a=n.attributes||{};const t=(a.accessibilityText||a.text||"").trim(); if(a.clickable==="true"&&t==="Confirmar"&&!c2) c2=center(a.bounds);});
console.log("confirm apos digitar:",c2);
if(c2){ adb(["shell","input","tap",String(c2.x),String(c2.y)]); sleep(3000); }
const j3=hier(); let card=null; walk(j3,(n)=>{const t=n.attributes?.accessibilityText||"";const m=/Passo\s+(\d+)\s+de\s+(\d+)\n([^\n]+)/.exec(t);if(m&&!card)card={p:m[1],t:m[2],l:m[3].trim()};});
console.log("card agora:",card);
