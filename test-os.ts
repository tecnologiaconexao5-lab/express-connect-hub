import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testOS() {
  console.log("TESTE ORDEM DE SERVICO");
  console.log("=".repeat(40));
  
  // [0] Descobrir schema
  console.log("\n[0] Schema ordens_servico...");
  const { data: osPrimeiro } = await supabase.from("ordens_servico").select("*").limit(1);
  console.log("Colunas:" + (osPrimeiro ? Object.keys(osPrimeiro[0] || {}) : "sem dados"));

  // [1] Criar cliente
  console.log("\n[1] Criar cliente...");
  const { data: cliente } = await supabase.from("clientes").insert([{
    razao_social: "Cliente OS Teste",
    cnpj: "10.20.30/0001-40",
    status: "ativo"
  }]).select().single();
  const clienteId = cliente.id;
  console.log("Cliente ID:" + clienteId);

  // [2] Criar endereco
  console.log("\n[2] Criar endereco...");
  const { data: endereco } = await supabase.from("enderecos_clientes").insert([{
    cliente_id: clienteId,
    cep: "01234-567",
    logradouro: "Av. Teste OS",
    numero: "100",
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    tipo_endereco: "origem"
  }]).select().single();
  console.log("Endereco ID:" + endereco.id);

  // [3] Criar prestador
  console.log("\n[3] Criar prestador...");
  const { data: prestador } = await supabase.from("prestadores").insert([{
    nome_completo: "Prestador OS Teste",
    cpf_cnpj: "20.30.40/0001-50",
    telefone: "(11) 22222-2222",
    tipo_parceiro: "autonomo",
    status: "ativo"
  }]).select().single();
  const prestadorId = prestador.id;
  console.log("Prestador ID:" + prestadorId);

  // [4] Criar veiculo linked
  console.log("\n[4] Criar veiculo...");
  const { data: veiculo } = await supabase.from("veiculos").insert([{
    placa: "OS001",
    tipo_veiculo: "carro",
    marca: "Fiat",
    modelo: "Uno",
    prestador_vinculado: prestadorId,
    status: "Ativo"
  }]).select().single();
  console.log("Veiculo ID:" + veiculo.id);

  // [5] Criar OS com vinculos
  console.log("\n[5] Criar OS com vinculos...");
  const OS = {
    numero: "OS-" + Date.now(),
    cliente_id: clienteId,
    endereco_origem_id: endereco.id,
    endereco_destino_id: endereco.id,
    prestador_id: prestadorId,
    veiculo_id: veiculo.id,
    descricao: "Teste automatizado de OS",
    valor: 500,
    status: "pendente"
  };

  console.log("Payload OS:" + JSON.stringify(OS));
  
  const { data: osInserida, error: osErro } = await supabase.from("ordens_servico").insert([OS]).select();

  if (osErro) {
    console.log("ERRO OS:" + osErro.message);
    console.log("Campos tentados:" + Object.keys(OS));
    console.log("Schema OS:" + (osPrimeiro ? Object.keys(osPrimeiro[0] || {}) : "N/A"));
    console.log("\nRESULTADO: REPROVADO");
    return;
  }

  console.log("OS inserida:" + JSON.stringify(osInserida));
  const osId = osInserida[0].id;

  // [6] SELECT FINAL
  console.log("\n[6] SELECT FINAL...");
  const { data: osFinal } = await supabase.from("ordens_servico").select("*").eq("id", osId).single();
  console.log(JSON.stringify(osFinal));

  // [7] UPDATE status
  console.log("\n[7] UPDATE status...");
  const { data: osUpdate } = await supabase.from("ordens_servico").update({
    status: "em_andamento"
  }).eq("id", osId).select();

  if (osErro) {
    console.log("ERRO UPDATE:" + osErro.message);
  } else {
    console.log("UPDATE OK");
  }

  // [8] SELECT apos UPDATE
  console.log("\n[8] SELECT APOS UPDATE...");
  const { data: osPosUpdate } = await supabase.from("ordens_servico").select("*").eq("id", osId).single();
  console.log(JSON.stringify(osPosUpdate));

  // PERSISTENCIA
  const ok = osPosUpdate?.status === "em_andamento";
  console.log("\n" + "=".repeat(40));
  console.log("RESULTADO:" + (ok ? "APROVADO" : "REPROVADO"));
}

testOS();