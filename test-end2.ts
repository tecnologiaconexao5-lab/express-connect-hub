import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("TESTE ENDERECO CLIENTE - INSERT + UPDATE");
  
  // Criar cliente
  const { data: clienteData } = await supabase.from("clientes").insert([{ 
    razao_social: "Teste End", cnpj: "11.111.111/0001-11" 
  }]).select().single();
  const clienteId = clienteData.id;

  // INSERT com CAMPOS CORRETOS (do schema: logradouro, NAO rua)
  const payload = {
    cliente_id: clienteId,
    tipo_endereco: "principal",
    cep: "01234-567",
    logradouro: "Av. Paulista",
    numero: "100",
    complemento: "Sala 1",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP"
  };

  console.log("\n[1] INSERT:" + JSON.stringify(payload));
  
  const { data: inserted, error } = await supabase.from("enderecos_clientes").insert([payload]).select();
  
  if (error) {
    console.log("ERRO:" + error.message);
    console.log("RESULTADO: REPROVADO");
    return;
  }
  
  console.log("INSERT OK:" + JSON.stringify(inserted));
  const id = inserted[0].id;

  // UPDATE (SEM observacoes - não existe no schema)
  console.log("\n[2] UPDATE...");
  const { data: updated } = await supabase.from("enderecos_clientes").update({
    numero: "200"
  }).eq("id", id).select();

  if (error) {
    console.log("ERRO:" + error.message);
  } else {
    console.log("UPDATE OK");
  }

  // SELECT FINAL
  console.log("\n[3] SELECT FINAL:");
  const { data: final } = await supabase.from("enderecos_clientes").select("*").eq("id", id).single();
  console.log(JSON.stringify(final));

  // PERSISTENCIA
  const ok = final?.numero === "200";
  console.log("\nRESULTADO:" + (ok ? "APROVADO" : "REPROVADO"));
}

test();