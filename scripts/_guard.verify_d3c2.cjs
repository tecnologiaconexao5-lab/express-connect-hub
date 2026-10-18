'use strict';
// TMS-FIN-DATA-04D3C2 — Verificador de inercia dos snippets neutralizados.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = process.cwd();

const D_FILES = ['_a22_q1.cjs','_a22_q1.js','_a22_q2.cjs','_a22_q3.cjs','_a22_q4.cjs','_a22_q5.cjs','_a22_q6.cjs','_a22_q7.cjs','_a22_q7b.cjs','_a22_q8.cjs','_a22_q9.cjs','_a22_q10.cjs','_a22_q11.cjs','_a22_q12.cjs','_a22_q13.cjs','_a22_q14.cjs','_a22_q15.cjs','_a22_q15b.cjs','_a22_q15c.cjs','_a22_q16.cjs','_a22_q16b.cjs','_a22_q16c.cjs','_a22_q17.cjs','_a22_q17b.cjs','_a22_q17c.cjs','_a22_replay_torre.cjs','_a22_send_torre.cjs'];
const ARCH = path.join(ROOT, 'docs', 'lab', 'neutralized_snippets');
const SECRET = /uwrvzsjtpgaifkktpepn|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9|postgres(ql)?:\/\/[^@\s'"]+@/;
const EXEC = /createClient|require\s*\(|import\s|fetch\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.rpc\s*\(|new\s+pg\.|\.query\s*\(/;

function codeOnly(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n').trim();
}

const rows = [];
for (const n of D_FILES) {
  const abs = path.join(ROOT, n);
  const raw = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  const code = raw ? codeOnly(raw) : '';
  rows.push({ n, exists: !!raw, codeEmpty: code.length === 0, secret: raw ? SECRET.test(raw) : false, exec: !!raw && EXEC.test(code), arch: fs.existsSync(path.join(ARCH, n + '.txt')) });
}
const archFiles = fs.existsSync(ARCH) ? fs.readdirSync(ARCH) : [];
const archSecret = archFiles.filter(f => SECRET.test(fs.readFileSync(path.join(ARCH, f), 'utf8')));
const archNonTxt = archFiles.filter(f => !f.endsWith('.txt'));

const validacaoGone = !fs.existsSync(path.join(ROOT, 'src', 'testes', 'validacaoTMS.ts'));
const srcTestesGone = !fs.existsSync(path.join(ROOT, 'src', 'testes'));
const archValidacao = fs.existsSync(path.join(ARCH, 'validacaoTMS.ts.txt'));

// zero imports em src dos nomes neutralizados (import real)
function walk(d, acc) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else if (/\.(ts|tsx|js|cjs)$/.test(e.name)) acc.push(p); } return acc; }
const srcFiles = walk(path.join(ROOT, 'src'), []);
const importers = [];
for (const p of srcFiles) { const t = fs.readFileSync(p, 'utf8'); if (/(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'][^"']*_a22_/.test(t)) importers.push(path.relative(ROOT, p)); }
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
const pkgA22 = /_a22_/.test(pkg);

const failed = rows.filter(r => !(r.exists && r.codeEmpty && !r.secret && !r.exec && r.arch));
const ok = failed.length === 0 && archSecret.length === 0 && archNonTxt.length === 0 && validacaoGone && srcTestesGone && archValidacao && importers.length === 0 && !pkgA22;

const pad = (s, n) => String(s).padEnd(n);
console.log('===============================================================');
console.log(' VERIFICACAO 04D3C2 — snipets neutralizados');
console.log('===============================================================');
console.log(pad('ARQUIVO', 28) + pad('EXISTS', 8) + pad('CODE=0', 8) + pad('SECRET', 8) + pad('EXEC', 6) + 'ARCH');
for (const r of rows) console.log(pad(r.n, 28) + pad(r.exists, 8) + pad(r.codeEmpty, 8) + pad(r.secret, 8) + pad(r.exec, 6) + r.arch);
console.log('\narchives .txt sanitizados: ' + (archSecret.length === 0 && archNonTxt.length === 0 ? 'PASS' : ('FAIL ' + archSecret.concat(archNonTxt).join(','))) + ' (' + archFiles.length + ' arquivos)');
console.log('validacaoTMS fora de src: ' + (validacaoGone ? 'PASS' : 'FAIL') + ' | src/testes ausente: ' + (srcTestesGone ? 'PASS' : 'FAIL') + ' | arquivado: ' + (archValidacao ? 'PASS' : 'FAIL'));
console.log('imports em src dos _a22_: ' + (importers.length === 0 ? 'PASS' : ('FAIL ' + importers.join(','))));
console.log('package.json cita _a22_: ' + (pkgA22 ? 'FAIL' : 'PASS'));

console.log('\nRESULTADO: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
