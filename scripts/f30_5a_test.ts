import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testF305A() {
  console.log("==========================================");
  console.log("F30.5A — CONECTORES UNIVERSAIS - TESTE");
  console.log("==========================================\n");

  // 1. TABELAS
  console.log("--- 1. TABELAS ---");
  const tables = ["ia_conectores", "ia_conector_robo", "ia_execucoes_conectores"];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("id", { count: "exact", head: true });
    if (error) {
      console.log(`  X ${table}: ERRO - ${error.message}`);
    } else {
      console.log(`  V ${table}: OK (count: ${data?.length || 0})`);
    }
  }

  // 2. RLS POLICIES
  console.log("\n--- 2. RLS POLICIES ---");
  const { data: conectores, error: errCon } = await supabase.from("ia_conectores").select("*").limit(3);
  if (errCon) {
    console.log(`  X ia_conectores SELECT: ERRO - ${errCon.message}`);
  } else {
    console.log(`  V ia_conectores SELECT: OK (${conectores.length} linhas)`);
    for (const c of conectores) {
      console.log(`     - ${c.codigo_unico}: ${c.nome} (${c.tipo}, ${c.provedor}, modo: ${c.modo_padrao})`);
    }
  }

  const { data: vinculos, error: errVinc } = await supabase.from("ia_conector_robo").select("*, ia_conectores(nome, tipo, provedor), automacoes_robos(nome)").limit(5);
  if (errVinc) {
    console.log(`  X ia_conector_robo SELECT: ERRO - ${errVinc.message}`);
  } else {
    console.log(`  V ia_conector_robo SELECT: OK (${vinculos?.length || 0} linhas)`);
    for (const v of vinculos || []) {
      const vv = v as { modo: string; ia_conectores?: { nome: string }; automacoes_robos?: { nome: string } };
      console.log(`     - Robo: ${vv.automacoes_robos?.nome || "?"} -> Conector: ${vv.ia_conectores?.nome || "?"} (modo: ${vv.modo})`);
    }
  }

  // 3. INSERT DE TESTE
  console.log("\n--- 3. INSERT TESTE ---");
  const testId = "TEST_F30_5A_" + Date.now().toString(36).toUpperCase();
  const { data: newCon, error: errIns } = await supabase
    .from("ia_conectores")
    .insert({
      codigo_unico: testId,
      nome: "Conector Teste F30.5A",
      descricao: "Conector temporario para auditoria",
      tipo: "OUTRO",
      provedor: "TestSuite",
      modo_padrao: "HOMOLOGACAO",
    })
    .select()
    .single();

  if (errIns) {
    console.log(`  X INSERT conector: ERRO - ${errIns.message}`);
  } else {
    console.log(`  V INSERT conector: OK (${newCon.id})`);
  }

  // 4. Pegar primeiro robo para vincular
  console.log("\n--- 4. VINCULO TESTE ---");
  const { data: robos } = await supabase.from("automacoes_robos").select("id, nome").limit(1);
  if (robos && robos.length > 0) {
    const { data: newVinc, error: errVincIns } = await supabase
      .from("ia_conector_robo")
      .insert({
        robo_id: robos[0].id,
        conector_id: newCon!.id,
        modo: "HOMOLOGACAO",
      })
      .select()
      .single();

    if (errVincIns) {
      console.log(`  X INSERT vinculo: ERRO - ${errVincIns.message}`);
    } else {
      console.log(`  V INSERT vinculo: OK (robo: ${robos[0].nome} -> ${newCon!.nome})`);
    }
  }

  // 5. EXECUCAO TESTE
  console.log("\n--- 5. EXECUCAO TESTE ---");
  if (robos && robos.length > 0 && newCon) {
    const { data: exec, error: errExec } = await supabase
      .from("ia_execucoes_conectores")
      .insert({
        robo_id: robos[0].id,
        conector_id: newCon.id,
        acao: "Teste de execução simulada",
        payload: { ambiente: "teste", origem: "script_auditoria" },
        modo_executado: "HOMOLOGACAO",
        status: "EM_EXECUCAO",
        inicio_execucao: new Date().toISOString(),
      })
      .select()
      .single();

    if (errExec) {
      console.log(`  X INSERT execucao: ERRO - ${errExec.message}`);
    } else {
      console.log(`  V INSERT execucao: OK (${exec.id})`);
    }
  }

  // 6. CLEANUP
  console.log("\n--- 6. CLEANUP ---");
  if (newCon) {
    const { error: errDelExec } = await supabase.from("ia_execucoes_conectores").delete().eq("conector_id", newCon.id);
    const { error: errDelVinc } = await supabase.from("ia_conector_robo").delete().eq("conector_id", newCon.id);
    const { error: errDelCon } = await supabase.from("ia_conectores").delete().eq("id", newCon.id);
    if (errDelExec || errDelVinc || errDelCon) {
      console.log(`  X CLEANUP: errors occurred`);
      if (errDelExec) console.log(`     exec: ${errDelExec.message}`);
      if (errDelVinc) console.log(`     vinc: ${errDelVinc.message}`);
      if (errDelCon) console.log(`     con: ${errDelCon.message}`);
    } else {
      console.log(`  V CLEANUP: OK (dados de teste removidos)`);
    }
  }

  // 7. ENUMS
  console.log("\n--- 7. ENUMS ---");
  const { data: tipos } = await supabase.rpc("get_enum_values", { enum_name: "tipo_conector" });
  if (tipos) {
    console.log(`  V tipo_conector: ${(tipos as string[]).join(', ')}`);
  } else {
    // Fallback: check via raw query
    const { data: tipos2 } = await supabase.rpc("exec_sql", { sql: "SELECT unnest(enum_range(NULL::tipo_conector))::text" }).catch(() => ({ data: null }));
    if (!tipos2) console.log("  - Não foi possível verificar enums via RPC");
  }

  console.log("\n==========================================");
  console.log("F30.5A — TESTE CONCLUIDO");
  console.log("==========================================");
}

testF305A().catch(console.error);
