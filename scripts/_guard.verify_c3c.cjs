'use strict';
// TMS-FIN-DATA-04D3C3C — Verificador de inercia dos 6 A2.
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const ARCH = path.join(ROOT, 'docs', 'lab', 'neutralized_oneoffs');
const SECRET = /uwrvzsjtpgaifkktpepn|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9|postgres(ql)?:\/\/[^@\s'"]+@|tms-internal-token-[\w-]+/;
const EXEC = /createClient|require\s*\(|import\s|fetch\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(|\.rpc\s*\(|CREATE\s+TABLE|new\s+pg\./;
const FILES = ['criar_tabela_valores.cjs','criar_todas.cjs','forcar_create.cjs','refresh.cjs','criar_tabela.cjs','test_doc.cjs'];
const codeOnly = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n').trim();

const rows = [];
for (const n of FILES) {
  const abs = path.join(ROOT, n);
  const raw = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  const code = raw ? codeOnly(raw) : '';
  const archPath = path.join(ARCH, n + '.txt');
  const archRaw = fs.existsSync(archPath) ? fs.readFileSync(archPath, 'utf8') : null;
  rows.push({ n, exists: !!raw, codeEmpty: code.length === 0, stubSecret: raw ? SECRET.test(raw) : true, stubExec: EXEC.test(code), arch: !!archRaw, archSecret: archRaw ? SECRET.test(archRaw) : true });
}
const archFiles = fs.existsSync(ARCH) ? fs.readdirSync(ARCH) : [];
const archNonTxt = archFiles.filter(f => !f.endsWith('.txt'));

// references: nenhum import real em src/tests/package.json
function walk(d, acc) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else if (/\.(ts|tsx|js|cjs|mjs)$/.test(e.name)) acc.push(p); } return acc; }
const codeFiles = walk(path.join(ROOT, 'src'), []).concat(walk(path.join(ROOT, 'scripts'), []));
const importRefs = [];
for (const p of codeFiles) { const t = fs.readFileSync(p, 'utf8'); if (/(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'][^"']*(?:criar_tabela_valores|criar_todas|forcar_create|refresh|criar_tabela|test_doc)["']/.test(t)) importRefs.push(path.relative(ROOT, p)); }
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
const pkgRefs = /criar_tabela_valores|criar_todas|forcar_create|test_doc/.test(pkg);

const failed = rows.filter(r => !(r.exists && r.codeEmpty && !r.stubSecret && !r.stubExec && r.arch && !r.archSecret));
const ok = failed.length === 0 && archNonTxt.length === 0 && importRefs.length === 0 && !pkgRefs;

const pad = (s, n) => String(s).padEnd(n);
console.log('===============================================================');
console.log(' VERIFICACAO 04D3C3C — 6 A2 neutralizados');
console.log('===============================================================');
console.log(pad('ARQUIVO', 26) + pad('CODE=0', 8) + pad('STUB_SEC', 10) + pad('STUB_EXEC', 10) + pad('ARCH', 6) + 'ARCH_SEC');
for (const r of rows) console.log(pad(r.n, 26) + pad(r.codeEmpty, 8) + pad(r.stubSecret, 10) + pad(r.stubExec, 10) + pad(r.arch, 6) + r.archSecret);
console.log('\narchives .txt (6) sem segredo: ' + (archNonTxt.length === 0 && rows.every(r => r.arch && !r.archSecret) ? 'PASS' : 'FAIL'));
console.log('import refs em src/scripts: ' + (importRefs.length === 0 ? 'PASS' : ('FAIL ' + importRefs.join(','))));
console.log('package.json refs: ' + (pkgRefs ? 'FAIL' : 'PASS'));
console.log('\nRESULTADO: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
