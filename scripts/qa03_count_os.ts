import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

async function main() {
  const { data, error: authErr } = await supabase.auth.signInWithPassword({
    email: "tamiris.castilho@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026",
  });
  if (authErr) {
    console.error("Auth:", authErr.message);
    return;
  }
  console.log("Auth OK:", data.user?.email);

  // Query ordens_servico - try without order clause first
  const { data: osData, error: osErr } = await supabase
    .from("ordens_servico")
    .select("id, cliente, cliente_id, status, created_at, valor_total");

  if (osErr) {
    console.log("OS query error:", osErr.message);
    console.log("Trying without cliente column...");
    const { data: osData2, error: osErr2 } = await supabase
      .from("ordens_servico")
      .select("id, status, created_at");
    if (osErr2) {
      console.log("OS query 2 error:", osErr2.message);
    } else {
      console.log("OS records (only id/status):", osData2?.length ?? 0);
      if (osData2) console.log("First:", JSON.stringify(osData2[0]));
    }
  } else {
    console.log("\nOS records returned:", osData?.length ?? 0);
    if (osData && osData.length > 0) {
      console.log("\nFirst 10:");
      osData.slice(0, 10).forEach((o, i) => {
        console.log(
          `  ${i + 1}. ID=${(o.id || "").slice(0, 8)} ` +
          `cli=${String(o.cliente || "").slice(0, 25)} ` +
          `cli_id=${(o.cliente_id || "").slice(0, 8) || "null"} ` +
          `status=${o.status} ` +
          `valor=${o.valor_total} ` +
          `created=${o.created_at || "?"}`
        );
      });
      if (osData.length > 10) {
        console.log(`\n... and ${osData.length - 10} more records`);
      }
    } else {
      console.log("NO OS DATA RETURNED (RLS filtering all rows)");
    }
  }

  // Also try the OS IDs we found from the earlier query
  console.log("\n--- Cross-check with OS IDs from alocacoes ---");
  const osIdsTest = ["06cf2846-d5a2-4a9b-ba5e-37a7bee89409", "0b9852dc-d228-415f-b88b-84927715b223", "127b1b3f-0c5f-445e-aeaa-df8345f6e72f"];
  for (const oid of osIdsTest) {
    const { data: r, error: e } = await supabase.from("ordens_servico").select("id, cliente, cliente_id, status, created_at").eq("id", oid).maybeSingle();
    if (e) console.log(`  OS ${oid.slice(0,8)}: error - ${e.message}`);
    else if (r) console.log(`  OS ${oid.slice(0,8)}: FOUND - cliente=${String(r.cliente||"").slice(0,20)} cli_id=${(r.cliente_id||"").slice(0,8)} status=${r.status}`);
    else console.log(`  OS ${oid.slice(0,8)}: NOT FOUND`);
  }

  // Try the alocacoes' ordem_servico_id values directly without going through ordens_servico
  console.log("\n--- Get OS IDs from alocacoes (fresh) ---");
  const { data: alocOsIds, error: alocErr } = await supabase
    .from("alocacoes_escala")
    .select("ordem_servico_id")
    .not("ordem_servico_id", "is", null)
    .limit(60);
  if (alocErr) console.log("Aloc error:", alocErr.message);
  else if (alocOsIds) {
    const unique = [...new Set(alocOsIds.map(a => a.ordem_servico_id).filter(Boolean))] as string[];
    console.log("Unique OS IDs from alocacoes:", unique.length);
    // Try each
    for (const oid of unique.slice(0, 5)) {
      const { data: r, error: e } = await supabase.from("ordens_servico").select("id").eq("id", oid).maybeSingle();
      if (e) console.log(`  OS ${oid.slice(0,8)}: error - ${e.message}`);
      else if (r) console.log(`  OS ${oid.slice(0,8)}: FOUND ✅`);
      else console.log(`  OS ${oid.slice(0,8)}: NOT FOUND`);
    }
  }

  // Check distinct clientes from OS
  if (osData && osData.length > 0) {
    const cliIds = [
      ...new Set(osData.map((o) => o.cliente_id).filter(Boolean)),
    ] as string[];
    console.log("Distinct cliente_id in OS:", cliIds.length);

    // Cross-reference with clientes table
    if (cliIds.length > 0) {
      const { count: cliCount } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .in("id", cliIds.slice(0, 50));
      console.log("Clientes records matching OS clientes:", cliCount ?? 0);
    }
  }
}

main().catch(console.error);
