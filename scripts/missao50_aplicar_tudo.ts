// ============================================================
// SCRIPT: MISSAO 50 — Aplicar Migration + Seed em Sequencia
// ============================================================
// Aplica a migration 20260728_missao50_auth_real.sql via pg
// e em seguida roda o seed de usuarios corporativos.
//
// REQUISITOS:
//   - DATABASE_URL no .env (postgresql://postgres.[ref]:[senha]@aws-0-[regiao].pooler.supabase.com:6543/postgres)
//   - SUPABASE_SERVICE_ROLE_KEY no .env
//
// EXECUCAO:
//   npx tsx scripts/missao50_aplicar_tudo.ts
//
// SENHAS: usa os placeholders da Missao 50. Substituir manualmente
//         no Supabase Studio ou via "Esqueci minha senha".
// ============================================================

import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!DATABASE_URL) {
  console.error("ERRO: DATABASE_URL nao definido no .env");
  console.error("Formato: postgresql://postgres.[ref]:[senha]@aws-0-[regiao].pooler.supabase.com:6543/postgres");
  console.error("Obtenha em: Supabase Dashboard > Settings > Database > Connection string > Transaction mode");
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error("ERRO: SUPABASE_SERVICE_ROLE_KEY nao definido no .env");
  console.error("Obtenha em: Supabase Dashboard > Settings > API > service_role key");
  process.exit(1);
}

const migrationFile = resolve(process.cwd(), "supabase/migrations/20260728_missao50_auth_real.sql");
if (!existsSync(migrationFile)) {
  console.error(`ERRO: arquivo de migration nao encontrado: ${migrationFile}`);
  process.exit(1);
}

console.log("========================================");
console.log("MISSAO 50 - APLICAR MIGRATION + SEED");
console.log("========================================\n");

console.log("ETAPA 1/2: Aplicar migration via pg...\n");
const pgResult = spawnSync("node", ["scripts/apply-migration-pg.mjs", DATABASE_URL], {
  stdio: "inherit",
  cwd: process.cwd(),
});

if (pgResult.status !== 0) {
  console.error("\nFalha ao aplicar migration.");
  process.exit(1);
}

console.log("\nETAPA 2/2: Criar usuarios corporativos via Supabase Auth...\n");
const seedResult = spawnSync("npx", ["tsx", "scripts/missao50_seed_auth_real.ts"], {
  stdio: "inherit",
  cwd: process.cwd(),
});

if (seedResult.status !== 0) {
  console.error("\nFalha ao executar seed.");
  process.exit(1);
}

console.log("\n========================================");
console.log("MISSAO 50 CONCLUIDA COM SUCESSO");
console.log("========================================");
console.log("\nProximos passos:");
console.log("  1. Supabase Studio > Authentication > Users");
console.log("  2. Para cada usuario, clicar em 'Send recovery email'");
console.log("  3. Ou trocar a senha manualmente em '...' menu > Reset password");
console.log("  4. Testar login em http://localhost:8800/login\n");
