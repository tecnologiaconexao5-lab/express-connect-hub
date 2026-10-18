/**
 * Assert QA Environment — Guard reutilizável
 *
 * Uso:
 *   import { assertQAEnvironment } from "./assert-qa-environment";
 *   assertQAEnvironment();
 *
 * Falha com erro se detectar produção.
 * Use no início de scripts de teste/seed/manutenção QA.
 */

const PRODUCTION_PROJECT_REF = "uwrvzsjtpgaifkktpepn";
const PRODUCTION_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;

export function assertQAEnvironment(): void {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const envName = process.env.ENVIRONMENT || process.env.NODE_ENV || "";
  const isProduction =
    supabaseUrl.includes(PRODUCTION_PROJECT_REF) ||
    supabaseUrl === PRODUCTION_URL;

  if (isProduction) {
    throw new Error(
      `[GUARD] BLOQUEADO — Ambiente PRODUÇÃO detectado!\n` +
      `  URL: ${supabaseUrl.slice(0, 40)}...\n` +
      `  ENVIRONMENT: ${envName}\n` +
      `  Project Ref: ${PRODUCTION_PROJECT_REF}\n` +
      `  Este script só pode rodar em QA. Abortando.`
    );
  }

  if (!envName || envName === "production") {
    console.warn(
      `[GUARD] AVISO: ENVIRONMENT não definido ou = production.\n` +
      `  Defina ENVIRONMENT=qa ou ENVIRONMENT=local para confirmar.`
    );
  }

  const projectRef = extractProjectRef(supabaseUrl);
  console.log(
    `[GUARD] QA OK — Ambiente: ${envName || "não especificado"}\n` +
    `  Project Ref: ${projectRef || "não detectado"}\n` +
    `  Certifique-se de que este é o ambiente correto.`
  );
}

function extractProjectRef(url: string): string | null {
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}

// Execução direta
if (require.main === module) {
  assertQAEnvironment();
  console.log("[GUARD] PASS — Ambiente seguro para operação QA.");
}
