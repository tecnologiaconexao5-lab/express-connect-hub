import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPrestador() {
  console.log("TESTE CADASTRO DE PRESTADOR");
  console.log("=".repeat(40));
  
  // [0] Schema ja conhecido: cpf_cnpj, tipo_parceiro
  
  // [1] INSERT com campos CORRETOS
  const payload = {
    nome_completo: "Prestador Teste Automatizado",
    cpf_cnpj: "123.456.789-00",
    telefone: "(11) 99999-9999",
    whatsapp: "(11) 99999-9999",
    email: "prestador@teste.com.br",
    status: "ativo",
    tipo_parceiro: "autonomo"
  };

  console.log("\n[1] INSERT:" + JSON.stringify(payload));
  
  const { data:inserted, error } = await supabase.from("prestadores").insert([payload]).select();
  
  if (error) {
    console.log("ERRO:" + error.message);
    console.log("RESULTADO: REPROVADO");
    return;
  }
  
  console.log("INSERT OK:" + JSON.stringify(inserted));
  const id = inserted[0].id;

  // [2] SELECT
  console.log("\n[2] SELECT:");
  const { data: selectOk } = await supabase.from("prestadores").select("*").eq("id", id).single();
  console.log(JSON.stringify(selectOk));

  // [3] UPDATE
  console.log("\n[3] UPDATE...");
  const { data: updated } = await supabase.from("prestadores").update({
    telefone: "(11) 88888-8888",
    status: "inativo"
  }).eq("id", id).select();

  if (error) {
    console.log("ERRO:" + error.message);
  } else {
    console.log("UPDATE OK");
  }

  // [4] SELECT FINAL
  console.log("\n[4] SELECT FINAL:");
  const { data: final } = await supabase.from("prestadores").select("*").eq("id", id).single();
  console.log(JSON.stringify(final));

  // [5] TESTAR VEICULO
  console.log("\n[5] TESTAR VEICULO...");
  const { data: veiculos, error: vErro } = await supabase.from("veiculos_prestadores").select("*").limit(1);
  if (vErro) {
    console.log("Tabela veiculos_prestadores NAO existe:" + vErro.message);
  } else {
    console.log("Tabela veiculos existe. Colunas:" + (veiculos ? Object.keys(veiculos[0] || {}) : "vazia"));
  }

  // [6] TESTAR DOCUMENTOS
  console.log("\n[6] TESTAR DOCUMENTOS...");
  const { data: docs, error: dErro } = await supabase.from("documentos_prestadores").select("*").limit(1);
  if (dErro) {
    console.log("Tabela documentos NAO existe:" + dErro.message);
  } else {
    console.log("Tabela documentos existe. Colunas:" + (docs ? Object.keys(docs[0] || {}) : "vazia"));
  }

  // PERSISTENCIA
  const ok = final?.telefone === "(11) 88888-8888";
  console.log("\n" + "=".repeat(40));
  console.log("RESULTADO:" + (ok ? "APROVADO" : "REPROVADO"));
  console.log("=".repeat(40));
}

testPrestador();