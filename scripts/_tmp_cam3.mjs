import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs"; import os from "node:os"; import path from "node:path";
const DEV="a28e7167"; const MAESTRO=path.join(os.homedir(),".maestro","bin","maestro.bat");
const ADB=["C:\\Users\\DIEGO BALBINO\\Android_SDK\\platform-tools\\adb.exe"].find(existsSync)||"adb";
const adb=(a)=>execFileSync(ADB,["-s",DEV,...a],{encoding:"utf8",windowsHide:true});
function hier(){const q=(a)=>(/\s/.test(a)?`"${a}"`:a);const r=spawnSync([MAESTRO,"--device",DEV,"hierarchy","--no-reinstall-driver"].map(q).join(" "),{encoding:"utf8",windowsHide:true,shell:true,timeout:120000});return JSON.parse((r.stdout||"").replace(/^\uFEFF/,""));}
function walk(n,fn){fn(n);for(const c of n.children||[])walk(c,fn);}
function center(b){const m=/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(b||"");return m?{x:Math.round((+m[1]+ +m[3])/2),y:Math.round((+m[2]+ +m[4])/2)}:null;}
const sleep=(ms)=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
const j=hier(); let cam=null;
walk(j,(n)=>{const a=n.attributes||{};const t=(a.accessibilityText||a.text||"").trim(); if(a.clickable==="true"&&/Abrir/.test(t)&&!cam) cam={...center(a.bounds),t};});
console.log("abrir camera:",cam);
if(cam){adb(["shell","input","tap",String(cam.x),String(cam.y)]);sleep(9000);}
console.log("foco:",adb(["shell","dumpsys","window"]).split("\n").find(l=>l.includes("mCurrentFocus"))?.trim());
adb(["shell","screencap","-p","/sdcard/cam3.png"]); adb(["pull","/sdcard/cam3.png",path.join(os.tmpdir(),"opencode","cam3.png")]);
console.log("ok");
