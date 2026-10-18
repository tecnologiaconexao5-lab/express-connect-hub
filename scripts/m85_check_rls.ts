import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

// Test INSERT permissions on various tables
async function testInsert(table: string, payload: any) {
  const { error } = await supabase.from(table).insert([payload]);
  if (error) {
    console.log(`  ${table}: INSERT blocked — ${error.message?.slice(0, 80)}`);
  } else {
    console.log(`  ${table}: INSERT OK`);
    // Cleanup
    await supabase.from(table).delete().eq("id", payload.id || "00000000-0000-0000-0000-000000000000");
  }
}

const testId = crypto.randomUUID();

console.log("Testing INSERT permissions (anon key):");
await testInsert("ordens_servico", { id: testId, numero: "RLSTEST", status: "rascunho" });
await testInsert("os_historico", { os_id: testId, acao: "teste", usuario: "test" });
await testInsert("prestadores", { id: testId, nome_completo: "RLS Test", cpf_cnpj: "RLSTEST" });

// Clean up
await supabase.from("ordens_servico").delete().eq("id", testId);
await supabase.from("prestadores").delete().eq("id", testId);
