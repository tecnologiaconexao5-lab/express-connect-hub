'use strict';
// TMS-FIN-DATA-04D3C3B2 — Verificador dos 12 A1 restantes.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = process.cwd();
const PROD = 'uwrvzsjtjgaifkktpepn'; // guard against typo
const PROD_REF = 'uwrvzsjtpgaifkktpepn';
const ANON = /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/;
const CONN = /createClient\s*\(|new pg\.|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.rpc\s*\(|\.storage\b|\.upload\s*\(|fetch\s*\(/;
const FILES = ['teste_completo.cjs','teste_fluxo_mapbox.cjs','teste_os.cjs','teste_pgto_completo.cjs','test_mapbox_valor.cjs','test_pagamento.cjs','validar_pagamento.cjs','test_os_p2.mjs','test_os_p3.mjs','valida.ts','valida_crud.ts','valida_status.ts'];

const results = [];
for (const n of FILES) {
  const rootGone = !fs.existsSync(path.join(ROOT, n));
  const labAbs = path.join(ROOT, 'scripts', 'lab', n);
  const inLab = fs.existsSync(labAbs);
  const src = inLab ? fs.readFileSync(labAbs, 'utf8') : '';
  const guardCall = src.search(/guardHarness\s*\(\s*["']/);
  const hasImport = /_guard\.(cjs|mjs)/.test(src);
  const connIdx = src.search(CONN);
  const orderOk = guardCall >= 0 && (connIdx < 0 || guardCall < connIdx);
  const noProd = !src.includes(PROD_REF);
  const noAnon = !ANON.test(src);
  const noDotenv = !/dotenv/.test(src);
  const noDbCred = !/DATABASE_URL\s*=\s*["'][^"']*:[^"']*@/.test(src);
  const staticOk = rootGone && inLab && hasImport && guardCall >= 0 && orderOk && noProd && noAnon && noDotenv && noDbCred;

  const run = n.endsWith('.cjs') ? 'node' : (n.endsWith('.mjs') ? 'node' : 'tsx');
  const env = { ...process.env }; delete env.ALLOW_TEST_WRITES;
  const cmd = run === 'tsx' ? 'npx' : 'node';
  const args = run === 'tsx' ? ['tsx', path.join('scripts', 'lab', n)] : [path.join('scripts', 'lab', n)];
  const r = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 90000, shell: true });
  const out = (r.stdout || '') + (r.stderr || '');
  const blocked = /TEST WRITE BLOCKED/.test(out);
  results.push({ n, rootGone, inLab, static: staticOk ? 'PASS' : 'FAIL', dyn: blocked ? 'PASS' : 'FAIL', det: blocked ? 'abortou no guard' : ('status=' + r.status + ' out0=' + out.split(/\r?\n/)[0]) });
}

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
console.log(' VERIFICACAO 04D3C3B2 — 12 A1 restantes');
console.log('===============================================================');
console.log(pad('ARQUIVO', 24) + pad('ROOT=0', 8) + pad('LAB', 6) + pad('STATIC', 8) + pad('DYN', 6) + 'DET');
for (const r of results) console.log(pad(r.n, 24) + pad(r.rootGone, 8) + pad(r.inLab, 6) + pad(r.static, 8) + pad(r.dyn, 6) + r.det);
console.log('\nMATRIZ A-E: A=' + A + ' B=' + B + ' C=' + C + ' D(passa guard)=' + (!D) + ' E=' + E);
const failed = results.filter(r => r.static !== 'PASS' || r.dyn !== 'PASS');
const ae = A && B && C && !D && E;
const ok = failed.length === 0 && ae;
console.log('\nTOTAL=12 FAIL=' + failed.length + ' | A-E=' + (ae ? 'PASS' : 'FAIL'));
console.log('RESULTADO: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
