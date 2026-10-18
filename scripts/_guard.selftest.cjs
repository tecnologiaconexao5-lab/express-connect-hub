'use strict';
// TMS-FIN-DATA-04D1 — Self-test do guard central. NAO conecta a rede/banco.
// Executar: node scripts/_guard.selftest.cjs
const fs = require('fs');
const path = require('path');
const guard = require('./_guard.cjs');

const QA_URL = 'https://aqpfayildtcnrkfeeyjg.supabase.co';
const PROD_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const UNKNOWN_URL = 'https://zzzzunknownref.supabase.co';
const QA_DB = 'postgresql://postgres.aqpfayildtcnrkfeeyjg:SENHA_FAKE_QA@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const PROD_DB = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:SENHA_FAKE_PROD@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const FAKE_ANON = 'eyJFAKE_ANON_KEY_VALUE_NAO_E_SEGREDO_REAL';
const FAKE_SERVICE = 'SERVICE_ROLE_FAKE_VALUE_9999';

const results = [];
function check(id, desc, env, expectBlocked) {
  const r = guard.avaliarTestWrite('teste ' + id, env);
  const ok = r.bloqueado === expectBlocked;
  results.push({ id, desc, esperado: expectBlocked ? 'BLOQUEIA' : 'PERMITE', obtido: r.bloqueado ? 'BLOQUEIA' : 'PERMITE', ok, motivo: r.motivo.join(' ; ') });
  // T9 — nenhuma mensagem pode conter segredo
  const msg = r.motivo.join(' ; ');
  const vazou = msg.includes('SENHA_FAKE_QA') || msg.includes('SENHA_FAKE_PROD') || msg.includes(FAKE_ANON) || msg.includes(FAKE_SERVICE) || /service_role/i.test(msg);
  if (vazou) results.push({ id: id + '-leak', desc: 'nao expor segredo', esperado: 'sem segredo', obtido: 'VAZOU', ok: false, motivo: msg });
  return r;
}

// T1 QA + ALLOW=true => PERMITE
check('T1', 'QA + ALLOW_TEST_WRITES=true', { VITE_SUPABASE_URL: QA_URL, ENVIRONMENT: 'qa', ALLOW_TEST_WRITES: 'true', SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE, DATABASE_URL: QA_DB, VITE_SUPABASE_ANON_KEY: FAKE_ANON }, false);
// T2 QA sem opt-in => BLOQUEIA
check('T2', 'QA sem ALLOW_TEST_WRITES', { VITE_SUPABASE_URL: QA_URL, ENVIRONMENT: 'qa' }, true);
// T3 PROD sem opt-in => BLOQUEIA
check('T3', 'PROD sem opt-in', { VITE_SUPABASE_URL: PROD_URL, ENVIRONMENT: 'production' }, true);
// T4 PROD + ALLOW=true => CONTINUA BLOQUEANDO
check('T4', 'PROD + ALLOW_TEST_WRITES=true', { VITE_SUPABASE_URL: PROD_URL, ENVIRONMENT: 'production', ALLOW_TEST_WRITES: 'true', SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE, DATABASE_URL: PROD_DB }, true);
// T5 environment=qa + URL PROD => BLOQUEIA
check('T5', 'ENVIRONMENT=qa + URL PROD', { VITE_SUPABASE_URL: PROD_URL, ENVIRONMENT: 'qa', ALLOW_TEST_WRITES: 'true' }, true);
// T6 environment=prod + URL QA => BLOQUEIA
check('T6', 'ENVIRONMENT=prod + URL QA', { VITE_SUPABASE_URL: QA_URL, ENVIRONMENT: 'production', ALLOW_TEST_WRITES: 'true' }, true);
// T7 URL desconhecida => BLOQUEIA
check('T7', 'URL desconhecida', { VITE_SUPABASE_URL: UNKNOWN_URL, ENVIRONMENT: 'qa', ALLOW_TEST_WRITES: 'true' }, true);
// T8 variaveis ausentes => BLOQUEIA (dois cenarios)
check('T8a', 'env vazio', {}, true);
check('T8b', 'sem URL (apenas flags)', { ENVIRONMENT: 'qa', ALLOW_TEST_WRITES: 'true' }, true);
// T10 contradicao URL/DB => BLOQUEIA
check('T10', 'URL QA + DATABASE_URL PROD', { VITE_SUPABASE_URL: QA_URL, DATABASE_URL: PROD_DB, ENVIRONMENT: 'qa', ALLOW_TEST_WRITES: 'true' }, true);
// QA via DATABASE_URL (sem VITE url) + opt-in => PERMITE
check('T11', 'QA via DATABASE_URL + opt-in', { DATABASE_URL: QA_DB, ENVIRONMENT: 'qa', ALLOW_TEST_WRITES: 'true' }, false);

// guardTestWrite lanca com codigo correto em PROD
let threw = false, code = null;
try { guard.guardTestWrite('harness X', { VITE_SUPABASE_URL: PROD_URL, ENVIRONMENT: 'production' }); }
catch (e) { threw = true; code = e.code; }
results.push({ id: 'T-LANC', desc: 'guardTestWrite lanca GUARD_BLOCKED em PROD', esperado: 'lanca GUARD_BLOCKED', obtido: threw ? code : 'nao lancou', ok: threw && code === 'GUARD_BLOCKED', motivo: '' });

// T9b + prova de pureza: fonte do guard nao acessa rede/banco
const src = fs.readFileSync(path.join(__dirname, '_guard.cjs'), 'utf8');
const banned = [/createClient/, /require\(['"]pg['"]\)/, /\bfetch\s*\(/, /https?\.request/, /\.insert\s*\(/, /INSERT\s+INTO/i, /child_process/];
const viol = banned.filter(re => re.test(src)).map(String);
results.push({ id: 'T-PURO', desc: 'guard sem rede/banco/insert/spawn', esperado: '0 violacoes', obtido: viol.length ? viol.join(',') : '0', ok: viol.length === 0, motivo: '' });

// Relatorio
const pad = (s, n) => String(s).padEnd(n);
console.log('=================================================================');
console.log(' GUARD FAIL-CLOSED — SELF-TEST (T1..T11)  [sem conexao PROD]');
console.log('=================================================================');
console.log(pad('ID', 7) + pad('CENARIO', 40) + pad('ESPERADO', 16) + pad('OBTIDO', 16) + 'OK');
for (const r of results) {
  console.log(pad(r.id, 7) + pad(r.desc, 40) + pad(r.esperado, 16) + pad(r.obtido, 16) + (r.ok ? 'PASS' : 'FAIL'));
}
const failed = results.filter(r => !r.ok);
console.log('-----------------------------------------------------------------');
console.log(`TOTAL ${results.length} | PASS ${results.length - failed.length} | FAIL ${failed.length}`);
if (failed.length) { console.log('\nDETALHES DE FALHA:'); failed.forEach(f => console.log(' - ' + f.id + ': ' + f.motivo)); process.exit(1); }
console.log('RESULTADO: PASS (nenhuma conexao/escrita PROD; nenhum segredo exposto).');
process.exit(0);
