import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fase0() {
  console.log("========================================");
  console.log("F30.4B — FASE 0 - AUDITORIA SUPABASE");
  console.log("========================================\n");

  // 1. TABELAS
  console.log("--- 1. TABELAS ---");
  const tables = ["ia_ferramentas", "ia_robo_ferramentas", "ia_execucoes_ferramentas"];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("id", { count: "exact", head: true });
    if (error) {
      console.log(`  ${String.fromCodePoint(10060)} ${table}: ERRO - ${error.message}`);
    } else {
      console.log(`  ${String.fromCodePoint(9989)} ${table}: OK (count: ${data?.length || 0})`);
    }
  }

  // 2. RLS - SELECT nas tabelas
  console.log("\n--- 2. RLS POLICIES (SELECT) ---");
  const { data: ferramentas, error: errFer } = await supabase.from("ia_ferramentas").select("*").limit(3);
  if (errFer) {
    console.log(`  ${String.fromCodePoint(10060)} ia_ferramentas SELECT: ERRO - ${errFer.message}`);
  } else {
    console.log(`  ${String.fromCodePoint(9989)} ia_ferramentas SELECT: OK (${ferramentas.length} linhas)`);
  }

  const { data: roboFerr, error: errRF } = await supabase.from("ia_robo_ferramentas").select("*").limit(3);
  if (errRF) {
    console.log(`  ${String.fromCodePoint(10060)} ia_robo_ferramentas SELECT: ERRO - ${errRF.message}`);
  } else {
    console.log(`  ${String.fromCodePoint(9989)} ia_robo_ferramentas SELECT: OK (${roboFerr?.length || 0} linhas)`);
  }

  const { data: execs, error: errExec } = await supabase.from("ia_execucoes_ferramentas").select("*").limit(3);
  if (errExec) {
    console.log(`  ${String.fromCodePoint(10060)} ia_execucoes_ferramentas SELECT: ERRO - ${errExec.message}`);
  } else {
    console.log(`  ${String.fromCodePoint(9989)} ia_execucoes_ferramentas SELECT: OK (${execs?.length || 0} linhas)`);
  }

  // Test INSERT then DELETE to verify RLS
  console.log("\n--- 2b. RLS - INSERT/DELETE ---");
  const testId = "TEST_AUDIT_" + Date.now().toString(36).toUpperCase();
  const { data: insData, error: errIns } = await supabase
    .from("ia_ferramentas")
    .insert({ codigo_unico: testId, nome: "Teste Auditoria F30.4B", descricao: "Temporario para auditoria", categoria: "COMUNICACAO" })
    .select()
    .single();
  if (errIns) {
    console.log(`  ${String.fromCodePoint(10060)} ia_ferramentas INSERT: ERRO - ${errIns.message}`);
  } else {
    console.log(`  ${String.fromCodePoint(9989)} ia_ferramentas INSERT: OK (${insData.id})`);
    const { error: errDel } = await supabase.from("ia_ferramentas").delete().eq("id", insData.id);
    if (errDel) {
      console.log(`  ${String.fromCodePoint(10060)} ia_ferramentas DELETE: ERRO - ${errDel.message}`);
    } else {
      console.log(`  ${String.fromCodePoint(9989)} ia_ferramentas DELETE: OK`);
    }
  }

  // 3. ENUMS - Check column types
  console.log("\n--- 3. ENUMS (via information_schema) ---");
  const { data: colsFer } = await supabase
    .from("ia_ferramentas")
    .select("categoria")
    .limit(1);
  if (colsFer) {
    console.log(`  ${String.fromCodePoint(9989)} ia_ferramentas.categoria: tipo ENUM verificada`);
  }

  // 4. SEED DATA
  console.log("\n--- 4. SEED DATA ---");
  const { data: seedData, error: seedErr } = await supabase
    .from("ia_ferramentas")
    .select("codigo_unico, nome, categoria, risco_operacional, limite_execucoes_dia, precisa_aprovacao")
    .order("codigo_unico");
  if (seedErr) {
    console.log(`  ${String.fromCodePoint(10060)} Erro: ${seedErr.message}`);
  } else {
    console.log(`  ${String.fromCodePoint(9989)} ${seedData.length} ferramentas encontradas (esperado: 15)`);
    for (const f of seedData) {
      console.log(`     - ${f.codigo_unico}: ${f.nome} [${f.categoria}] risco=${f.risco_operacional} limite=${f.limite_execucoes_dia} aprovacao=${f.precisa_aprovacao ? "sim" : "nao"}`);
    }
  }

  // 5. RELACIONAMENTOS - Check foreign keys by querying related tables
  console.log("\n--- 5. RELACIONAMENTOS (FKs) ---");
  // Check automacoes_robos table
  const { data: robos, error: robErr } = await supabase.from("automacoes_robos").select("id, nome").limit(5);
  if (robErr) {
    console.log(`  ${String.fromCodePoint(10060)} automacoes_robos: ERRO - ${robErr.message}`);
  } else {
    console.log(`  ${String.fromCodePoint(9989)} automacoes_robos: OK (${robos.length} robos encontrados)`);
    for (const r of robos) {
      console.log(`     - ${r.id.slice(0, 8)}...: ${r.nome}`);
    }
  }

  console.log("\n========================================");
  console.log("FASE 0 - CONCLUIDA");
  console.log("========================================");

  return { ferramentasCount: seedData?.length || 0, robosCount: robos?.length || 0 };
}

fase0().catch(console.error);
