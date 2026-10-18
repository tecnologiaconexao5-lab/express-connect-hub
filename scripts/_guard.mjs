// TMS-FIN-DATA-04D1 — wrapper ESM do guard central (scripts/_guard.cjs).
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('./_guard.cjs');

export const PROD_REF = guard.PROD_REF;
export const QA_REF = guard.QA_REF;
export const ALLOW_TEST_WRITES_FLAG = guard.ALLOW_TEST_WRITES_FLAG;
export const refFromUrl = guard.refFromUrl;
export const refFromDatabaseUrl = guard.refFromDatabaseUrl;
export const tipoFromRef = guard.tipoFromRef;
export const detectAmbiente = guard.detectAmbiente;
export const avaliarTestWrite = guard.avaliarTestWrite;
export const guardTestWrite = guard.guardTestWrite;
export const canTestWrite = guard.canTestWrite;
export const loadHarnessEnv = guard.loadHarnessEnv;
export const guardHarness = guard.guardHarness;

export default guard;
