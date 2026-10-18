// TMS-FIN-DATA-04D1 — smoke ESM do guard (sem rede/banco). Uso: node scripts/_guard.smoke.mjs
import guard, { avaliarTestWrite, canTestWrite } from './_guard.mjs';

const PROD_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const QA_URL = 'https://aqpfayildtcnrkfeeyjg.supabase.co';

const prod = avaliarTestWrite('smoke prod', { VITE_SUPABASE_URL: PROD_URL, ENVIRONMENT: 'production', ALLOW_TEST_WRITES: 'true' });
const qa = canTestWrite('smoke qa', { VITE_SUPABASE_URL: QA_URL, ENVIRONMENT: 'qa', ALLOW_TEST_WRITES: 'true' });
const def = guard.avaliarTestWrite('smoke default', {});

console.log('ESM default import:', typeof guard === 'object' && typeof guard.guardTestWrite === 'function');
console.log('ESM named import:', typeof avaliarTestWrite === 'function' && typeof canTestWrite === 'function');
console.log('ESM prodBloqueado:', prod.bloqueado);
console.log('ESM qaPermite:', qa);
console.log('ESM ausenteBloqueia:', def.bloqueado);
const ok = prod.bloqueado === true && qa === true && def.bloqueado === true;
console.log('ESM RESULTADO:', ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
