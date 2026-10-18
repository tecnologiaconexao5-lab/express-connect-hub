import { createClient } from "@supabase/supabase-js";
import { guardHarness } from "../_guard.mjs";

// TMS-FIN-DATA-04D3C3B1 — guard fail-closed ANTES de qualquer conexao/escrita/Storage.
guardHarness("scripts/lab/test-pagar.ts");


const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testContasPagar() {
  console.log("=" .repeat(50));
  console.log("TESTE CONTAS A PAGAR");
  console.log("=".repeat(50));
  
  console.log("\n[0] DESCobrindo colunas da tabela...");
  const { data: primeiro } = await supabase.from("financeiro_pagar").select("*").limit(1);
  
  console.log("Colunas disponiveis:", primeiro ? Object.keys(primeiro[0] || {}) : "sem dados");
  console.log("Primeiro registro:", primeiro ? JSON.stringify(primeiro[0], null, 2) : "sem dados");
  
  // Test INSERT with correct fields based on the read code
  const payloadInsert = {
    fornecedor: "Fornecedor Teste Automatizado",
    fornecedor_documento: "12.345.678/0001-99",
    categoria: "servico",
    centro_resultado: "operacional",
    valor_bruto: 1000.00,
    desconto: 50.00,
    juros: 10.00,
    multa: 5.00,
    impostos_retidos: 0,
    valor_liquido: 965.00,
    data_emissao: new Date().toISOString().split("T")[0],
    data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: "a vencer",
    observacoes: "Teste automatizado via script"
  };

  console.log("\n[1] INSERT - Payload enviado:");
  console.log(JSON.stringify(payloadInsert, null, 2));

  try {
    const { data: insertData, error: insertError } = await supabase
      .from("financeiro_pagar")
      .insert([payloadInsert])
      .select();

    if (insertError) {
      console.log("\n[1] ERRO NO INSERT:");
      console.log("Codigo:", insertError.code);
      console.log("Mensagem:", insertError.message);
      console.log("Detalhes:", insertError.details);
      console.log("\nRESULTADO FINAL: REPROVADO");
      process.exit(1);
    }

    console.log("\n[1] RESPOSTA INSERT:");
    console.log(JSON.stringify(insertData, null, 2));
    
    const idInserido = insertData?.[0]?.id;
    console.log("\n[1] ID GERADO:", idInserido);

    if (!idInserido) {
      console.log("\nRESULTADO FINAL: REPROVADO - Sem ID retornado");
      process.exit(1);
    }

    console.log("\n[2] SELECT APÓS INSERT:");
    const { data: selectData } = await supabase
      .from("financeiro_pagar")
      .select("*")
      .eq("id", idInserido)
      .single();

    console.log(JSON.stringify(selectData, null, 2));

    console.log("\n[3] UPDATE - Atualizando valor:");
    const novoValor = 2000.00;
    const { data: updateData, error: updateError } = await supabase
      .from("financeiro_pagar")
      .update({ 
        valor_bruto: novoValor,
        valor_liquido: novoValor + 10 - 5,
        observacoes: "Atualizado via teste automatizado em " + new Date().toISOString()
      })
      .eq("id", idInserido)
      .select();

    if (updateError) {
      console.log("ERRO NO UPDATE:", updateError.message);
      console.log("\nRESULTADO FINAL: REPROVADO");
      process.exit(1);
    }
    
    console.log("UPDATE OK");

    console.log("\n[4] SELECT APÓS UPDATE:");
    const { data: selectAfterUpdate } = await supabase
      .from("financeiro_pagar")
      .select("*")
      .eq("id", idInserido)
      .single();

    console.log(JSON.stringify(selectAfterUpdate, null, 2));

    console.log("\n[5] PERSISTÊNCIA - Verificando:");
    const { data: persistencia } = await supabase
      .from("financeiro_pagar")
      .select("id, valor_bruto, valor_liquido, status")
      .eq("id", idInserido)
      .single();

    console.log("Dados persistidos:", JSON.stringify(persistencia, null, 2));

    const sucesso = persistencia?.id === idInserido && persistencia?.valor_bruto === novoValor;
    
    console.log("\n" + "=".repeat(50));
    if (sucesso) {
      console.log("RESULTADO FINAL: APROVADO ✓");
    } else {
      console.log("RESULTADO FINAL: REPROVADO");
    }
    console.log("=".repeat(50));

  } catch (error) {
    console.log("\nERRO CATCH:", error);
    console.log("\nRESULTADO FINAL: REPROVADO");
  }
}

testContasPagar();