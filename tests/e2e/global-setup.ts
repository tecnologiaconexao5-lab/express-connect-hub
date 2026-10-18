// ============================================================
// Global Setup — Playwright
// ============================================================
// Executado UMA vez antes de todos os testes.
// Bloqueia execucao se o ambiente for PRODUCAO.
// ============================================================
import { verificarAmbiente } from "./helpers/ambiente";

async function globalSetup() {
  console.log("\n[GLOBAL SETUP] Verificando ambiente...");
  verificarAmbiente();
  console.log("[GLOBAL SETUP] Ambiente OK. Iniciando testes...\n");
}

export default globalSetup;
