'use strict';
// TMS-FIN-DATA-04D3C3D — Verificador A3/A4 + consolidado 33/33.
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const SECRET = /uwrvzsjtpgaifkktpepn|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9|postgres(ql)?:\/\/[^@\s'"]+@|tms-internal-token-[\w-]+|service_role\s*[=:]/i;
const EXEC = /createClient|require\s*\(|import\s|fetch\s*\(|\.rpc\s*\(|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(|new\s+pg\./;
const codeOnly = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n').trim();
const FILES = [
  { n: 'query_sql.cjs', kind: 'A3', arch: 'docs/lab/neutralized_admin/query_sql.cjs.txt' },
  { n: 'check_types.mjs', kind: 'A3', arch: 'docs/lab/neutralized_admin/check_types.mjs.txt' },
  { n: 'criar_schema.cjs', kind: 'A4', arch: 'docs/lab/neutralized_ddl/criar_schema.cjs.txt' },
  { n: 'criar_tabelas.cjs', kind: 'A4', arch: 'docs/lab/neutralized_ddl/criar_tabelas.cjs.txt' },
];
const rows = [];
for (const f of FILES) {
  const raw = fs.existsSync(path.join(ROOT, f.n)) ? fs.readFileSync(path.join(ROOT, f.n), 'utf8') : null;
  const code = raw ? codeOnly(raw) : '';
  const archRaw = fs.existsSync(path.join(ROOT, f.arch)) ? fs.readFileSync(path.join(ROOT, f.arch), 'utf8') : null;
  rows.push({ n: f.n, kind: f.kind, exists: !!raw, codeEmpty: code.length === 0, stubSecret: raw ? SECRET.test(raw) : true, stubExec: EXEC.test(code), arch: !!archRaw, archSecret: archRaw ? SECRET.test(archRaw) : true });
}
// refs
function walk(d, acc) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else if (/\.(ts|tsx|js|cjs|mjs)$/.test(e.name)) acc.push(p); } return acc; }
const codeFiles = walk(path.join(ROOT, 'src'), []).concat(walk(path.join(ROOT, 'scripts'), []));
const importRefs = [];
for (const p of codeFiles) { const t = fs.readFileSync(p, 'utf8'); if (/(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'][^"']*(?:query_sql|check_types|criar_schema|criar_tabelas)["']/.test(t)) importRefs.push(path.relative(ROOT, p)); }
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
const pkgRefs = /query_sql|check_types|criar_schema|criar_tabelas/.test(pkg);

// consolidado
const labA1 = ['test-cliente.ts','test-end2.ts','test-endereco.ts','test-financeiro.ts','test-os.ts','test-os2.ts','test-pagar.ts','test-pf-final.ts','test-prestador.ts','test-vinculo.ts','test-upload-final.cjs','teste_completo.cjs','teste_fluxo_mapbox.cjs','teste_os.cjs','teste_pgto_completo.cjs','test_mapbox_valor.cjs','test_pagamento.cjs','validar_pagamento.cjs','test_os_p2.mjs','test_os_p3.mjs','valida.ts','valida_crud.ts','valida_status.ts'];
let a1 = 0; for (const n of labA1) { const p = path.join(ROOT, 'scripts', 'lab', n); if (fs.existsSync(p) && /guardHarness/.test(fs.readFileSync(p, 'utf8'))) a1++; }
const a2 = ['criar_tabela_valores.cjs','criar_todas.cjs','forcar_create.cjs','refresh.cjs','criar_tabela.cjs','test_doc.cjs'];
let a2n = 0; for (const n of a2) { const p = path.join(ROOT, n); if (fs.existsSync(p) && codeOnly(fs.readFileSync(p, 'utf8')).length === 0) a2n++; }
const a3 = rows.filter(r => r.kind === 'A3' && r.codeEmpty && !r.stubSecret && r.arch && !r.archSecret).length;
const a4 = rows.filter(r => r.kind === 'A4' && r.codeEmpty && !r.stubSecret && r.arch && !r.archSecret).length;

const failed = rows.filter(r => !(r.exists && r.codeEmpty && !r.stubSecret && !r.stubExec && r.arch && !r.archSecret));
const ok = failed.length === 0 && importRefs.length === 0 && !pkgRefs && a1 === 23 && a2n === 6 && a3 === 2 && a4 === 2;
const pad = (s, n) => String(s).padEnd(n);
console.log('===============================================================');
console.log(' VERIFICACAO 04D3C3D — A3/A4 + consolidado');
console.log('===============================================================');
console.log(pad('ARQUIVO', 20) + pad('KIND', 5) + pad('CODE=0', 8) + pad('STUB_SEC', 10) + pad('STUB_EXEC', 10) + pad('ARCH', 6) + 'ARCH_SEC');
for (const r of rows) console.log(pad(r.n, 20) + pad(r.kind, 5) + pad(r.codeEmpty, 8) + pad(r.stubSecret, 10) + pad(r.stubExec, 10) + pad(r.arch, 6) + r.archSecret);
console.log('\nimport refs src/scripts: ' + (importRefs.length === 0 ? 'PASS' : 'FAIL ' + importRefs.join(',')) + ' | package.json: ' + (pkgRefs ? 'FAIL' : 'PASS'));
console.log('\nCONSOLIDADO 33 writers: A1=' + a1 + '/23 | A2=' + a2n + '/6 | A3=' + a3 + '/2 | A4=' + a4 + '/2 | TOTAL=' + (a1 + a2n + a3 + a4) + '/33');
console.log('RESULTADO: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
