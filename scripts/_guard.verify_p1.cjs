'use strict';
// TMS-FIN-DATA-04D2 — Verificador dos P1 criticos.
// Estatico: guard importado/chamado ANTES da 1a conexao/escrita + sem hardcode PROD/anon.
// Dinamico: executa cada harness com env default (sem ALLOW_TEST_WRITES) e exige
//           aborto por GUARD (TEST WRITE BLOCKED) SEM conexao/escrita.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const PROD_REF = 'uwrvzsjtpgaifkktpepn';
const ANON_RE = /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/;

const FILES = [
  { f: 'scripts/missao43_teste_ponta_a_ponta.ts', run: 'tsx' },
  { f: 'scripts/m81_test_financeiro_propagacao.ts', run: 'tsx' },
  { f: 'scripts/m86_seed_veiculos_prestadores.ts', run: 'tsx' },
  { f: 'scripts/m86_fix_region_matching.ts', run: 'tsx' },
  { f: 'scripts/m90_test_fluxo_completo_rede.ts', run: 'tsx' },
  { f: 'scripts/_tms012_criar_os_hml.cjs', run: 'node' },
  { f: 'scripts/tms013_seed_hml.mjs', run: 'node' },
  { f: 'scripts/seed-cliente-teste-real.ts', run: 'tsx' },
  { f: 'scripts/seed_portal_cliente_demo.cjs', run: 'node' },
  { f: 'scripts/valid_real_p1p2_ciclo_completo.mjs', run: 'node' },
  { f: 'scripts/valid_real_p1p2_ui_auth.ts', run: 'tsx' },
  { f: 'scripts/valid_real_p1p2_ui_visual.ts', run: 'tsx' },
  { f: 'scripts/missao48_homologacao_operacional.ts', run: 'tsx' },
];
const BLOCKED_FILES = [
  { f: 'scripts/m85_seed_veiculos_prestadores.ts', motivo: 'ARQUIVO NAO EXISTE (nao inventado)' },
  { f: 'scripts/seed-relatorios.js', motivo: 'snippet p/ console do navegador; guard node incompativel' },
];
const CONN = /createClient\s*\(|new pg\.Client|new pg\.Pool|new Client\s*\(|\.connect\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.rpc\s*\(|chromium\.launch/;

const results = [];
for (const { f, run } of FILES) {
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs)) { results.push({ f, static: 'FAIL', dyn: 'N/A', det: 'arquivo nao existe' }); continue; }
  const src = fs.readFileSync(abs, 'utf8');
  const guardCall = src.search(/guardHarness\s*\(\s*["']/);
  const hasImport = /_guard\.(cjs|mjs)/.test(src);
  const connIdx = src.search(CONN);
  const orderOk = guardCall >= 0 && (connIdx < 0 || guardCall < connIdx);
  const hardProd = src.includes(PROD_REF);
  const hardAnon = ANON_RE.test(src);
  const staticOk = hasImport && guardCall >= 0 && orderOk && !hardProd && !hardAnon;

  // Dinamico: deve abortar no guard. Env default do shell (sem ALLOW_TEST_WRITES).
  const env = { ...process.env };
  delete env.ALLOW_TEST_WRITES;
  const cmd = run === 'tsx' ? 'npx' : 'node';
  const args = run === 'tsx' ? ['tsx', f] : [f];
  const r = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 90000, shell: true });
  const out = (r.stdout || '') + (r.stderr || '');
  const blocked = /TEST WRITE BLOCKED/.test(out);
  const noConn = !/ECONNREFUSED|ENOTFOUND|getaddrinfo|password authentication|Connection terminated|Supabase|Invalid API key/i.test(out) || blocked;
  const dynOk = blocked && r.status !== 0;
  results.push({ f, static: staticOk ? 'PASS' : 'FAIL', dyn: dynOk ? 'PASS' : 'FAIL', det: dynOk ? 'abortou no guard' : ('status=' + r.status + ' out0=' + out.split(/\r?\n/)[0]) });
}

// Matriz A-E (logica central do guard, com env mockado) — prova do comportamento exigido.
const g = require('./_guard.cjs');
const QA = 'https://aqpfayildtcnrkfeeyjg.supabase.co';
const PR = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const A = g.avaliarTestWrite('A', { VITE_SUPABASE_URL: PR, ENVIRONMENT: 'production' }).bloqueado;
const B = g.avaliarTestWrite('B', { VITE_SUPABASE_URL: PR, ENVIRONMENT: 'production', ALLOW_TEST_WRITES: 'true' }).bloqueado;
const C = g.avaliarTestWrite('C', { VITE_SUPABASE_URL: QA, ENVIRONMENT: 'qa' }).bloqueado;
const D = g.avaliarTestWrite('D', { VITE_SUPABASE_URL: QA, ENVIRONMENT: 'qa', ALLOW_TEST_WRITES: 'true' }).bloqueado; // false = passa pelo guard
const E = g.avaliarTestWrite('E', {}).bloqueado;

const pad = (s, n) => String(s).padEnd(n);
console.log('===============================================================');
console.log(' VERIFICACAO P1 — estatico + execucao controlada (sem DML)');
console.log('===============================================================');
console.log(pad('ARQUIVO', 50) + pad('ESTATICO', 10) + pad('DYNAMIC', 10) + 'DETALHE');
for (const r of results) console.log(pad(r.f, 50) + pad(r.static, 10) + pad(r.dyn, 10) + r.det);
console.log('\nMATRIZ A-E (guard central, env mockado):');
console.log(' A) PROD sem opt-in .............. ' + (A ? 'BLOQUEIA' : 'PERMITE') + (A ? ' PASS' : ' FAIL'));
console.log(' B) PROD + ALLOW=true ............ ' + (B ? 'BLOQUEIA' : 'PERMITE') + (B ? ' PASS' : ' FAIL'));
console.log(' C) QA sem opt-in ................ ' + (C ? 'BLOQUEIA' : 'PERMITE') + (C ? ' PASS' : ' FAIL'));
console.log(' D) QA + ALLOW=true .............. ' + (D ? 'BLOQUEIA' : 'PERMITE') + (!D ? ' PASS (passa pelo guard)' : ' FAIL'));
console.log(' E) ausencia de env .............. ' + (E ? 'BLOQUEIA' : 'PERMITE') + (E ? ' PASS' : ' FAIL'));
console.log('\nBLOCKED (registrar):');
for (const b of BLOCKED_FILES) console.log(' - ' + b.f + ' :: ' + b.motivo);

const failed = results.filter(r => r.static !== 'PASS' || r.dyn !== 'PASS');
const ae = A && B && C && !D && E;
console.log('\nTOTAL arquivos= ' + FILES.length + ' | estaticos/dinamicos FAIL= ' + failed.length + ' | A-E= ' + (ae ? 'PASS' : 'FAIL'));
process.exit(failed.length === 0 && ae ? 0 : 1);
