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
    console.error("Auth error:", error.message);
    return client;
  }
  console.log("Auth OK, user:", data.user?.email);
  return client;
}

async function main() {
  const supabase = await getAuthedClient();
  console.log("=== ETAPA 3: VALIDATE OS CLAIM ===");

  // 1. Count ordens_servico
  const { count: osCount } = await supabase
    .from("ordens_servico")
    .select("*", { count: "exact", head: true });
  console.log("ordens_servico count:", osCount ?? 0);

  // 2. Check for alternative operation tables
  const { count: escalaOpCount } = await supabase
    .from("escala_operacional")
    .select("*", { count: "exact", head: true });
  console.log("escala_operacional count (deprecated):", escalaOpCount ?? 0);

  // 3. Check alocacoes_escala
  const { count: alocCount } = await supabase
    .from("alocacoes_escala")
    .select("*", { count: "exact", head: true });
  console.log("alocacoes_escala count:", alocCount ?? 0);

  // 4. Alocs with OS linked
  const { count: alocsComOS } = await supabase
    .from("alocacoes_escala")
    .select("*", { count: "exact", head: true })
    .not("ordem_servico_id", "is", null);
  console.log("Alocacoes COM ordem_servico_id:", alocsComOS ?? 0);

  // 5. Alocs without OS
  const { count: alocsSemOS } = await supabase
    .from("alocacoes_escala")
    .select("*", { count: "exact", head: true })
    .is("ordem_servico_id", null);
  console.log("Alocacoes SEM ordem_servico_id:", alocsSemOS ?? 0);

  // 6. Alocs without cliente
  const { count: alocsSemCli } = await supabase
    .from("alocacoes_escala")
    .select("*", { count: "exact", head: true })
    .is("cliente_id", null);
  console.log("Alocacoes sem cliente_id:", alocsSemCli ?? 0);

  // 7. Alocs without prestador
  const { count: alocsSemPres } = await supabase
    .from("alocacoes_escala")
    .select("*", { count: "exact", head: true })
    .is("prestador_id", null);
  console.log("Alocacoes sem prestador_id:", alocsSemPres ?? 0);

  // 8. Sample alocacoes with all FK fields
  const { data: sample, error: sampleErr } = await supabase
    .from("alocacoes_escala")
    .select("id, ordem_servico_id, escala_id, prestador_id, cliente_id, status, created_at, data_escala, aceite_prestador")
    .limit(10);

  console.log("\n=== SAMPLE ALOCACOES (10) ===");
  if (sampleErr) {
    console.log("ERROR:", sampleErr.message);
  } else if (!sample || sample.length === 0) {
    console.log("No records returned (RLS filtering?)");
  } else {
    sample.forEach((a, i) => {
      const safeSlice = (v: unknown) => {
        if (!v) return "null";
        const s = String(v);
        return s.length > 8 ? s.slice(0, 8) : s;
      };
      console.log(
        `${i + 1}. ` +
        `ID=${safeSlice(a.id)} ` +
        `OS=${safeSlice(a.ordem_servico_id)} ` +
        `Escala=${safeSlice(a.escala_id)} ` +
        `Prest=${safeSlice(a.prestador_id)} ` +
        `Cli=${safeSlice(a.cliente_id)} ` +
        `Status=${a.status || "null"} ` +
        `Aceite=${a.aceite_prestador || "null"}` +
        `Data=${a.created_at || "null"}`
      );
    });
  }

  // 8b. Check if 55 alocs with OS have OS records that exist or not
  if (alocsComOS && alocsComOS > 0) {
    const { data: alocsOs } = await supabase
      .from("alocacoes_escala")
      .select("ordem_servico_id")
      .not("ordem_servico_id", "is", null)
      .limit(55);
    if (alocsOs && alocsOs.length > 0) {
      const osIds = [...new Set(alocsOs.map((a) => a.ordem_servico_id))].filter(Boolean) as string[];
      console.log(`\n=== VERIFY OS EXISTENCE (${osIds.length} unique OS IDs) ===`);
      for (const osId of osIds.slice(0, 3)) {
        const { data: osRecord, error: osErr } = await supabase
          .from("ordens_servico")
          .select("id")
          .eq("id", osId)
          .maybeSingle();
        if (osErr) {
          console.log(`  OS ${osId.slice(0, 8)}: query error - ${osErr.message}`);
        } else if (!osRecord) {
          console.log(`  OS ${osId.slice(0, 8)}: NOT FOUND in ordens_servico (ORPHAN)`);
        } else {
          console.log(`  OS ${osId.slice(0, 8)}: FOUND ✅`);
        }
      }
    }
  }

  // 9. Check all entity tables
  console.log("\n=== ENTITY TABLE COUNTS ===");
  const tables = [
    "prestadores",
    "veiculos",
    "clientes",
    "entregas_protocolo",
    "motorista_app_sessoes",
    "delivery_proofs",
    "portal_pedidos",
    "financeiro_receber",
    "financeiro_pagar",
    "pagamentos_prestadores",
    "composicao_financeira_os",
    "recrutamento_prestadores",
    "operacao_localizacao",
    "ocorrencias",
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log(`${table}: ERROR - ${error.message}`);
    } else {
      console.log(`${table}: ${count ?? 0}`);
    }
  }

  // 10. Check if escala_operacional has data and if os_id links exist
  if (escalaOpCount && escalaOpCount > 0) {
    const { data: escalaData } = await supabase
      .from("escala_operacional")
      .select("id, os_id, prestador_id, veiculo_id, motorista_nome, placa")
      .limit(5);
    console.log("\n=== ESCALA_OPERACIONAL SAMPLE ===");
    if (escalaData) {
      escalaData.forEach((e, i) => console.log(`${i + 1}. ${JSON.stringify(e)}`));
    }
  }

  // 11. Check delivery_proofs
  const { data: dpData } = await supabase
    .from("delivery_proofs")
    .select("id, operation_id, alocacao_id, status")
    .limit(5);
  console.log("\n=== DELIVERY_PROOFS SAMPLE ===");
  if (dpData) {
    dpData.forEach((d, i) => console.log(`${i + 1}. ${JSON.stringify(d)}`));
  }

  // 12. Check financeiro_receber for orphan analysis
  const { data: frData } = await supabase
    .from("financeiro_receber")
    .select("id, os_id, cliente_id, valor")
    .limit(5);
  console.log("\n=== FINANCEIRO_RECEBER SAMPLE ===");
  if (frData) {
    frData.forEach((f, i) => console.log(`${i + 1}. ${JSON.stringify(f)}`));
  }

  console.log("\n=== AUDIT COMPLETE ===");
}

main().catch(console.error);
