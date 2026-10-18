// ============================================================
// SCRIPT: MISSAO 50.2 - Verificacao da Fundacao Auth
// ============================================================
// Verifica (somente leitura, via REST API + anon key) se o
// banco esta pronto para a Missao 50 criar os 5 usuarios.
//
// NAO requer SUPABASE_SERVICE_ROLE_KEY.
// NAO requer DATABASE_URL.
// NAO faz alteracoes - apenas le.
//
// EXECUCAO: npx tsx scripts/missao50_verificar_fundacao_auth.ts
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error("ERRO: VITE_SUPABASE_ANON_KEY nao definido no .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface CheckResult {
  nome: string;
  existe: boolean;
  detalhes: string;
  obrigatoria: boolean;
  nota: string;
}

async function tabelaExiste(nome: string): Promise<boolean> {
  const { error } = await supabase.from(nome).select("id").limit(1);
  if (!error) return true;
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("pgrst205") || msg.includes("does not exist") || msg.includes("could not find")) {
    return false;
  }
  if (msg.includes("permission denied") || msg.includes("42501")) {
    return true;
  }
  return false;
}

async function colunaExiste(tabela: string, coluna: string): Promise<boolean> {
  const { error } = await supabase.from(tabela).select(coluna).limit(1);
  if (!error) return true;
  const msg = (error.message || "");
  if (msg.includes("42703") || msg.toLowerCase().includes("does not exist")) {
    return false;
  }
  return true;
}

async function contarLinhas(tabela: string): Promise<number> {
  const { count, error } = await supabase.from(tabela).select("id", { count: "exact", head: true });
  if (error) return -1;
  return count || 0;
}

async function checarFuncaoRPC(nome: string): Promise<boolean> {
  const { error } = await supabase.rpc(nome as any);
  if (!error) return true;
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("404") || msg.includes("could not find") || msg.includes("does not exist") || msg.includes("pgrst202")) {
    return false;
  }
  return true;
}

function fmt(check: CheckResult): string {
  const flag = check.existe ? "[OK]" : (check.obrigatoria ? "[FALTA]" : "[INFO]");
  const color = check.existe ? "\x1b[32m" : (check.obrigatoria ? "\x1b[31m" : "\x1b[33m");
  const reset = "\x1b[0m";
  return `  ${color}${flag}${reset} ${check.nome.padEnd(30)} ${check.detalhes.padEnd(20)} ${check.nota}`;
}

async function main() {
  console.log("\n========================================");
  console.log("MISSAO 50.2 - VERIFICACAO DA FUNDACAO AUTH");
  console.log("========================================\n");
  console.log("Projeto:", SUPABASE_URL);
  console.log("Modo: somente leitura via REST API\n");

  const checks: CheckResult[] = [];

  // ==========================================================
  // 1. Tabelas criticas para Missao 50
  // ==========================================================
  console.log("--- 1. TABELAS CRITICAS (Missao 50) ---\n");

  const tenantsExiste = await tabelaExiste("tenants");
  checks.push({ nome: "tenants", existe: tenantsExiste, detalhes: "", obrigatoria: true, nota: "Base multi-tenant" });

  const tenantUsuariosExiste = await tabelaExiste("tenant_usuarios");
  checks.push({ nome: "tenant_usuarios", existe: tenantUsuariosExiste, detalhes: "", obrigatoria: true, nota: "Vinculo user x tenant" });

  const perfisExiste = await tabelaExiste("perfis_permissoes");
  checks.push({ nome: "perfis_permissoes", existe: perfisExiste, detalhes: "", obrigatoria: true, nota: "Matriz papel x modulo" });

  const agentesExiste = await tabelaExiste("agentes_ia_internos");
  checks.push({ nome: "agentes_ia_internos", existe: agentesExiste, detalhes: "", obrigatoria: true, nota: "Funcionarios IA sem login" });

  const auditoriaExiste = await tabelaExiste("auth_eventos_auditoria");
  checks.push({ nome: "auth_eventos_auditoria", existe: auditoriaExiste, detalhes: "", obrigatoria: true, nota: "Log login/logout/falhas" });

  // ==========================================================
  // 2. Conteudos esperados
  // ==========================================================
  console.log("--- 2. CONTEUDOS ESPERADOS ---\n");

  if (tenantsExiste) {
    const count = await contarLinhas("tenants");
    checks.push({ nome: "tenants (rows)", existe: count > 0, detalhes: `${count} rows`, obrigatoria: true, nota: "Tenant padrao Conexao Express" });
  }

  if (perfisExiste) {
    const count = await contarLinhas("perfis_permissoes");
    checks.push({ nome: "perfis_permissoes (rows)", existe: count >= 70, detalhes: `${count} rows`, obrigatoria: true, nota: "Esperado >= 70 permissoes" });
  }

  if (agentesExiste) {
    const count = await contarLinhas("agentes_ia_internos");
    checks.push({ nome: "agentes_ia_internos (rows)", existe: count >= 5, detalhes: `${count} rows`, obrigatoria: true, nota: "Esperado 5 agentes IA" });
  }

  // ==========================================================
  // 3. Colunas adicionais em automacoes_robos
  // ==========================================================
  console.log("--- 3. COLUNAS EM automacoes_robos ---\n");

  const isAgente = await colunaExiste("automacoes_robos", "is_agente_interno");
  checks.push({ nome: "automacoes_robos.is_agente_interno", existe: isAgente, detalhes: "", obrigatoria: false, nota: "Flag de agente interno" });

  const agenteId = await colunaExiste("automacoes_robos", "agente_interno_id");
  checks.push({ nome: "automacoes_robos.agente_interno_id", existe: agenteId, detalhes: "", obrigatoria: false, nota: "FK para agentes_ia_internos" });

  // ==========================================================
  // 4. Funcoes auxiliares
  // ==========================================================
  console.log("--- 4. FUNCOES AUXILIARES ---\n");

  const getTid = await checarFuncaoRPC("get_current_tenant_id");
  checks.push({ nome: "get_current_tenant_id()", existe: getTid, detalhes: "", obrigatoria: false, nota: "Tenant context" });

  const hasTid = await checarFuncaoRPC("user_has_tenant_access");
  checks.push({ nome: "user_has_tenant_access()", existe: hasTid, detalhes: "", obrigatoria: false, nota: "Verifica acesso" });

  // ==========================================================
  // 5. Tabelas de negocio (informativo)
  // ==========================================================
  console.log("--- 5. TABELAS DE NEGOCIO (informativo) ---\n");

  for (const t of ["clientes", "prestadores", "ordens_servico", "automacoes_robos"]) {
    const existe = await tabelaExiste(t);
    checks.push({ nome: t, existe: existe, detalhes: "", obrigatoria: false, nota: "Tabela de negocio" });
  }

  // ==========================================================
  // RELATORIO
  // ==========================================================
  console.log("\n--- RELATORIO ---\n");

  for (const check of checks) {
    console.log(fmt(check));
  }

  // Veredito
  const criticasFaltando = checks.filter(c => c.obrigatoria && !c.existe);
  const totalCriticas = checks.filter(c => c.obrigatoria).length;
  const criticasOK = totalCriticas - criticasFaltando.length;

  console.log("\n========================================");
  console.log("VEREDITO");
  console.log("========================================\n");
  console.log(`Tabelas criticas OK:     ${criticasOK} / ${totalCriticas}`);
  console.log(`Tabelas criticas FALTANDO: ${criticasFaltando.length}`);

  if (criticasFaltando.length === 0) {
    console.log("\n\x1b[32m>>> SUPABASE PRONTO PARA CRIAR USUARIOS AUTH <<<\x1b[0m");
    console.log("\nProximos passos:");
    console.log("  1. Supabase Dashboard > Authentication > Users");
    console.log("  2. Add user > Create new user (com auto confirm)");
    console.log("  3. Para cada um dos 5 usuarios:");
    console.log("     - tamiris.castilho@conexaoexpress.com.br  (super_admin)");
    console.log("     - financeiro@conexaoexpress.com.br        (financeiro)");
    console.log("     - comercial@conexaoexpress.com.br         (comercial)");
    console.log("     - operacional@conexaoexpress.com.br       (operacional)");
    console.log("     - contato@conexaoexpress.com.br           (atendimento)");
    console.log("  4. Menu ... > Send recovery email para cada");
    console.log("  5. SQL Editor: rodar o INSERT em tenant_usuarios");
  } else {
    console.log("\n\x1b[31m>>> SUPABASE AINDA INCONSISTENTE - NAO CRIAR USUARIOS <<<\x1b[0m");
    console.log("\nFaltam as seguintes tabelas/funcoes criticas:");
    criticasFaltando.forEach(c => console.log(`  - ${c.nome} (${c.nota})`));
    console.log("\nAcao necessaria:");
    console.log("  1. Abrir: https://supabase.com/dashboard/project/uwrvzsjtpgaifkktpepn/sql");
    console.log("  2. Nova query > Colar: supabase/migrations/20260728000051_missao50_fundacao_auth_tenant.sql");
    console.log("  3. Nova query > Colar: supabase/migrations/20260728000050_missao50_auth_real.sql");
    console.log("  4. Nova query > Colar: supabase/migrations/20260728000052_missao50_auth_real_hotfix.sql");
    console.log("  5. Re-executar este script para confirmar");
  }
  console.log("");
}

main().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
