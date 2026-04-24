import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testOS() {
  console.log("TESTE ORDEM DE SERVICO - CAMPOS CERTOS");
  console.log("=".repeat(40));
  
  // [1] Criar cliente
  console.log("\n[1] Criar cliente...");
  const { data: cliente } = await supabase.from("clientes").insert([{
    razao_social: "Cliente OS Teste",
    cnpj: "10.20.30/0001-40",
    status: "ativo"
  }]).select().single();
  const clienteId = cliente.id;
  console.log("Cliente ID:" + clienteId);

  // [2] Criar prestador
  console.log("\n[2] Criar prestador...");
  const { data: prestador } = await supabase.from("prestadores").insert([{
    nome_completo: "Prestador OS Teste",
    cpf_cnpj: "20.30.40/0001-50",
    telefone: "(11) 22222-2222",
    tipo_parceiro: "autonomo",
    status: "ativo"
  }]).select().single();
  const prestadorId = prestador.id;
  console.log("Prestador ID:" + prestadorId);

  // [3] Criar veiculo linked
  console.log("\n[3] Criar veiculo...");
  const { data: veiculo } = await supabase.from("veiculos").insert([{
    placa: "OS001",
    tipo_veiculo: "carro",
    marca: "Fiat",
    modelo: "Uno",
    prestador_vinculado: prestadorId,
    status: "Ativo"
  }]).select().single();
  console.log("Veiculo ID:" + veiculo.id);

  // [4] Criar OS com CAMPOS CERTOS DO SCHEMA
  console.log("\n[4] Criar OS com campos reais...");
  const OS = {
    numero: "OS-" + Date.now(),
    cliente: clienteId,
    prestador: prestadorId,
    veiculo_alocado: veiculo.id,
    status: "pendente",
    tipo_operacao: "transporte",
    carga_tipo: "geral",
    carga_descricao: "Teste automatizado",
    peso: 100,
    volumes: 1,
    valor_cliente: 500,
    distancia_rota: 50
  };

  console.log("Payload OS:" + JSON.stringify(OS));
  
  const { data: osInserida, error: osErro } = await supabase.from("ordens_servico").insert([OS]).select();

  if (osErro) {
    console.log("ERRO OS:" + osErro.message);
    console.log("Campos do schema:" + Object.keys(OS));
    console.log("\nRESULTADO: REPROVADO");
    return;
  }

  console.log("OS inserida:" + JSON.stringify(osInserida));
  const osId = osInserida[0].id;

  // [5] SELECT FINAL
  console.log("\n[5] SELECT FINAL...");
  const { data: osFinal } = await supabase.from("ordens_servico").select("*").eq("id", osId).single();
  console.log(JSON.stringify(osFinal));

  // [6] UPDATE status
  console.log("\n[6] UPDATE status...");
  const { data: osUpdate } = await supabase.from("ordens_servico").update({
    status: "em_andamento"
  }).eq("id", osId).select();

  if (osErro) {
    console.log("ERRO UPDATE:" + osErro.message);
  } else {
    console.log("UPDATE OK");
  }

  // [7] SELECT apos UPDATE
  console.log("\n[7] SELECT APOS UPDATE...");
  const { data: osPosUpdate } = await supabase.from("ordens_servico").select("*").eq("id", osId).single();
  console.log(JSON.stringify(osPosUpdate));

  // Verificar viculos
  const vinculaCliente = osPosUpdate?.cliente === clienteId;
  const vinculaPrestador = osPosUpdate?.prestador === prestadorId;
  const vinculaVeiculo = osPosUpdate?.veiculo_alocado === veiculo.id;

  console.log("\n[8] VINCULOS:");
  console.log("Cliente:" + vinculaCliente);
  console.log("Prestador:" + vinculaPrestador);
  console.log("Veiculo:" + vinculaVeiculo);

  // PERSISTENCIA
  const ok = vinculaCliente && vinculaPrestador && vinculaVeiculo;
  console.log("\n" + "=".repeat(40));
  console.log("RESULTADO:" + (ok ? "APROVADO" : "REPROVADO"));
}

testOS();