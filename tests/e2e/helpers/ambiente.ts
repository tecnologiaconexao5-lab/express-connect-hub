// ============================================================
// Ambiente Helper — Proteção de Ambiente para Playwright
// ============================================================
// Uso: import { verificarAmbiente } from "./helpers/ambiente";
//       verificarAmbiente(); // bloqueia em producao
// ============================================================

const SUPABASE_PROD_REF = "uwrvzsjtpgaifkktpepn";
const SUPABASE_QA_REF = "aqpfayildtcnrkfeeyjg";

export interface AmbienteInfo {
  nome: "producao" | "qa" | "development" | "desconhecido";
  ref: string;
  url: string;
  modo: string;
}

export function detectarAmbiente(): AmbienteInfo {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const envVar = (process.env.ENVIRONMENT || "").toLowerCase();
  const mode = (process.env.VITE_MODE || process.env.npm_lifecycle_event || "").toLowerCase();

  if (envVar === "qa" || mode.includes("qa")) {
    return { nome: "qa", ref: SUPABASE_QA_REF, url: supabaseUrl || `https://${SUPABASE_QA_REF}.supabase.co`, modo: "qa" };
  }

  if (envVar === "development" || mode.includes("development") || mode.includes("dev")) {
    return { nome: "development", ref: SUPABASE_PROD_REF, url: supabaseUrl || `https://${SUPABASE_PROD_REF}.supabase.co`, modo: "development" };
  }

  if (supabaseUrl.includes(SUPABASE_QA_REF)) {
    return { nome: "qa", ref: SUPABASE_QA_REF, url: supabaseUrl, modo: "qa" };
  }

  if (supabaseUrl.includes(SUPABASE_PROD_REF)) {
    return { nome: "producao", ref: SUPABASE_PROD_REF, url: supabaseUrl, modo: "producao" };
  }

  return { nome: "desconhecido", ref: "?", url: supabaseUrl || "nao configurado", modo: mode || "desconhecido" };
}

export function verificarAmbiente(): void {
  const amb = detectarAmbiente();

  console.log("");
  console.log("=".repeat(60));
  console.log("  TESTE E2E — VERIFICACAO DE AMBIENTE");
  console.log("=".repeat(60));
  console.log(`  Ambiente  : ${amb.nome.toUpperCase()}`);
  console.log(`  Project   : ${amb.ref}`);
  console.log(`  URL       : ${amb.url}`);
  console.log(`  Modo      : ${amb.modo}`);
  console.log("=".repeat(60));

  if (amb.nome === "producao") {
    const msg = [
      "",
      "=".repeat(60),
      "  🚫 PRODUCAO DETECTADA.",
      "  🚫 EXECUCAO BLOQUEADA.",
      "",
      "  Testes E2E nao podem ser executados em producao.",
      "  Crie um ambiente de QA/desenvolvimento antes de testar.",
      "",
      "  Bypass via PLAYWRIGHT_QA removido (R6 fix).",
      "=".repeat(60),
      "",
    ].join("\n");
    throw new Error(msg);
  }

  console.log(`  ✅ Ambiente seguro para testes (${amb.nome}).\n`);
}

export function estaEmProducao(): boolean {
  return detectarAmbiente().nome === "producao";
}
