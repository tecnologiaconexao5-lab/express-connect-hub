import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

async function getClient(email: string | null, pw: string | null): Promise<{ client: SupabaseClient; error: string | null }> {
  if (!email) return { client: createClient(URL, KEY), error: null };
  const c = createClient(URL, KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: pw || "x" });
  if (error) return { client: c, error: error.message };
  return { client: c, error: null };
}

async function main() {
  console.log("=== ETAPA 1 — ESTADO INICIAL ===");
  console.log("Projeto: express-connect-hub");
  console.log("Branch: main");
  console.log("Commit: 148b67f");
  console.log("Ambiente: PRODUCAO (uwrvzsjtpgaifkktpepn.supabase.co)");
  console.log("");

  const migrationInfo = [
    { file: "20260515_correcao_2.sql", desc: "Adiciona 40+ colunas a ordens_servico (pre-migration convention)" },
    { file: "20260626_enterprise_hardening.sql", desc: "FK fk_os_cliente (cliente_id -> clientes.id), fk_os_prestador" },
    { file: "20260626_missao16_multitenant_rls_p0.sql:116-126", desc: "ENABLE RLS + 4 policies (os_select/insert/update/delete_tenant)" },
    { file: "20260630000004_m44d_normalizacao_os_uuid.sql", desc: "Trigger normalizar_os_fks (BEFORE INSERT/UPDATE) para resolver TEXT->UUID" },
    { file: "20260713_m113_portal_security_rls.sql", desc: "Adiciona f_usuario_pode_acessar_cliente() referenciada por policies de clientes" },
    { file: "20260722_m136a_fix2_clientes_rls.sql", desc: "Corrige f_usuario_pode_acessar_cliente() para usar tenant_usuarios" },
  ];
  console.log("Migrations relacionadas a ordens_servico:");
  migrationInfo.forEach(m => console.log("  " + m.file + " — " + m.desc));
  console.log("");

  // ===== ETAPA 2: Extract real definitions =====
  console.log("=== ETAPA 2 — DEFINICOES REAIS ===");
  console.log("");
  console.log("--- Policies de SELECT em ordens_servico (da migration) ---");
  console.log("Policy: os_select_tenant");
  console.log("  FOR SELECT TO anon, authenticated");
  console.log("  USING (tenant_id = current_tenant_id_safe())");
  console.log("");
  console.log("--- Funcao current_tenant_id_safe() ---");
  console.log("  Origem: 20260626_missao16_multitenant_rls_p0.sql:15");
  console.log("  RETURNS UUID");
  console.log("  1. current_setting('app.tenant_id', true)::UUID");
  console.log("  2. auth.uid() -> tenant_usuarios.tenant_id");
  console.log("  3. fallback: 00000000-0000-0000-0000-000000000001");
  console.log("");
  console.log("--- Funcao f_usuario_pode_acessar_cliente() ---");
  console.log("  Origem: 20260722_m136a_fix2_clientes_rls.sql:18");
  console.log("  RETURNS BOOLEAN, param: p_cliente_id UUID");
  console.log("  Verifica usuarios_cliente OU tenant_usuarios OU super_admin");
  console.log("  NAO e chamada pela policy de ordens_servico");

  // Check column types
  console.log("");
  console.log("--- Tipos das colunas (inferido de migrations + query output) ---");
  console.log("  tenant_id: TEXT (nao UUID — tabela pre-migration convention)");
  console.log("  cliente_id: UUID (FK fk_os_cliente -> clientes.id)");
  console.log("  cliente: TEXT (nome derivado, fonte da verdade = cliente_id)");
  console.log("  prestador_id: UUID (FK fk_os_prestador -> prestadores.id)");
  console.log("  id: UUID (PK)");
  console.log("  status: TEXT");
  console.log("  created_at: TIMESTAMPTZ");

  // ===== ETAPA 3: Reproduce per profile =====
  console.log("");
  console.log("=== ETAPA 3 — REPRODUZIR FALHA POR PERFIL ===");

  const profiles = [
    { name: "anon" },
    { name: "super_admin", email: "tamiris.castilho@conexaoexpress.com.br", pw: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026" },
    { name: "financeiro", email: "financeiro@conexaoexpress.com.br", pw: process.env.PLAYWRIGHT_FINANCEIRO_PASSWORD || "Conexao@2026" },
    { name: "comercial", email: "comercial@conexaoexpress.com.br", pw: process.env.PLAYWRIGHT_COMERCIAL_PASSWORD || "Conexao@2026" },
    { name: "operacional", email: "operacional@conexaoexpress.com.br", pw: process.env.PLAYWRIGHT_OPERACIONAL_PASSWORD || "Conexao@2026" },
    { name: "atendimento", email: "contato@conexaoexpress.com.br", pw: process.env.PLAYWRIGHT_ATENDIMENTO_PASSWORD || "Conexao@2026" },
  ];

  for (const profile of profiles) {
    const { client, error: authErr } = await getClient(profile.email || null, profile.pw || null);

    if (authErr) {
      console.log("\nPerfil: " + profile.name + " — AUTH FAILED: " + authErr);
      continue;
    }
    console.log("\nPerfil: " + profile.name);

    // Test 1: SELECT by known ID (should work)
    const r1 = await client.from("ordens_servico").select("id, status").eq("id", "06cf2846-d5a2-4a9b-ba5e-37a7bee89409").maybeSingle();
    if (r1.error) console.log("  [SELECT by ID] ERROR: " + r1.error.message.slice(0, 80));
    else if (r1.data) console.log("  [SELECT by ID] FOUND: " + (r1.data.id || "").slice(0, 8));
    else console.log("  [SELECT by ID] NOT FOUND");

    // Test 2: SELECT with LIMIT
    const r2 = await client.from("ordens_servico").select("id, status").limit(5);
    if (r2.error) console.log("  [SELECT LIMIT 5] ERROR: " + r2.error.message.slice(0, 80));
    else console.log("  [SELECT LIMIT 5] ROWS: " + (r2.data?.length || 0));

    // Test 3: COUNT with head
    const r3 = await client.from("ordens_servico").select("*", { count: "exact", head: true });
    if (r3.error) console.log("  [COUNT head] ERROR: " + r3.error.message.slice(0, 80));
    else console.log("  [COUNT head] COUNT: " + r3.count);

    // Test 4: SELECT by known OS ID from the list of 6 that failed
    const r4 = await client.from("ordens_servico").select("id").eq("id", "19eedf62-f2bc-4bdf-a03e-be366001d5a1").maybeSingle();
    if (r4.error) console.log("  [SELECT broken ID] ERROR: " + r4.error.message.slice(0, 90));
    else if (r4.data) console.log("  [SELECT broken ID] FOUND");
    else console.log("  [SELECT broken ID] NOT FOUND");
  }

  console.log("\n=== ETAPA 1+2+3 COMPLETE ===");
}
main().catch(console.error);
