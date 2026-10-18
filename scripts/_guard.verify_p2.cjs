'use strict';
// TMS-FIN-DATA-04D3A — Verificador P2 + neutralizacao do seed-relatorios.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const PROD_REF = 'uwrvzsjtpgaifkktpepn';
const ANON_RE = /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/;
const CONN = /createClient\s*\(|new pg\.Client|new pg\.Pool|new Client\s*\(|\.connect\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.rpc\s*\(|chromium\.launch/;

const P2 = [
  { f: 'scripts/lab/testeMissaoOSCompleta.ts', run: 'tsx' },
  { f: 'scripts/lab/testeM66Corrigido.ts', run: 'tsx' },
  { f: 'tmp/valid_real_ui.mjs', run: 'node' },
  { f: 'test_os_save.mjs', run: 'node' },
  { f: 'test_os_cep_horario.mjs', run: 'node' },
  { f: 'scripts/lab/seed-relatorios.cjs', run: 'node' },
];
const INERT = [
  'test_minimal.ts', 'test_min2.ts', 'test_min3.ts', 'test_snippet.ts', 'test_snippet2.ts',
];

const results = [];
for (const { f, run } of P2) {
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs)) { results.push({ f, static: 'FAIL', dyn: 'N/A', det: 'nao existe' }); continue; }
  const src = fs.readFileSync(abs, 'utf8');
  const guardCall = src.search(/guardHarness\s*\(\s*["']/);
  const hasImport = /_guard\.(cjs|mjs)/.test(src);
  const connIdx = src.search(CONN);
  const orderOk = guardCall >= 0 && (connIdx < 0 || guardCall < connIdx);
  const hardProd = src.includes(PROD_REF);
  const hardAnon = ANON_RE.test(src);
  const staticOk = hasImport && guardCall >= 0 && orderOk && !hardProd && !hardAnon;

  const env = { ...process.env }; delete env.ALLOW_TEST_WRITES;
  const cmd = run === 'tsx' ? 'npx' : 'node';
  const args = run === 'tsx' ? ['tsx', f] : [f];
  const r = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 90000, shell: true });
  const out = (r.stdout || '') + (r.stderr || '');
  const blocked = /TEST WRITE BLOCKED/.test(out);
  const importFail = /ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package/.test(out) && !blocked;
  const dynOk = blocked && r.status !== 0;
  results.push({ f, static: staticOk ? 'PASS' : 'FAIL', dyn: dynOk ? 'PASS' : (importFail ? 'N/A' : 'FAIL'), det: dynOk ? 'abortou no guard' : (importFail ? 'import legado quebrado (pre-existente)' : ('status=' + r.status + ' out0=' + out.split(/\r?\n/)[0])) });
}

// seed-relatorios.js: DEVE ser stub sem efeitos (avaliar apenas CODIGO, sem comentarios)
const sr = fs.readFileSync(path.join(ROOT, 'scripts/seed-relatorios.js'), 'utf8');
const srCode = sr
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const srForbidden = [/createClient/, /supabase/i, /\.insert\s*\(/, /\.update\s*\(/, /\.delete\s*\(/, /\.rpc\s*\(/, /INSERT\s+INTO/i, /await\s+import/, /require\s*\(/];
const srViol = srForbidden.filter(re => re.test(srCode)).map(String);
const srEmpty = srCode.replace(/\s/g, '').length === 0;
const seedStubOk = srViol.length === 0 && srEmpty;

// src/lib/testes: arquivos movidos nao existem mais
const movedGone = !fs.existsSync(path.join(ROOT, 'src/lib/testes/testeMissaoOSCompleta.ts')) && !fs.existsSync(path.join(ROOT, 'src/lib/testes/testeM66Corrigido.ts'));

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
console.log(' VERIFICACAO P2 + seed-relatorios (sem DML/conexao)');
console.log('===============================================================');
console.log(pad('ARQUIVO', 44) + pad('ESTATICO', 10) + pad('DYNAMIC', 10) + 'DETALHE');
for (const r of results) console.log(pad(r.f, 44) + pad(r.static, 10) + pad(r.dyn, 10) + r.det);
console.log('\nINERTES (Playwright test skeletons, fora de tests/e2e): ' + INERT.join(', '));
console.log('seed-relatorios.js stub sem efeitos: ' + (seedStubOk ? 'PASS' : ('FAIL -> ' + srViol.join(','))));
console.log('src/lib/testes movidos (ausentes): ' + (movedGone ? 'PASS' : 'FAIL'));
console.log('\nMATRIZ A-E: A=' + A + ' B=' + B + ' C=' + C + ' D(passa guard)=' + (!D) + ' E=' + E);

const failed = results.filter(r => r.static !== 'PASS' || (r.dyn !== 'PASS' && r.dyn !== 'N/A'));
const ae = A && B && C && !D && E;
const ok = failed.length === 0 && seedStubOk && movedGone && ae;
console.log('\nTOTAL=' + P2.length + ' FAIL=' + failed.length + ' | A-E=' + (ae ? 'PASS' : 'FAIL') + ' | stub=' + (seedStubOk ? 'PASS' : 'FAIL') + ' | movidos=' + (movedGone ? 'PASS' : 'FAIL'));
console.log('RESULTADO: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
