'use strict';
// TMS-FIN-DATA-04D3C3B1 — Verificador dos 11 A1 (test harnesses).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = process.cwd();
const PROD = 'uwrvzsjtpgaifkktpepn';
const ANON = /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/;
const CONN = /createClient\s*\(|\.storage\b|\.upload\s*\(|new pg\.|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.rpc\s*\(/;
const FILES = ['test-cliente.ts','test-end2.ts','test-endereco.ts','test-financeiro.ts','test-os.ts','test-os2.ts','test-pagar.ts','test-pf-final.ts','test-prestador.ts','test-vinculo.ts','test-upload-final.cjs'];

const results = [];
for (const n of FILES) {
  const rootAbs = path.join(ROOT, n);
  const labAbs = path.join(ROOT, 'scripts', 'lab', n);
  const rootGone = !fs.existsSync(rootAbs);
  const inLab = fs.existsSync(labAbs);
  const src = inLab ? fs.readFileSync(labAbs, 'utf8') : '';
  const guardCall = src.search(/guardHarness\s*\(\s*["']/);
  const hasImport = /_guard\.(cjs|mjs)/.test(src);
  const connIdx = src.search(CONN);
  const orderOk = guardCall >= 0 && (connIdx < 0 || guardCall < connIdx);
  const hardProd = src.includes(PROD);
  const hardAnon = ANON.test(src);
  const dotenvDb = /DATABASE_URL\s*=\s*["'][^"']*:[^"']*@/.test(src);
  const staticOk = rootGone && inLab && hasImport && guardCall >= 0 && orderOk && !hardProd && !hardAnon && !dotenvDb;

  const run = n.endsWith('.cjs') ? 'node' : 'tsx';
  const env = { ...process.env }; delete env.ALLOW_TEST_WRITES;
  const cmd = run === 'tsx' ? 'npx' : 'node';
  const args = run === 'tsx' ? ['tsx', path.join('scripts', 'lab', n)] : [path.join('scripts', 'lab', n)];
  const r = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 90000, shell: true });
  const out = (r.stdout || '') + (r.stderr || '');
  const blocked = /TEST WRITE BLOCKED/.test(out);
  const dyn = blocked ? 'PASS' : 'FAIL';
  results.push({ n, rootGone, inLab, static: staticOk ? 'PASS' : 'FAIL', dyn, det: blocked ? 'abortou no guard' : ('status=' + r.status + ' out0=' + out.split(/\r?\n/)[0]) });
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
console.log(' VERIFICACAO 04D3C3B1 — 11 A1 test-harnesses');
console.log('===============================================================');
console.log(pad('ARQUIVO', 26) + pad('ROOT=0', 8) + pad('LAB', 6) + pad('STATIC', 8) + pad('DYN', 6) + 'DET');
for (const r of results) console.log(pad(r.n, 26) + pad(r.rootGone, 8) + pad(r.inLab, 6) + pad(r.static, 8) + pad(r.dyn, 6) + r.det);
console.log('\nMATRIZ A-E: A=' + A + ' B=' + B + ' C=' + C + ' D(passa guard)=' + (!D) + ' E=' + E);
const failed = results.filter(r => r.static !== 'PASS' || r.dyn !== 'PASS');
const ae = A && B && C && !D && E;
const ok = failed.length === 0 && ae;
console.log('\nTOTAL=11 FAIL=' + failed.length + ' | A-E=' + (ae ? 'PASS' : 'FAIL'));
console.log('RESULTADO: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
