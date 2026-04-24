import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("TESTE VINCULO VEICULO-PRESTADOR");
  console.log("=".repeat(40));
  
  // [1] Criar prestador
  console.log("\n[1] Criar prestador...");
  const { data: prestador } = await supabase.from("prestadores").insert([{
    nome_completo: "Prestador Vinculo Teste",
    cpf_cnpj: "555.666.777-88",
    telefone: "(11) 55555-5555",
    tipo_parceiro: "autonomo",
    status: "ativo"
  }]).select().single();
  
  const prestadorId = prestador.id;
  console.log("Prestador ID:" + prestadorId);

  // [2] Criar veiculo linked
  console.log("\n[2] Criar veiculo com vinculo...");
  const { data: veiculo, error } = await supabase.from("veiculos").insert([{
    placa: "TESTE01",
    tipo_veiculo: "carro",
    marca: "Fiat",
    modelo: "Uno",
    prestador_vinculado: prestadorId,
    status: "Ativo"
  }]).select();

  if (error) {
    console.log("ERRO:" + error.message);
    console.log("RESULTADO: REPROVADO");
    return;
  }

  console.log("Veiculo criado:" + JSON.stringify(veiculo));
  const veiculoId = veiculo[0].id;

  // [3] SELECT com vinculo
  console.log("\n[3] SELECT veiculo com vinculo...");
  const { data: linked } = await supabase.from("veiculos").select("*").eq("id", veiculoId).single();
  console.log(JSON.stringify(linked));

  // [4] UPDATE
  console.log("\n[4] UPDATE veiculo...");
  const { data: updated } = await supabase.from("veiculos").update({
    status: "Inativo"
  }).eq("id", veiculoId).select();

  if (error) {
    console.log("ERRO:" + error.message);
  } else {
    console.log("UPDATE OK");
  }

  // [5] SELECT FINAL
  console.log("\n[5] SELECT FINAL...");
  const { data: final } = await supabase.from("veiculos").select("*").eq("id", veiculoId).single();
  console.log(JSON.stringify(final));

  // PERSISTENCIA
  const ok = final?.prestador_vinculado === prestadorId && final?.status === "Inativo";
  console.log("\n" + "=".repeat(40));
  console.log("RESULTADO:" + (ok ? "APROVADO" : "REPROVADO"));
}

test();