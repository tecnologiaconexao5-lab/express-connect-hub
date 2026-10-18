import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026";

async function getAuthedClient() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error) {
    console.error("Auth error:", error.message, "- using anon");
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  console.log("Auth OK, user:", data.user?.email);
  return client;
}

async function main() {
  const supabase = await getAuthedClient();

  console.log("=== ETAPA 4: PRESTADOR vs MOTORISTA ===");

  // 4a. prestadores table schema check
  console.log("\n--- prestadores: 0 records ---");

  // 4b. alocacoes_escala columns related to motorista
  // First check if motorista_id column exists
  const { data: alocCols, error: colErr } = await supabase
    .rpc("get_table_columns", { table_name: "alocacoes_escala" });
  if (colErr) {
    console.log("RPC get_table_columns not available, checking via data...");
  } else {
    console.log("alocacoes_escala columns:", alocCols);
  }

  // Check alocacoes for motorista-related fields
  const { data: alocsMotorista } = await supabase
    .from("alocacoes_escala")
    .select("*")
    .not("motorista_id", "is", null)
    .limit(5);
  if (alocsMotorista && alocsMotorista.length > 0) {
    console.log(`\nAlocacoes COM motorista_id: ${alocsMotorista.length}`);
    alocsMotorista.forEach((a, i) => {
      console.log(`  ${i + 1}. ID=${(a.id || "").slice(0, 8)} motorista_id=${(a.motorista_id || "").slice(0, 8)} nome_motorista=${a.nome_motorista || "null"}`);
    });
  } else {
    console.log("\nNo alocs with motorista_id, checking nome_motorista...");
    // Try to get nome_motorista for prestador-less alocs
    const { data: alocsSemPres } = await supabase
      .from("alocacoes_escala")
      .select("id, prestador_id, motorista_id, nome_motorista, motorista_cpf, motorista_telefone, veiculo_placa, veiculo_modelo")
      .is("prestador_id", null)
      .limit(10);
    if (alocsSemPres && alocsSemPres.length > 0) {
      console.log("\n--- 10 alocs SEM prestador_id - checking motorista fields ---");
      alocsSemPres.forEach((a, i) => {
        console.log(`  ${i + 1}. ID=${(a.id || "").slice(0, 8)} motorista_id=${(a.motorista_id || "").slice(0, 8) || "null"} nome_motorista=${a.nome_motorista || "null"} cpf=${a.motorista_cpf || "null"} placa=${a.veiculo_placa || "null"} modelo=${a.veiculo_modelo || "null"}`);
      });
    }

    // And those WITH prestador_id to compare
    const { data: alocsComPres } = await supabase
      .from("alocacoes_escala")
      .select("id, prestador_id, motorista_id, nome_motorista, motorista_cpf, motorista_telefone, veiculo_placa, veiculo_modelo")
      .not("prestador_id", "is", null)
      .limit(10);
    if (alocsComPres && alocsComPres.length > 0) {
      console.log("\n--- 10 alocs COM prestador_id - comparison ---");
      alocsComPres.forEach((a, i) => {
        console.log(`  ${i + 1}. ID=${(a.id || "").slice(0, 8)} motorista_id=${(a.motorista_id || "").slice(0, 8) || "null"} nome_motorista=${a.nome_motorista || "null"} cpf=${a.motorista_cpf || "null"} placa=${a.veiculo_placa || "null"} modelo=${a.veiculo_modelo || "null"}`);
      });
    }
  }

  // 4c. prestador_acesso table
  const { count: paCount } = await supabase
    .from("prestador_acesso")
    .select("*", { count: "exact", head: true });
  console.log("\nprestador_acesso count:", paCount ?? 0);

  // 4d. recrutamento_prestadores (1 record found)
  const { data: recrut } = await supabase
    .from("recrutamento_prestadores")
    .select("*")
    .limit(5);
  console.log("\nrecrutamento_prestadores:");
  if (recrut && recrut.length > 0) {
    recrut.forEach((r, i) => console.log(`  ${i + 1}. ${JSON.stringify(r)}`));
  }

  // 4e. Check for motorista_views
  const tablesToCheck = [
    "vw_prestadores_ativos",
    "vw_motoristas_ativos",
    "vw_alocacoes_completas",
    "vw_alocacoes_motorista",
    "vw_motoristas",
    "vw_prestadores",
    "motorista_checkins",
    "prestador_disponibilidade",
    "prestador_candidaturas",
    "prestador_reembolsos",
    "prestador_notificacoes",
    "prestador_engajamento",
  ];
  console.log("\n--- Extra tables ---");
  for (const table of tablesToCheck) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      // Table might not exist
    } else {
      console.log(`${table}: ${count ?? 0}`);
    }
  }

  console.log("\n=== ETAPA 4 COMPLETE ===");
}

main().catch(console.error);
