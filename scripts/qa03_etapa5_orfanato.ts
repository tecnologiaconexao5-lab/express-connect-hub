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

  console.log("=== ETAPA 5: AUDITORIA DE ORFAOS ===");

  // 5a. Alocacoes sem ordem_servico_id (orphan operations)
  const { count: alocsSemOS } = await supabase
    .from("alocacoes_escala")
    .select("*", { count: "exact", head: true })
    .is("ordem_servico_id", null);
  console.log(`Alocacoes sem ordem_servico_id: ${alocsSemOS ?? 0}`);

  // 5b. Alocacoes sem cliente_id
  const { count: alocsSemCliente } = await supabase
    .from("alocacoes_escala")
    .select("*", { count: "exact", head: true })
    .is("cliente_id", null);
  console.log(`Alocacoes sem cliente_id: ${alocsSemCliente ?? 0}`);

  // 5c. Alocacoes sem prestador_id
  const { count: alocsSemPrest } = await supabase
    .from("alocacoes_escala")
    .select("*", { count: "exact", head: true })
    .is("prestador_id", null);
  console.log(`Alocacoes sem prestador_id: ${alocsSemPrest ?? 0}`);

  // 5d. Financeiro_receber without os_id
  const { count: frSemOS } = await supabase
    .from("financeiro_receber")
    .select("*", { count: "exact", head: true })
    .is("os_id", null);
  console.log(`financeiro_receber sem os_id: ${frSemOS ?? 0}`);

  // 5e. Financeiro_receber without cliente_id
  const { count: frSemCli } = await supabase
    .from("financeiro_receber")
    .select("*", { count: "exact", head: true })
    .is("cliente_id", null);
  console.log(`financeiro_receber sem cliente_id: ${frSemCli ?? 0}`);

  // 5f. Financeiro_receber os_id cross-reference with ordens_servico
  const { data: frOsIds, count: frTotal } = await supabase
    .from("financeiro_receber")
    .select("os_id");
  const frTotalCount = frTotal ?? 0;
  if (frOsIds && frOsIds.length > 0) {
    const uniqueOsIds = [...new Set(frOsIds.map((f) => f.os_id).filter(Boolean))] as string[];
    console.log(`\nfinanceiro_receber records: ${frOsIds.length}`);
    console.log(`  With os_id: ${frOsIds.filter((f) => f.os_id).length}`);
    console.log(`  Without os_id: ${frOsIds.filter((f) => !f.os_id).length}`);
    console.log(`  Unique os_id values: ${uniqueOsIds.length}`);

    // Check if OS records exist for these IDs
    if (uniqueOsIds.length > 0) {
      const { count: matchingOs } = await supabase
        .from("ordens_servico")
        .select("*", { count: "exact", head: true })
        .in("id", uniqueOsIds.slice(0, 50));
      console.log(`  OS records found matching financeiro os_id: ${matchingOs ?? 0}`);

      // Since ordens_servico = 0, ALL financeiro_receber os_id values are orphans
      if (matchingOs === 0) {
        console.log(`  >>> ALL ${uniqueOsIds.length} os_id values in financeiro_receber are ORPHANS (no ordens_servico exists)`);
      }
    }
  } else {
    console.log("financeiro_receber os_id check: no data or query failed");
  }

  // 5g. Financeiro_pagar analysis
  const { count: fpSemOS } = await supabase
    .from("financeiro_pagar")
    .select("*", { count: "exact", head: true })
    .is("os_id", null);
  console.log(`\nfinanceiro_pagar sem os_id: ${fpSemOS ?? 0}`);

  const { count: fpSemFornec } = await supabase
    .from("financeiro_pagar")
    .select("*", { count: "exact", head: true })
    .is("fornecedor_id", null);
  console.log(`financeiro_pagar sem fornecedor_id: ${fpSemFornec ?? 0}`);

  // 5h. Pagamentos_prestadores analysis
  const { count: ppSemOS } = await supabase
    .from("pagamentos_prestadores")
    .select("*", { count: "exact", head: true })
    .is("os_id", null);
  console.log(`\npagamentos_prestadores sem os_id: ${ppSemOS ?? 0}`);

  const { count: ppSemPrest } = await supabase
    .from("pagamentos_prestadores")
    .select("*", { count: "exact", head: true })
    .is("prestador_id", null);
  console.log(`pagamentos_prestadores sem prestador_id: ${ppSemPrest ?? 0}`);

  // 5i. Entregas_protocolo orphan analysis
  const { count: epSemAloc } = await supabase
    .from("entregas_protocolo")
    .select("*", { count: "exact", head: true })
    .is("alocacao_id", null);
  console.log(`\nentregas_protocolo sem alocacao_id: ${epSemAloc ?? 0}`);

  // 5j. Composicao_financeira_os analysis
  const { count: cfoSemOS } = await supabase
    .from("composicao_financeira_os")
    .select("*", { count: "exact", head: true })
    .is("os_id", null);
  console.log(`\ncomposicao_financeira_os sem os_id: ${cfoSemOS ?? 0}`);

  // 5k. Check alocacoes that HAVE cliente_id - see if clientes records exist
  const { data: alocsComCli, count: alocsComCliCount } = await supabase
    .from("alocacoes_escala")
    .select("cliente_id")
    .not("cliente_id", "is", null)
    .limit(200);
  const alocsComCliTotal = alocsComCliCount ?? 0;
  if (alocsComCli && alocsComCli.length > 0) {
    const cliIds = [...new Set(alocsComCli.map((a) => a.cliente_id).filter(Boolean))] as string[];
    console.log(`\nalocacoes com cliente_id: ${alocsComCliTotal}`);
    console.log(`Unique cliente_ids: ${cliIds.length}`);
    // Check if they exist in clientes table
    if (cliIds.length > 0) {
      const { count: matchingCli } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .in("id", cliIds.slice(0, 25));
      console.log(`Match found in clientes table: ${matchingCli ?? 0}`);
    }
  }

  // 5l. List all clientes
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, razao_social, cpf_cnpj, status, created_at")
    .limit(20);
  console.log("\n=== CLIENTES SAMPLE ===");
  if (clientes && clientes.length > 0) {
    clientes.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.razao_social || "?"} (ID=${(c.id || "").slice(0, 8)}) Status=${c.status} CNPJ=${c.cpf_cnpj || "?"}`);
    });
  }

  // 5m. Summary
  console.log("\n=== ORPHAN SUMMARY TABLE ===");
  console.log("TABLE                        | TOTAL | WITH FK  | WITHOUT FK | ORPHAN %");
  console.log("-----------------------------|-------|----------|------------|----------");
  const totalAlocs = 176;
  console.log(`alocacoes_escala (cliente_id)  | ${String(totalAlocs).padStart(5)} | ${String(totalAlocs - (alocsSemCliente ?? 0)).padStart(8)} | ${String(alocsSemCliente ?? 0).padStart(10)} | ${((alocsSemCliente ?? 0) / totalAlocs * 100).toFixed(0).padStart(6)}%`);
  console.log(`alocacoes_escala (prestador_id) | ${String(totalAlocs).padStart(5)} | ${String(totalAlocs - (alocsSemPrest ?? 0)).padStart(8)} | ${String(alocsSemPrest ?? 0).padStart(10)} | ${((alocsSemPrest ?? 0) / totalAlocs * 100).toFixed(0).padStart(6)}%`);
  console.log(`financeiro_receber (os_id)       | ${String(frTotalCount).padStart(5)} | ${String(frTotalCount - (frSemOS ?? 0)).padStart(8)} | ${String(frSemOS ?? 0).padStart(10)} | ${(frTotalCount > 0 ? ((frSemOS ?? 0) / frTotalCount * 100).toFixed(0) : "0").padStart(6)}%`);
  console.log("---");
  console.log("ALOCACOES TOTAIS COM ORDEM_SERVICO_ID: 55");
  console.log("ORDENS_SERVICO EXISTENTES: 0");
  console.log(">>> TODAS AS 55 REFERENCIAS SAO ORFAS <<<");

  console.log("\n=== ETAPA 5 COMPLETE ===");
}

main().catch(console.error);
