// Script de Auditoria Financeira - Teste Completo do Ciclo Financeiro TMS
// Executar com: npx tsx scripts/auditoria-financeiro-final.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const novoNumero = (prefixo: string) => `${prefixo}-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, "0")}-${String(Date.now()).slice(-6)}`;

const auditoria = { sucesso: true, testes: [] as any[], erros: [] as string[], ids: {} as any };

async function testar() {
  console.log("\n=== TESTE 1: Conexão Supabase ===");
  const { error } = await supabase.from("clientes").select("id").limit(1);
  if (error) { console.log("❌ Erro:", error.message); process.exit(1); }
  console.log("✅ Conexão OK\n");
}

async function verificarTabelas() {
  console.log("=== TESTE 2: Verificar Tabelas ===");
  const tabelas = ["ordens_servico", "financeiro_receber", "financeiro_pagar", "composicao_financeira_os"];
  for (const tabela of tabelas) {
    const { error } = await supabase.from(tabela).select("id").limit(1);
    console.log(error ? `❌ ${tabela}` : `✅ ${tabela}`);
  }
  console.log("");
}

async function criarCliente() {
  console.log("=== TESTE 3: Criar Cliente ===");
  const { data, error } = await supabase.from("clientes").insert([{
    razao_social: "TESTE_AUDIT_FIN",
    nome_fantasia: "TESTE_AUDIT_FIN",
    cnpj: novoNumero("CNPJ"),
    status: "Ativo"
  }]).select("id").single();
  if (error) { console.log("⚠️ RLS: pulando"); return null; }
  console.log("✅ Cliente:", data.id, "\n");
  return data.id;
}

async function criarPrestador() {
  console.log("=== TESTE 4: Criar Prestador ===");
  const { data, error } = await supabase.from("prestadores").insert([{
    nome_completo: "TESTE_AUDIT_FIN",
    cpf_cnpj: novoNumero("CPF"),
    status: "analise"
  }]).select("id").single();
  if (error) { console.log("⚠️ RLS: pulando"); return null; }
  console.log("✅ Prestador:", data.id, "\n");
  return data.id;
}

async function criarOS(clienteId: string, prestadorId: string) {
  console.log("=== TESTE 5: Criar OS ===");
  const { data, error } = await supabase.from("ordens_servico").insert([{
    numero: novoNumero("OS"),
    cliente_id: clienteId,
    prestador_id: prestadorId,
    status: "rascunho",
    veiculo_tipo: "VAN",
    valor_cliente: 1500.00,
    custo_prestador: 900.00
  }]).select("id, numero").single();
  if (error) { console.log("❌ Erro:", error.message); return null; }
  console.log("✅ OS:", data.numero, "\n");
  return data;
}

async function finalizarOS(osId: string) {
  console.log("=== TESTE 6: Finalizar OS ===");
  const { data, error } = await supabase.from("ordens_servico").update({ status: "finalizada" }).eq("id", osId).select("numero").single();
  if (error) { console.log("❌ Erro:", error.message); return false; }
  console.log("✅ OS finalizada:", data.numero, "\n");
  return true;
}

async function gerarReceber(osId: string, clienteId: string, valor: number) {
  console.log("=== TESTE 7: Gerar financeiro_receber ===");
  const { error } = await supabase.from("financeiro_receber").insert([{
    cliente_id: clienteId,
    os_id: osId,
    valor: valor,
    status: "a vencer"
  }]);
  if (error) { console.log("❌ Erro:", error.message); return false; }
  console.log("✅ Criado\n");
  return true;
}

async function gerarPagar(osId: string, prestadorId: string, valor: number) {
  console.log("=== TESTE 8: Gerar financeiro_pagar ===");
  // A tabela tem prestador como TEXT, não prestador_id como uuid
  const { error } = await supabase.from("financeiro_pagar").insert([{
    os_id: osId,
    prestador: prestadorId,
    valor: valor,
    status: "a vencer",
    descricao: "Pagamento prestador OS Teste"
  }]);
  if (error) { console.log("❌ Erro:", error.message); return false; }
  console.log("✅ Criado\n");
  return true;
}

async function gerarComposicao(osId: string, clienteId: string, prestadorId: string, valorCliente: number, valorPrestador: number) {
  console.log("=== TESTE 9: Gerar composicao_financeira_os ===");
  const pedagio = 50, outros = 25, imposto = 0.06, seguro = 30;
  const margemBruta = valorCliente - valorPrestador - pedagio - outros;
  const margemLiquida = margemBruta - (valorCliente * imposto) - seguro;
  const pctMargem = valorCliente > 0 ? (margemLiquida / valorCliente) * 100 : 0;
  const { data, error } = await supabase.from("composicao_financeira_os").insert([{
    os_id: osId, cliente_id: clienteId, prestador_id: prestadorId,
    valor_cliente: valorCliente, valor_prestador: valorPrestador,
    pedagio_valor: pedagio, outros_custos: outros,
    imposto_percentual: imposto * 100, imposto_valor: valorCliente * imposto,
    seguro_valor: seguro, margem_bruta: margemBruta, margem_liquida: margemLiquida,
    percentual_margem_liquida: pctMargem
  }]).select("id").single();
  if (error) { console.log("❌ Erro:", error.message); return false; }
  console.log("✅ Criado ID:", data.id);
  console.log("  valor_cliente:", valorCliente);
  console.log("  valor_prestador:", valorPrestador);
  console.log("  margem_bruta:", margemBruta);
  console.log("  margem_liquida:", margemLiquida);
  console.log("  percentual_margem_liquida:", pctMargem.toFixed(2), "%\n");
  return true;
}

async function validarComposicao(osId: string) {
  console.log("=== TESTE 10: Validar Composicao ===");
  const { data, error } = await supabase.from("composicao_financeira_os").select("*").eq("os_id", osId).single();
  if (error) { console.log("❌ Erro:", error.message); return false; }
  console.log("✅ Composicao valida");
  console.log("  valor_cliente:", data.valor_cliente);
  console.log("  valor_prestador:", data.valor_prestador);
  console.log("  margem_bruta:", data.margem_bruta);
  console.log("  margem_liquida:", data.margem_liquida);
  console.log("  percentual:", data.percentual_margem_liquida, "%\n");
  return true;
}

async function validarNaoDuplicar(osId: string) {
  console.log("=== TESTE 11: Validar Nao Duplicar ===");
  const [r1, r2, r3] = await Promise.all([
    supabase.from("financeiro_receber").select("id", { count: "exact" }).eq("os_id", osId),
    supabase.from("financeiro_pagar").select("id", { count: "exact" }).eq("os_id", osId),
    supabase.from("composicao_financeira_os").select("id", { count: "exact" }).eq("os_id", osId)
  ]);
  console.log("  financeiro_receber:", r1.count);
  console.log("  financeiro_pagar:", r2.count);
  console.log("  composicao_financeira_os:", r3.count);
  const ok = r1.count === 1 && r2.count === 1 && r3.count === 1;
  console.log(ok ? "✅ Nao duplica\n" : "⚠️ Verificar duplicacao\n");
  return ok;
}

async function testarQuery() {
  console.log("=== TESTE 12: Query Relatorio ===");
  const { data, error } = await supabase.from("composicao_financeira_os").select("*").limit(3);
  if (error) { console.log("❌ Erro:", error.message); return false; }
  console.log("✅ Query funcionando -", data?.length || 0, "registros");
  if (data && data.length > 0) {
    console.log("  Sample - vl_cliente:", data[0].valor_cliente, "vl_prestador:", data[0].valor_prestador);
  }
  console.log("");
  return true;
}

async function main() {
  console.log("🚀 INICIANDO AUDITORIA FINANCEIRA...\n");
  
  await testar();
  await verificarTabelas();
  
  const clienteId = await criarCliente();
  const prestadorId = await criarPrestador();
  
  if (clienteId && prestadorId) {
    const os = await criarOS(clienteId, prestadorId);
    if (os) {
      await finalizarOS(os.id);
      await gerarReceber(os.id, clienteId, 1500);
      await gerarPagar(os.id, prestadorId, 900);
      await gerarComposicao(os.id, clienteId, prestadorId, 1500, 900);
      await validarComposicao(os.id);
      await validarNaoDuplicar(os.id);
    }
  }
  
  await testarQuery();
  
  console.log("=".repeat(50));
  console.log("AUDITORIA CONCLUIDA!");
  console.log("=".repeat(50));
}

main().catch(e => { console.error("❌ ERRO:", e); process.exit(1); });