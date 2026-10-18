// TMS-FIN-DATA-04D1 — tipos do guard central (scripts/_guard.cjs).
// Uso TS/tsx: import { guardTestWrite, avaliarTestWrite } from "./_guard.mjs";

export const PROD_REF: string;
export const QA_REF: string;
export const ALLOW_TEST_WRITES_FLAG: string;

export interface AmbienteInfo {
  urlRef: string | null;
  dbRef: string | null;
  declared: string;
  ref: string | null;
}

export interface AvaliacaoTestWrite {
  bloqueado: boolean;
  motivo: string[];
  tipo: "prod" | "qa" | "unknown" | "absent";
  ref: string | null;
  optIn: boolean;
  declared: string;
  acao: string;
}

export type EnvLike = Record<string, string | undefined>;

export function refFromUrl(url: string): string | null;
export function refFromDatabaseUrl(db: string): string | null;
export function tipoFromRef(ref: string | null): "prod" | "qa" | "unknown" | "absent";
export function detectAmbiente(env?: EnvLike): AmbienteInfo;
export function avaliarTestWrite(acao?: string, env?: EnvLike): AvaliacaoTestWrite;
export function guardTestWrite(acao?: string, env?: EnvLike): AvaliacaoTestWrite;
export function canTestWrite(acao?: string, env?: EnvLike): boolean;
export function loadHarnessEnv(baseDir?: string): "qa" | "env" | "none";
export function guardHarness(nome?: string, opts?: { loadEnv?: boolean; baseDir?: string }): AvaliacaoTestWrite & { envSource: string | null };

declare const guard: {
  PROD_REF: typeof PROD_REF;
  QA_REF: typeof QA_REF;
  ALLOW_TEST_WRITES_FLAG: typeof ALLOW_TEST_WRITES_FLAG;
  refFromUrl: typeof refFromUrl;
  refFromDatabaseUrl: typeof refFromDatabaseUrl;
  tipoFromRef: typeof tipoFromRef;
  detectAmbiente: typeof detectAmbiente;
  avaliarTestWrite: typeof avaliarTestWrite;
  guardTestWrite: typeof guardTestWrite;
  canTestWrite: typeof canTestWrite;
};
export default guard;
