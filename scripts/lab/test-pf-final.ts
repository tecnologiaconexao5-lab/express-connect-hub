import { createClient } from "@supabase/supabase-js";
import { guardHarness } from "../_guard.mjs";

// TMS-FIN-DATA-04D3C3B1 — guard fail-closed ANTES de qualquer conexao/escrita/Storage.
guardHarness("scripts/lab/test-pf-final.ts");


const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("TESTE PRESTADOR - USANDO CAMPOS CERTOS");
  console.log("=".repeat(40));
  
  // Campos que o mapper usa (como o frontend)
  const payload = {
    nome_completo: "Prestador Frontend Teste",
    cpf_cnpj: "987.654.321-00",
    telefone: "(11) 77777-7777",
    whatsapp: "(11) 77777-7777",
    email: "frontend@teste.com.br",
    tipo_parceiro: "autonomo",
    status: "ativo"
  };

  console.log("\n[1] INSERT:" + JSON.stringify(payload));
  
  const { data: inserted, error } = await supabase.from("prestadores").insert([payload]).select();
  
  if (error) {
    console.log("ERRO:" + error.message);
    console.log("RESULTADO: REPROVADO");
    return;
  }
  
  console.log("INSERT OK:" + JSON.stringify(inserted));
  const id = inserted[0].id;
  console.log("ID:" + id);

  // UPDATE
  console.log("\n[2] UPDATE...");
  const { data: updated } = await supabase.from("prestadores").update({
    telefone: "(11) 66666-6666"
  }).eq("id", id).select();

  if (error) {
    console.log("ERRO:" + error.message);
  } else {
    console.log("UPDATE OK");
  }

  // SELECT FINAL
  console.log("\n[3] SELECT FINAL:");
  const { data: final } = await supabase.from("prestadores").select("*").eq("id", id).single();
  console.log(JSON.stringify(final));

  // PERSISTENCIA
  const ok = final?.telefone === "(11) 66666-6666";
  console.log("\n" + "=".repeat(40));
  console.log("RESULTADO:" + (ok ? "APROVADO" : "REPROVADO"));
}

test();