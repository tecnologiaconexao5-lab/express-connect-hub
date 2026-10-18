import { createClient } from "@supabase/supabase-js";
import { guardHarness } from "../_guard.mjs";

// TMS-FIN-DATA-04D3C3B1 — guard fail-closed ANTES de qualquer conexao/escrita/Storage.
guardHarness("scripts/lab/test-endereco.ts");


const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testEnderecos() {
  console.log("=".repeat(50));
  console.log("TESTE ENDERECOS DO CLIENTE");
  console.log("=".repeat(50));
  
  console.log("\n[0] DESCobrinSchema da tabela...");
  const { data: primeiro } = await supabase.from("enderecos_clientes").select("*").limit(1);
  
  console.log("Colunas diponiveis:", primeiro ? Object.keys(primeiro[0] || {}) : "sem dados - tentando descobrir");
  
  console.log("\n[1] Criando cliente teste...");
  const { data: clienteData, error: clienteError } = await supabase
    .from("clientes")
    .insert([{ razao_social: "Cliente Endereco Teste", cnpj: "99.999.999/0001-99", status: "ativo" }])
    .select()
    .single();

  if (clienteError) {
    console.log("ERRO cliente:", clienteError.message);
    process.exit(1);
  }

  const clienteId = clienteData.id;
  console.log("Cliente criado:", clienteId);

  console.log("\n[2] Testando insert de endereco...");
  
  // Tentar diferentes campos
  const testPayload = {
    cliente_id: clienteId,
    cep: "01234-567",
    numero: "100",
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP"
  };

  const { data: enderecoData, error: enderecoError } = await supabase
    .from("enderecos_clientes")
    .insert([testPayload])
    .select();

  if (enderecoError) {
    console.log("ERRO insert:", enderecoError.message);
    console.log("Detalhes:", enderecoError.details);
  } else {
    console.log("INSERT OK:", JSON.stringify(enderecoData, null, 2));
    
    const enderecoId = enderecoData[0].id;
    
    console.log("\n[3] UPDATE...");
    const { data: updateData, error: updateError } = await supabase
      .from("enderecos_clientes")
      .update({ numero: "200", observacoes: "Atualizado" })
      .eq("id", enderecoId)
      .select();

    if (updateError) {
      console.log("ERRO update:", updateError.message);
    } else {
      console.log("UPDATE OK:", JSON.stringify(updateData, null, 2));
    }

    console.log("\n[4] SELECT FINAL...");
    const { data: finalData } = await supabase
      .from("enderecos_clientes")
      .select("*")
      .eq("id", enderecoId)
      .single();

    console.log(JSON.stringify(finalData, null, 2));

    console.log("\n[5] PERSISTENCIA...");
    const sucesso = finalData?.numero === "200";
    console.log("\n".repeat(50));
    if (sucesso) {
      console.log("RESULTADO FINAL: APROVADO ✓");
    } else {
      console.log("RESULTADO FINAL: REPROVADO");
    }
    console.log("=".repeat(50));
  }
}

testEnderecos();