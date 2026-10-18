import { createClient } from "@supabase/supabase-js";

const URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

async function main() {
  const supabase = createClient(URL, ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "tamiris.castilho@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026",
  });
  if (error) { console.error("Auth:", error.message); return; }
  console.log("Auth OK");

  // Test 1: select only id from ordens_servico
  console.log("\n1. SELECT id FROM ordens_servico (limit 5)");
  const { data: r1, error: e1 } = await supabase.from("ordens_servico").select("id").limit(5);
  if (e1) console.log("  ERR:", e1.message);
  else console.log("  OK:", r1?.length || 0, "records");

  // Test 2: select specific columns one at a time
  const cols = ["id", "cliente", "cliente_id", "status", "tenant_id", "created_at", "prestador_id", "valor_total"];
  for (const col of cols) {
    const { data: rd, error: ed } = await supabase.from("ordens_servico").select(col).limit(3);
    if (ed) console.log(`  col '${col}': ERR - ${ed.message?.slice(0, 80)}`);
    else console.log(`  col '${col}': OK (${rd?.length || 0} rows)`);
  }

  // Test 3: check OS IDs from alocacoes (these should work)
  console.log("\n3. Verify known OS IDs individually");
  const osIds = ["06cf2846-d5a2-4a9b-ba5e-37a7bee89409", "0b9852dc-d228-415f-b88b-84927715b223"];
  for (const oid of osIds) {
    const { data: rd, error: ed } = await supabase.from("ordens_servico").select("id, cliente, cliente_id, status, tenant_id").eq("id", oid).maybeSingle();
    if (ed) console.log(`  OS ${oid.slice(0,8)}: ERR - ${ed.message?.slice(0,80)}`);
    else if (rd) console.log(`  OS ${oid.slice(0,8)}: FOUND - cliente="${(rd.cliente||"").slice(0,25)}" cliente_id="${(rd.cliente_id||"").slice(0,8)}" status=${rd.status} tenant_id=${rd.tenant_id ? (rd.tenant_id+"").slice(0,8) : "null"}`);
    else console.log(`  OS ${oid.slice(0,8)}: NOT FOUND`);
  }

  // Test 4: check what tenant_id looks like for a known OS
  console.log("\n4. Check tenant_id for known OS");
  // Use a known working OS ID
  const { data: osFirst } = await supabase.from("alocacoes_escala").select("ordem_servico_id").not("ordem_servico_id","is",null).limit(1);
  if (osFirst && osFirst[0]?.ordem_servico_id) {
    const oid = osFirst[0].ordem_servico_id;
    const { data: rd, error: ed } = await supabase.from("ordens_servico").select("id, tenant_id, cliente_id, cliente, prestador_id, prestador, status").eq("id", oid).maybeSingle();
    if (ed) console.log(`  OS ${oid.slice(0,8)}: ERR - ${ed.message?.slice(0,80)}`);
    else if (rd) console.log(`  OS ${oid.slice(0,8)}: tenant_id="${rd.tenant_id}" (type=${typeof rd.tenant_id}) cliente_id="${rd.cliente_id}" cliente="${rd.cliente}" prestador_id="${rd.prestador_id}"`);
  }

  // Test 5: find the row with problematic data
  console.log("\n5. Test: searching for 'M43' or 'Cliente' in cliente column");
  // Try to find what ordens_servico rows exist
  const { data: alocOsIds } = await supabase
    .from("alocacoes_escala")
    .select("ordem_servico_id")
    .not("ordem_servico_id", "is", null)
    .limit(60);
  if (alocOsIds) {
    const unique = [...new Set(alocOsIds.map(a => a.ordem_servico_id).filter(Boolean))] as string[];
    console.log(`Total unique OS IDs from alocacoes: ${unique.length}`);
    
    // Try each one and count successes/failures
    let found = 0, notFound = 0, errors = 0;
    for (const oid of unique) {
      const { data: rd, error: ed } = await supabase.from("ordens_servico").select("id").eq("id", oid).maybeSingle();
      if (ed) { errors++; if (errors <= 3) console.log(`  OS ${oid.slice(0,8)}: ERR - ${ed.message?.slice(0,60)}`); }
      else if (rd) found++;
      else notFound++;
    }
    console.log(`\nResult: ${found} found, ${notFound} not found, ${errors} errors (out of ${unique.length} total)`);
  }

  console.log("\n=== DONE ===");
}
main().catch(console.error);
