'use strict';
// TMS-FIN-DATA-04D3C4 — Verificador dos 8 audits (read-only + fail-closed + sem segredo).
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const FILES = ['_audit_001.mjs','_audit_002.mjs','_audit_003.mjs','_audit_004.mjs','_audit_005.mjs','_audit_006.mjs','_audit_007.mjs','_audit_008.mjs'];
const READONLY = FILES.filter(f => f !== '_audit_007.mjs');
const SECRET = { dbCred: /postgres(ql)?:\/\/[^@\s'"]+:[^@\s'"]+@/, anon: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/, prodRef: /uwrvzsjtpgaifkktpepn/, service: /service_role\s*[=:]/i, token: /tms-internal-token-[\w-]+/ };
const MUT = /\b(INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|CALL|DO)\b/i;
const codeOnly = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');

const rows = [];
for (const f of FILES) {
  const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const code = codeOnly(raw);
  const isRO = f !== '_audit_007.mjs';
  const secrets = Object.fromEntries(Object.entries(SECRET).map(([k, re]) => [k, re.test(raw)]));
  const hasFailClosed = /FAIL-CLOSED/.test(raw) && /process\.exit\(1\)/.test(raw);
  const hasRpc = /\.rpc\s*\(/.test(code);
  const hasMut = MUT.test(code);
  const withDml = /WITH[\s\S]*?\b(INSERT|UPDATE|DELETE)\b/i.test(code);
  const hasDotenv = /dotenv/.test(raw);
  const fetchMut = /fetch\s*\(/.test(code);
  let status;
  if (isRO) status = (!hasMut && !withDml && !hasRpc && !hasDotenv && Object.values(secrets).every(v => !v) && hasFailClosed && !fetchMut) ? 'READ-ONLY-OK' : 'FAIL';
  else status = (!hasMut && !withDml && !hasRpc && !hasDotenv && Object.values(secrets).every(v => !v) && hasFailClosed) ? 'BLOCKED-PARCIAL (POST externo)' : 'FAIL';
  rows.push({ f, isRO, secrets, hasFailClosed, hasMut, withDml, hasRpc, hasDotenv, fetchMut, status });
}

const pad = (s, n) => String(s).padEnd(n);
console.log('===============================================================');
console.log(' VERIFICACAO 04D3C4 — 8 audits (read-only + fail-closed)');
console.log('===============================================================');
console.log(pad('ARQUIVO', 16) + pad('SECRET', 8) + pad('FAIL-CLOSED', 12) + pad('MUT/DDL', 8) + pad('RPC', 5) + pad('DOTENV', 8) + pad('FETCH', 6) + 'STATUS');
for (const r of rows) {
  const sec = Object.values(r.secrets).some(Boolean);
  console.log(pad(r.f, 16) + pad(sec ? 'SIM' : 'NAO', 8) + pad(r.hasFailClosed, 12) + pad(r.hasMut, 8) + pad(r.hasRpc, 5) + pad(r.hasDotenv, 8) + pad(r.fetchMut, 6) + r.status);
}
const sweep = { dbCred: rows.some(r => r.secrets.dbCred), anon: rows.some(r => r.secrets.anon), prodRef: rows.some(r => r.secrets.prodRef), service: rows.some(r => r.secrets.service), token: rows.some(r => r.secrets.token) };
console.log('\nSWEEP SEGREDOS (8) — PRESENTE/AUSENTE:');
for (const [k, v] of Object.entries(sweep)) console.log('  ' + k + ': ' + (v ? 'PRESENTE' : 'AUSENTE'));
const failed = rows.filter(r => r.status === 'FAIL');
console.log('\nread-only OK: ' + rows.filter(r => r.status === 'READ-ONLY-OK').length + '/7 | excecao: ' + rows.filter(r => r.status.startsWith('BLOCKED')).length + ' (_audit_007) | FAIL=' + failed.length);
const ok = failed.length === 0 && !Object.values(sweep).some(Boolean);
console.log('RESULTADO: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
