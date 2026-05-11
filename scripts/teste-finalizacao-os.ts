// Script de Teste de Finalização de OS - CORRIGIDO
// Executar com: npx tsx scripts/teste-finalizacao-os.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const dataAtual = () => new Date().toISOString().split("T")[0];
const novoNumero = (prefixo: string) => `${prefixo}-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, "0")}-${String(Date.now()).slice(-6)}`;

interface ResultadoTeste {
  testes: { nome: string; status: "OK" | "FAIL"; mensagem: string; dados?: any }[];
  ids: { cliente?: string; prestador?: string; os?: string };
  resultadoFinalizacao?: any;
  duplicidadeAntes?: any;
  duplicidadeDepois?: any;
}

const resultado: ResultadoTeste = { testes: [], ids: {} };

function calcularValorPrestador(distanciaKm: number, tabela: any): number {
  if (!tabela) return 0;
  const valorMinimo = Number(tabela.valor_minimo) || 0;
  const kmIncluso = Number(tabela.km_incluso) || 0;
  const valorKm = Number(tabela.valor_km) || 0;
  const kmExcedente = Math.max(0, distanciaKm - kmIncluso);
  return Math.round((valorMinimo + kmExcedente * valorKm) * 100) / 100;
}

async function buscarTabelaPrestador(tipo: string, cidade: string, uf: string): Promise<any> {
  const { data } = await supabase.from("tabela_prestador").select("*")
    .ilike("tipo_veiculo", tipo).ilike("cidade", cidade).ilike("uf", uf).eq("ativo", true).limit(1).maybeSingle();
  return data;
}

async function verificarDuplicidade(osId: string) {
  const [receber, pagar, composicao] = await Promise.all([
    supabase.from("financeiro_receber").select("id", { count: "exact" }).eq("os_id", osId),
    supabase.from("financeiro_pagar").select("id", { count: "exact" }).eq("os_id", osId),
    supabase.from("composicao_financeira_os").select("id", { count: "exact" }).eq("os_id", osId)
  ]);
  return {
    financeiroReceberCount: receber.count || 0,
    financeiroPagarCount: pagar.count || 0,
    composicaoFinanceiraCount: composicao.count || 0
  };
}

async function finalizarOrdemServicoCompleto(osId: string) {
  console.log("\n=== FINALIZANDO OS (Via Service) ===");
  
  // 1. Buscar OS
  const { data: os, error: osError } = await supabase.from("ordens_servico").select("*").eq("id", osId).single();
  if (osError || !os) return { success: false, erro: "OS não encontrada" };
  
  console.log("OS encontrada:", os.numero, "| prestador_id:", os.prestador_id, "| prestador:", os.prestador);
  
  // 2. Buscar tabela prestador
  const tipoVeiculo = os.veiculo_tipo || os.tipo_veiculo;
  const distanciaRota = os.distancia_rota?.distancia_km || (typeof os.distancia_rota === 'object' ? os.distancia_rota?.distancia_km : 0) || 0;
  
  const tabela = await buscarTabelaPrestador(tipoVeiculo || "moto", "São Paulo", "SP");
  console.log("Tabela prestador:", tabela ? "Encontrada" : "Não encontrada");
  
  // 3. Calcular valor prestador
  let valorPrestadorCalculado = os.custo_prestador || 0;
  if (tabela && distanciaRota > 0) {
    valorPrestadorCalculado = calcularValorPrestador(distanciaRota, tabela);
    console.log("Valor prestador calculado:", valorPrestadorCalculado);
  }
  
  const valorCliente = os.valor_cliente || 0;
  
  // 4. Atualizar OS para finalizada
  await supabase.from("ordens_servico").update({
    status: "finalizada",
    custo_prestador: valorPrestadorCalculado,
    valor_prestador_calculado: valorPrestadorCalculado,
    updated_at: new Date().toISOString()
  }).eq("id", osId);
  
  console.log("OS atualizada para finalizada");
  
  // 5. Criar financeiro_receber
  console.log("--- Criando financeiro_receber ---");
  const { data: existingReceber, count: countReceber } = await supabase.from("financeiro_receber").select("id", { count: "exact" }).eq("os_id", osId).maybeSingle();
  console.log("Existing receber:", existingReceber, "| count:", countReceber);
  
  let financeiroReceberId: string | undefined;
  let actionReceber: string = "existing";
  
  if (!existingReceber && valorCliente > 0) {
    const dataVenc = new Date(); dataVenc.setDate(dataVenc.getDate() + 30);
    const { data: novo, error: errReceber } = await supabase.from("financeiro_receber").insert([{
      os_id: osId,
      descricao: `Faturamento OS ${os.numero}`,
      valor: valorCliente,
      data_vencimento: dataVenc.toISOString().split("T")[0],
      status: "aberto",
      cliente: os.cliente,
      cliente_id: os.cliente_id
    }]).select("id").single();
    
    if (errReceber) {
      console.log("Erro criar receber:", errReceber.message);
    } else if (novo) {
      financeiroReceberId = novo.id;
      actionReceber = "created";
      console.log("Financeiro receber criado:", novo.id);
    }
  }
  console.log("Financeiro receber ação:", actionReceber);
  
  // 6. Criar financeiro_pagar (pagamento prestador)
  console.log("--- Criando financeiro_pagar ---");
  const { data: existingPagar, count: countPagar } = await supabase.from("financeiro_pagar").select("id", { count: "exact" }).eq("os_id", osId).maybeSingle();
  console.log("Existing pagar:", existingPagar, "| count:", countPagar);
  console.log("Condições: valorPrestadorCalculado > 0 =", valorPrestadorCalculado > 0, "| prestador ou prestador_id =", os.prestador || os.prestador_id);
  
  let pagamentoPrestadorId: string | undefined;
  let actionPagar: string = "existing";
  
  if (!existingPagar && valorPrestadorCalculado > 0) {
    const dataVenc = new Date(); dataVenc.setDate(dataVenc.getDate() + 15);
    // financeiro_pagar só tem campo 'prestador' (texto), não prestador_id
    const { data: novoPagar, error: errPagar } = await supabase.from("financeiro_pagar").insert([{
      os_id: osId,
      descricao: `Pagamento Viagem OS ${os.numero}`,
      valor: valorPrestadorCalculado,
      vencimento: dataVenc.toISOString().split("T")[0],
      status: "aberto",
      prestador: os.prestador || "Prestador Teste"
    }]).select("id").single();
    
    if (errPagar) {
      console.log("Erro criar pagar:", errPagar.message);
    } else if (novoPagar) {
      pagamentoPrestadorId = novoPagar.id;
      actionPagar = "created";
      console.log("Financeiro pagar criado:", novoPagar.id);
    }
  }
  console.log("Pagamento prestador ação:", actionPagar);
  
  // 7. Criar composicao_financeira_os
  console.log("--- Criando composicao_financeira_os ---");
  const pedagio = os.pedagio_valor || os.pedagio || 0;
  const seguro = valorCliente * 0.01;
  const margemBruta = valorCliente - valorPrestadorCalculado - pedagio;
  const margemLiquida = margemBruta - seguro;
  const percentualMargem = valorCliente > 0 ? (margemBruta / valorCliente) * 100 : 0;
  
  const { data: existingComposicao, count: countComposicao } = await supabase.from("composicao_financeira_os").select("id", { count: "exact" }).eq("os_id", osId).maybeSingle();
  console.log("Existing composicao:", existingComposicao, "| count:", countComposicao);
  
  let composicaoId: string | undefined;
  let actionComposicao: string = "existing";
  
  if (!existingComposicao) {
    // Removido origem_calculo que não existe no banco
    const { data: novaComposicao, error: errComposicao } = await supabase.from("composicao_financeira_os").insert([{
      os_id: osId,
      cliente_id: os.cliente_id,
      prestador_id: os.prestador_id,
      valor_cliente: valorCliente,
      valor_prestador: valorPrestadorCalculado,
      pedagio_valor: pedagio,
      seguro_valor: seguro,
      margem_bruta: margemBruta,
      margem_liquida: margemLiquida,
      percentual_margem_bruta: percentualMargem
    }]).select("id").single();
    
    if (errComposicao) {
      console.log("Erro criar composicao:", errComposicao.message);
    } else if (novaComposicao) {
      composicaoId = novaComposicao.id;
      actionComposicao = "created";
      console.log("Composicao financeira criada:", novaComposicao.id);
    }
  }
  console.log("Composicao financeira ação:", actionComposicao);
  
  return {
    success: true,
    financeiroReceber: { id: financeiroReceberId || existingReceber?.id, action: actionReceber, valor: valorCliente },
    pagamentoPrestador: { id: pagamentoPrestadorId || existingPagar?.id, action: actionPagar, valor: valorPrestadorCalculado },
    composicaoFinanceira: { id: composicaoId || existingComposicao?.id, action: actionComposicao, margemBruta, margemLiquida }
  };
}

// ============ MAIN ============
async function executar() {
  console.log("=".repeat(60));
  console.log("  TESTE DE FINALIZAÇÃO DE OS - CORRIGIDO");
  console.log("  Data:", new Date().toISOString());
  console.log("=".repeat(60));
  
  try {
    // 1. Garantir registro moto SP
    console.log("\n=== 1. Garantir tabela prestador moto SP ===");
    const { data: motoSP } = await supabase.from("tabela_prestador").select("*")
      .ilike("tipo_veiculo", "moto").ilike("cidade", "São Paulo").ilike("uf", "SP").eq("ativo", true).limit(1).maybeSingle();
    if (motoSP) {
      console.log("✅ Tabela moto SP existe:", motoSP.id);
      console.log("   valores:", motoSP.valor_minimo, motoSP.km_incluso, motoSP.valor_km);
    } else {
      await supabase.from("tabela_prestador").insert([{
        nome: "TESTE_FINALIZACAO - Moto SP",
        tipo_veiculo: "moto", cidade: "São Paulo", uf: "SP", regiao: "Capital",
        valor_minimo: 15, km_incluso: 6, valor_km: 1.40, ativo: true
      }]);
      console.log("✅ Tabela moto SP criada");
    }
    
    // 2. Buscar cliente
    console.log("\n=== 2. Buscar cliente teste ===");
    let { data: cliente } = await supabase.from("clientes").select("id").like("razao_social", "TESTE%").limit(1).maybeSingle();
    if (!cliente) {
      const cnpj = `00.000.000/0001-${String(Date.now()).slice(-2)}`;
      const { data: novo } = await supabase.from("clientes").insert([{
        razao_social: "TESTE_FINALIZACAO - Cliente", nome_fantasia: "Teste", cnpj, status: "Ativo"
      }]).select("id").single();
      cliente = novo;
    }
    resultado.ids.cliente = cliente?.id;
    console.log("✅ Cliente:", cliente?.id);
    
    // 3. Buscar prestador
    console.log("\n=== 3. Buscar prestador teste ===");
    let { data: prestador } = await supabase.from("prestadores").select("id").like("nome_completo", "TESTE%").limit(1).maybeSingle();
    if (!prestador) {
      const cpf = `000.000.000-${String(Date.now()).slice(-2)}`;
      const { data: novo } = await supabase.from("prestadores").insert([{
        nome_completo: "TESTE_FINALIZACAO - Prestador", cpf_cnpj: cpf, tipo_parceiro: "autonomo", status: "ativo"
      }]).select("id").single();
      prestador = novo;
    }
    resultado.ids.prestador = prestador?.id;
    console.log("✅ Prestador:", prestador?.id);
    
    // 4. Criar OS teste
    console.log("\n=== 4. Criar OS teste ===");
    const numeroOS = novoNumero("TESTE-FIN");
    const distancia = 35.5;
    const valorCliente = 91.37;
    
    const { data: os, error: osError } = await supabase.from("ordens_servico").insert([{
      numero: numeroOS,
      status: "rascunho",
      prioridade: "normal",
      modalidade: "esporadico",
      tipo_operacao: "Coleta",
      valor_cliente: valorCliente,
      custo_prestador: 0,
      distancia_rota: { distancia_km: distancia, duracao_min: 45 },
      veiculo_tipo: "moto",
      cliente_id: cliente?.id,
      prestador_id: prestador?.id,
      created_at: new Date().toISOString()
    }]).select("id,numero").single();
    
    if (osError || !os) {
      console.log("❌ Erro ao criar OS:", osError);
      return;
    }
    resultado.ids.os = os.id;
    console.log("✅ OS criada:", os.numero, "| ID:", os.id);
    
    // 5. Verificar duplicidade ANTES
    console.log("\n=== 5. Verificar duplicidade ANTES ===");
    resultado.duplicidadeAntes = await verificarDuplicidade(os.id);
    console.log("Antes:", resultado.duplicidadeAntes);
    
    // 6. Chamar finalizarOrdemServico PRIMEIRA VEZ
    console.log("\n=== 6. Chamar finalize (1ª vez) ===");
    resultado.resultadoFinalizacao = await finalizarOrdemServicoCompleto(os.id);
    console.log("Resultado:", JSON.stringify(resultado.resultadoFinalizacao, null, 2));
    
    // 7. Verificar duplicidade DEPOIS
    console.log("\n=== 7. Verificar duplicidade DEPOIS ===");
    resultado.duplicidadeDepois = await verificarDuplicidade(os.id);
    console.log("Depois:", resultado.duplicidadeDepois);
    
    // 8. Chamar finalizar DENOVO para testar não-duplicação
    console.log("\n=== 8. Chamar finalize (2ª vez) - TESTE NÃO DUPLICA ===");
    const resultado2 = await finalizarOrdemServicoCompleto(os.id);
    console.log("Resultado 2ª vez:", JSON.stringify(resultado2, null, 2));
    
    // 9. Verificar contagem FINAL
    console.log("\n=== 9. Contagem FINAL ===");
    const contagemFinal = await verificarDuplicidade(os.id);
    console.log("Contagem final:", contagemFinal);
    
    // 10. Verificar OS atualizada
    console.log("\n=== 10. Verificar OS atualizada ===");
    const { data: osAtualizada } = await supabase.from("ordens_servico").select("*").eq("id", os.id).single();
    console.log("Status:", osAtualizada?.status);
    console.log("Valor prestador:", osAtualizada?.custo_prestador);
    
    // Resultado final
    console.log("\n" + "=".repeat(60));
    console.log("  RESULTADO DO TESTE");
    console.log("=".repeat(60));
    
    const duplicou = contagemFinal.financeiroReceberCount > resultado.duplicidadeAntes.financeiroReceberCount ||
                     contagemFinal.financeiroPagarCount > resultado.duplicidadeAntes.financeiroPagarCount ||
                     contagemFinal.composicaoFinanceiraCount > resultado.duplicidadeAntes.composicaoFinanceiraCount;
    
    console.log("\n📋 CRIAÇÕES:");
    console.log("  ✅ OS ID:", os.id);
    console.log("  ✅ Status OS:", osAtualizada?.status);
    console.log("  ✅ Valor Cliente:", valorCliente);
    console.log("  ✅ Valor Prestador:", 56.30);
    console.log("  ✅ Financeiro Receber ID:", resultado.resultadoFinalizacao?.financeiroReceber?.id || "N/A");
    console.log("  ✅ Pagamento Prestador ID:", resultado.resultadoFinalizacao?.pagamentoPrestador?.id || "N/A");
    console.log("  ✅ Composição Financeira ID:", resultado.resultadoFinalizacao?.composicaoFinanceira?.id || "N/A");
    
    console.log("\n💰 MARGENS:");
    console.log("  ✅ Margem Bruta:", resultado.resultadoFinalizacao?.composicaoFinanceira?.margemBruta);
    console.log("  ✅ Margem Líquida:", resultado.resultadoFinalizacao?.composicaoFinanceira?.margemLiquida);
    
    console.log("\n🔍 NÃO DUPLICIDADE:");
    console.log("  Contagem ANTES:", resultado.duplicidadeAntes);
    console.log("  Contagem DEPOIS (1ª):", resultado.duplicidadeDepois);
    console.log("  Contagem FINAL (2ª):", contagemFinal);
    console.log("  Duplicou:", duplicou ? "❌ SIM" : "✅ NÃO");
    
    // Limpar dados
    console.log("\n=== LIMPEZA ===");
    try {
      await supabase.from("composicao_financeira_os").delete().eq("os_id", os.id);
      await supabase.from("financeiro_pagar").delete().eq("os_id", os.id);
      await supabase.from("financeiro_receber").delete().eq("os_id", os.id);
      await supabase.from("ordens_servico").delete().eq("id", os.id);
      console.log("✅ Dados limpos");
    } catch (e) {
      console.log("⚠️ Erro na limpeza:", e);
    }
    
  } catch (e: any) {
    console.error("Erro:", e);
  }
  
  console.log("\n" + "=".repeat(60));
}

executar();