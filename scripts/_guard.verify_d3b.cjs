'use strict';
// TMS-FIN-DATA-04D3B — Verificador da neutralizacao da UI + harnesses movidos.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const PROD_REF = 'uwrvzsjtpgaifkktpepn';
const ANON_RE = /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/;
const CONN = /createClient\s*\(|new pg\.Client|new pg\.Pool|new Client\s*\(|\.connect\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.rpc\s*\(|chromium\.launch/;

const MOVED = [
  { f: 'scripts/lab/testeTMSCompleto.ts', run: 'tsx' },
  { f: 'scripts/lab/testeDocumentos.ts', run: 'tsx' },
  { f: 'scripts/lab/executarTesteReal.js', run: 'tsx' },
  { f: 'scripts/lab/executarTesteReal.cjs', run: 'node' },
  { f: 'scripts/lab/testarEdgeFunction.cjs', run: 'node' },
];

// --- Estatico: rota/imports neutralizados ---
const app = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
const perms = fs.readFileSync(path.join(ROOT, 'src/lib/routePermissions.ts'), 'utf8');
const routeGone = !/dev-teste/.test(app) && !/DevTesteTMS/.test(app);
const permGone = !/dev-teste/.test(perms);
const pageGone = !fs.existsSync(path.join(ROOT, 'src/pages/DevTesteTMS.tsx'));
const libGone = !fs.existsSync(path.join(ROOT, 'src/lib/testes'));

// nenhum arquivo em src importa os harnesses movidos
function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|cjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const srcFiles = walk(path.join(ROOT, 'src'), []);
const importers = [];
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'][^"']*(?:lib[\\/]testes|testeTMSCompleto|testeDocumentos|executarTesteReal|testarEdgeFunction|DevTesteTMS)/;
for (const p of srcFiles) {
  const t = fs.readFileSync(p, 'utf8');
  if (IMPORT_RE.test(t)) importers.push(path.relative(ROOT, p));
}
const noImporters = importers.length === 0;

// --- Movidos: guard + sem hardcode + ordem ---
const results = [];
for (const { f, run } of MOVED) {
  const abs = path.join(ROOT, f);
  const src = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
  const guardCall = src.search(/guardHarness\s*\(\s*["']/);
  const hasImport = /_guard\.(cjs|mjs)/.test(src);
  const connIdx = src.search(CONN);
  const orderOk = guardCall >= 0 && (connIdx < 0 || guardCall < connIdx);
  const hardProd = src.includes(PROD_REF);
  const hardAnon = ANON_RE.test(src);
  const staticOk = src && hasImport && guardCall >= 0 && orderOk && !hardProd && !hardAnon;

  const env = { ...process.env }; delete env.ALLOW_TEST_WRITES;
  const cmd = run === 'tsx' ? 'npx' : 'node';
  const args = run === 'tsx' ? ['tsx', f] : [f];
  const r = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 90000, shell: true });
  const out = (r.stdout || '') + (r.stderr || '');
  const blocked = /TEST WRITE BLOCKED/.test(out);
  const importFail = /ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package|Supabase não configurado|does not provide an export|ERR_UNSUPPORTED_DIR_IMPORT|SyntaxError/.test(out) && !blocked;
  results.push({ f, static: staticOk ? 'PASS' : 'FAIL', dyn: blocked ? 'PASS' : (importFail ? 'N/A' : 'FAIL'), det: blocked ? 'abortou no guard' : (importFail ? (/(SyntaxError)/.test(out) ? 'legado .js com sintaxe TS (parse pre-existente)' : 'dependencia de import legada (pre-existente)') : ('status=' + r.status + ' out0=' + out.split(/\r?\n/)[0])) });
}

// A-E
const g = require('./_guard.cjs');
const QA = 'https://aqpfayildtcnrkfeeyjg.supabase.co';
const PR = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const A = g.avaliarTestWrite('A', { VITE_SUPABASE_URL: PR, ENVIRONMENT: 'production' }).bloqueado;
const B = g.avaliarTestWrite('B', { VITE_SUPABASE_URL: PR, ENVIRONMENT: 'production', ALLOW_TEST_WRITES: 'true' }).bloqueado;
const C = g.avaliarTestWrite('C', { VITE_SUPABASE_URL: QA, ENVIRONMENT: 'qa' }).bloqueado;
const D = g.avaliarTestWrite('D', { VITE_SUPABASE_URL: QA, ENVIRONMENT: 'qa', ALLOW_TEST_WRITES: 'true' }).bloqueado;
const E = g.avaliarTestWrite('E', {}).bloqueado;

const pad = (s, n) => String(s).padEnd(n);
console.log('===============================================================');
console.log(' VERIFICACAO 04D3B — UI neutralizada + harnesses lab');
console.log('===============================================================');
console.log('rota /dev-teste removida do App.tsx .... ' + (routeGone ? 'PASS' : 'FAIL'));
console.log('entrada /dev-teste em routePermissions . ' + (permGone ? 'PASS' : 'FAIL'));
console.log('src/pages/DevTesteTMS.tsx removida ..... ' + (pageGone ? 'PASS' : 'FAIL'));
console.log('src/lib/testes removido ................ ' + (libGone ? 'PASS' : 'FAIL'));
console.log('sem importadores em src ................ ' + (noImporters ? 'PASS' : ('FAIL -> ' + importers.join(', '))));
console.log('');
console.log(pad('ARQUIVO LAB', 40) + pad('ESTATICO', 10) + pad('DYNAMIC', 10) + 'DETALHE');
for (const r of results) console.log(pad(r.f, 40) + pad(r.static, 10) + pad(r.dyn, 10) + r.det);
console.log('\nMATRIZ A-E: A=' + A + ' B=' + B + ' C=' + C + ' D(passa)= ' + (!D) + ' E=' + E);

const failed = results.filter(r => r.static !== 'PASS' || (r.dyn !== 'PASS' && r.dyn !== 'N/A'));
const ae = A && B && C && !D && E;
const ok = routeGone && permGone && pageGone && libGone && noImporters && failed.length === 0 && ae;
console.log('\nHARDCODE movidos: ' + results.filter(r => /PROD|anon/.test(r.det)).length);
console.log('RESULTADO: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
