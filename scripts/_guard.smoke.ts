// TMS-FIN-DATA-04D1 — smoke TS/tsx do guard (sem rede/banco).
// Uso: npx tsx scripts/_guard.smoke.ts
import guard, { avaliarTestWrite, canTestWrite, type AvaliacaoTestWrite } from './_guard.mjs';

const PROD_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const QA_URL = 'https://aqpfayildtcnrkfeeyjg.supabase.co';

const prod: AvaliacaoTestWrite = avaliarTestWrite('ts prod', { VITE_SUPABASE_URL: PROD_URL, ENVIRONMENT: 'production', ALLOW_TEST_WRITES: 'true' });
const qa: boolean = canTestWrite('ts qa', { VITE_SUPABASE_URL: QA_URL, ENVIRONMENT: 'qa', ALLOW_TEST_WRITES: 'true' });
const def: AvaliacaoTestWrite = guard.avaliarTestWrite('ts default', {});

console.log('TS default import:', typeof guard.guardTestWrite === 'function');
console.log('TS prodBloqueado:', prod.bloqueado);
console.log('TS qaPermite:', qa);
console.log('TS ausenteBloqueia:', def.bloqueado);
const ok = prod.bloqueado === true && qa === true && def.bloqueado === true;
console.log('TS RESULTADO:', ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
