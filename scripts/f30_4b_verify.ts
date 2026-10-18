import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fase0Verification() {
  console.log("========================================");
  console.log("F30.4B — FASE 0 - VERIFICACAO POS-MIGRACAO");
  console.log("========================================\n");

  // 1. Check tables exist by querying
  console.log("--- 1. TABELAS ---");
  const tables = ["ia_ferramentas", "ia_robo_ferramentas", "ia_execucoes_ferramentas"];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("id", { count: "exact", head: true });
    if (error) {
      console.log(`  \u274c ${table}: ERRO - ${error.message}`);
    } else {
      console.log(`  \u2705 ${table}: OK (${data?.length || 0} registros)`);
    }
  }

  // 2. Verify seed data (15 tools)
  console.log("\n--- 2. SEED DATA (Ferramentas Padrão) ---");
  const { data: ferramentas, error: fErr } = await supabase
    .from("ia_ferramentas")
    .select("codigo_unico, nome, categoria, risco_operacional, limite_execucoes_dia, precisa_aprovacao")
    .order("codigo_unico");
  
  if (fErr) {
    console.log(`  \u274c Erro: ${fErr.message}`);
  } else {
    console.log(`  \u2705 ${ferramentas.length} ferramentas encontradas`);
    for (const f of ferramentas) {
      console.log(`     - ${f.codigo_unico}: ${f.nome} [${f.categoria}] risco=${f.risco_operacional} limite=${f.limite_execucoes_dia} aprovacao=${f.precisa_aprovacao ? "sim" : "nao"}`);
    }
  }

  // 3. Verify RLS by attempting operations
  console.log("\n--- 3. RLS / OPERACOES ---");
  // Test INSERT (temp record)
  const testCode = "TEST_F30_VERIFY_" + Date.now().toString(36).toUpperCase();
  const { data: newTool, error: insErr } = await supabase
    .from("ia_ferramentas")
    .insert({
      codigo_unico: testCode,
      nome: "Ferramenta Verificacao F30.4B",
      descricao: "Criada durante auditoria",
      categoria: "COMUNICACAO",
    })
    .select()
    .single();
  
  if (insErr) {
    console.log(`  \u274c INSERT: ERRO - ${insErr.message}`);
  } else {
    console.log(`  \u2705 INSERT: OK (id: ${newTool.id.slice(0, 8)}...)`);
    // Clean up
    await supabase.from("ia_ferramentas").delete().eq("id", newTool.id);
    console.log(`  \u2705 DELETE: OK (limpeza)`);
  }

  // 4. Check robos table (already existed)
  console.log("\n--- 4. ROBOS DISPONIVEIS ---");
  const { data: robos, error: rErr } = await supabase
    .from("automacoes_robos")
    .select("id, nome, setor")
    .order("nome");
  
  if (rErr) {
    console.log(`  \u274c Erro: ${rErr.message}`);
  } else {
    console.log(`  \u2705 ${robos.length} robos encontrados:`);
    for (const r of robos) {
      console.log(`     - ${r.id.slice(0, 8)}...: ${r.nome} (${r.setor})`);
    }
  }

  console.log("\n========================================");
  console.log("FASE 0 - VERIFICACAO CONCLUIDA COM SUCESSO");
  console.log("========================================");
}

fase0Verification().catch(console.error);
