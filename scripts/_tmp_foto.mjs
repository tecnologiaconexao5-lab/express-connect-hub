import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs"; import os from "node:os"; import path from "node:path";
const DEV="a28e7167"; const MAESTRO=path.join(os.homedir(),".maestro","bin","maestro.bat");
const ADB=["C:\\Users\\DIEGO BALBINO\\Android_SDK\\platform-tools\\adb.exe"].find(existsSync)||"adb";
const adb=(a)=>execFileSync(ADB,["-s",DEV,...a],{encoding:"utf8",windowsHide:true});
function hier(){const q=(a)=>(/\s/.test(a)?`"${a}"`:a);const r=spawnSync([MAESTRO,"--device",DEV,"hierarchy","--no-reinstall-driver"].map(q).join(" "),{encoding:"utf8",windowsHide:true,shell:true,timeout:120000});return JSON.parse((r.stdout||"").replace(/^\uFEFF/,""));}
function walk(n,fn){fn(n);for(const c of n.children||[])walk(c,fn);}
function center(b){const m=/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(b||"");return m?{x:Math.round((+m[1]+ +m[3])/2),y:Math.round((+m[2]+ +m[4])/2)}:null;}
const sleep=(ms)=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
const j=hier(); let btn=null,label=null;
walk(j,(n)=>{const t=n.attributes?.accessibilityText||"";const m=/Passo\s+(\d+)\s+de\s+(\d+)\n([^\n]+)/.exec(t);if(m&&!label)label=m[3].trim();});
walk(j,(n)=>{const a=n.attributes||{};if(a.clickable==="true"&&(a.accessibilityText||"").trim()===label&&!btn)btn=center(a.bounds);});
console.log("label:",label,"btn:",btn);
if(btn){adb(["shell","input","tap",String(btn.x),String(btn.y)]);sleep(3000);}
const j2=hier(); const items=[]; walk(j2,(n)=>{const a=n.attributes||{};const t=(a.accessibilityText||a.text||"").trim(); if(a.clickable==="true"&&t) items.push(`${t} @ ${JSON.stringify(center(a.bounds))}`);});
console.log("clicaveis agora:"); console.log(items.slice(0,25).join("\n"));
