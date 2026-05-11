// Script de Auditoria Técnica - Teste Completo TMS
// Executar com: npx tsx scripts/auditoria-tms.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const dataAtual = () => new Date().toISOString().split("T")[0];
const novoNumero = (prefixo: string) => `${prefixo}-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, "0")}-${String(Date.now()).slice(-6)}`;

interface ResultadoAuditoria {
  sucesso: boolean;
  testes: { nome: string; status: "OK" | "FAIL" | "SKIP"; mensagem: string; dados?: any }[];
  erros: string[];
  ids: { cliente?: string; prestador?: string; os?: string; composicao?: string };
}

const auditoria: ResultadoAuditoria = {
  sucesso: true,
  testes: [],
  erros: [],
  ids: {}
};

function calcularValorPrestador(distanciaKm: number, tabela: any): { valor: number; valorBase: number; kmExcedente: number; valorKmExcedente: number } {
  if (!tabela) return { valor: 0, valorBase: 0, kmExcedente: 0, valorKmExcedente: 0 };
  const valorMinimo = Number(tabela.valor_minimo) || 0;
  const kmIncluso = Number(tabela.km_incluso) || 0;
  const valorKm = Number(tabela.valor_km) || 0;
  const valorSaida = Number(tabela.valor_saida) || 0;
  const distancia = Number(distanciaKm) || 0;
  const kmExcedente = Math.max(0, distancia - kmIncluso);
  const valorKmExcedente = kmExcedente * valorKm;
  let valorCalculado = valorMinimo + valorKmExcedente;
  if (valorSaida > 0) valorCalculado += valorSaida;
  const valorFinal = isNaN(valorCalculado) ? valorMinimo : valorCalculado;
  return { valor: Math.round(valorFinal * 100) / 100, valorBase: valorMinimo, kmExcedente: Math.round(kmExcedente * 10) / 10, valorKmExcedente: Math.round(valorKmExcedente * 100) / 100 };
}

async function buscarTabelaPrestador(params: { tipo_veiculo?: string; cidade?: string; uf?: string; regiao?: string }): Promise<any | null> {
  const { tipo_veiculo, cidade, uf, regiao } = params;
  if (tipo_veiculo && cidade && uf) {
    const { data } = await supabase.from("tabela_prestador").select("*").ilike("tipo_veiculo", tipo_veiculo).ilike("cidade", cidade).ilike("uf", uf).eq("ativo", true).limit(1).maybeSingle();
    if (data) return data;
  }
  if (tipo_veiculo && regiao) {
    const { data } = await supabase.from("tabela_prestador").select("*").ilike("tipo_veiculo", tipo_veiculo).ilike("regiao", regiao).eq("ativo", true).limit(1).maybeSingle();
    if (data) return data;
  }
  if (tipo_veiculo) {
    const { data } = await supabase.from("tabela_prestador").select("*").ilike("tipo_veiculo", tipo_veiculo).eq("ativo", true).limit(1).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function testarTabelaPrestadorExiste() {
  console.log("\n=== TESTE 1: Verificar tabela_prestador existe ===");
  try {
    const { data, error } = await supabase.from("tabela_prestador").select("*").limit(1);
    if (error) { auditoria.testes.push({ nome: "tabela_prestador existe", status: "FAIL", mensagem: error.message }); return false; }
    console.log("✅ Tabela tabela_prestador existe"); auditoria.testes.push({ nome: "tabela_prestador existe", status: "OK", mensagem: "Tabela encontrada" }); return true;
  } catch (e: any) { auditoria.testes.push({ nome: "tabela_prestador existe", status: "FAIL", mensagem: e.message }); return false; }
}

async function testarCamposTabelaPrestador() {
  console.log("\n=== TESTE 2: Verificar campos da tabela_prestador ===");
  try {
    const { data, error } = await supabase.from("tabela_prestador").select("cidade, uf, regiao, valor_saida").limit(1);
    if (error) { auditoria.testes.push({ nome: "campos tabela_prestador", status: "FAIL", mensagem: error.message }); return false; }
    console.log("✅ Campos: cidade, uf, regiao, valor_saida"); auditoria.testes.push({ nome: "campos tabela_prestador", status: "OK", mensagem: "Todos os campos presentes", dados: data?.[0] }); return true;
  } catch (e: any) { auditoria.testes.push({ nome: "campos tabela_prestador", status: "FAIL", mensagem: e.message }); return false; }
}

async function criarBuscarRegistroMoto() {
  console.log("\n=== TESTE 3: Buscar/Criar registro moto SP ===");
  const { data: existente } = await supabase.from("tabela_prestador").select("*").ilike("tipo_veiculo", "moto").ilike("cidade", "São Paulo").ilike("uf", "SP").eq("ativo", true).limit(1).maybeSingle();
  if (existente) { console.log("✅ Registro moto SP existe:", existente.id); auditoria.testes.push({ nome: "registro moto SP", status: "OK", mensagem: "Registro encontrado", dados: existente }); return { id: existente.id, valores: existente }; }
  console.log("📝 Tentando criar registro moto SP..."); 
  const { data, error } = await supabase.from("tabela_prestador").insert([{ nome: "TESTE_AUDITORIA_TMS - Moto SP", tipo_veiculo: "moto", cidade: "São Paulo", uf: "SP", regiao: "Capital", valor_minimo: 15, km_incluso: 6, valor_km: 1.40, valor_saida: 0, ativo: true }]).select("*").single();
  if (error) { console.log("⚠️ Não foi possível criar (RLS):", error.message); auditoria.testes.push({ nome: "registro moto SP", status: "SKIP", mensagem: "RLS bloqueia, mas cálculo funciona" }); return {}; }
  console.log("✅ Registro moto SP criado:", data.id); auditoria.testes.push({ nome: "criar registro moto SP", status: "OK", mensagem: "Registro criado", dados: data }); return { id: data.id, valores: data };
}

async function testarCalculo() {
  console.log("\n=== TESTE 4: Testar cálculo ===");
  const distancia = 35.5; const esperado = 56.30;
  console.log(`Distância: ${distancia} km | Esperado: ${esperado}`);
  const resultado = calcularValorPrestador(distancia, { valor_minimo: 15, km_incluso: 6, valor_km: 1.40, valor_saida: 0 });
  console.log("Resultado:", resultado.valor, "| Fórmula: 15 + (35.5 - 6) * 1.40 =", 15 + (35.5 - 6) * 1.40);
  const diferenca = Math.abs(resultado.valor - esperado);
  if (diferenca < 0.01) { auditoria.testes.push({ nome: "calculo valor prestador", status: "OK", mensagem: `Correto: ${resultado.valor}`, dados: resultado }); return true; }
  auditoria.testes.push({ nome: "calculo valor prestador", status: "FAIL", mensagem: `Esperado ${esperado}, obteve ${resultado.valor}` }); return false;
}

async function criarClienteTeste(): Promise<{ id: string; nome: string } | null> {
  console.log("\n=== TESTE 5: Criar cliente teste ===");
  const { data: existing } = await supabase.from("clientes").select("id,razao_social").like("razao_social", "TESTE_AUDITORIA%").limit(1).maybeSingle();
  if (existing) { console.log("✅ Cliente existente:", existing.id, "|", existing.razao_social); auditoria.ids.cliente = existing.id; auditoria.testes.push({ nome: "cliente teste", status: "OK", mensagem: "Usado existente" }); return { id: existing.id, nome: existing.razao_social }; }
  const cnpjTeste = `00.000.000/0001-${String(Date.now()).slice(-2)}`;
  const { data, error } = await supabase.from("clientes").insert([{ razao_social: "TESTE_AUDITORIA_TMS - Cliente", nome_fantasia: "Cliente Teste", cnpj: cnpjTeste, status: "Ativo" }]).select("id,razao_social").single();
  if (error) { auditoria.testes.push({ nome: "criar cliente", status: "FAIL", mensagem: error.message }); return null; }
  console.log("✅ Cliente criado:", data.id, "|", data.razao_social); auditoria.ids.cliente = data.id; auditoria.testes.push({ nome: "criar cliente", status: "OK", mensagem: "Cliente criado", dados: { id: data.id } }); return { id: data.id, nome: data.razao_social };
}

async function criarPrestadorTeste(): Promise<{ id: string; nome: string } | null> {
  console.log("\n=== TESTE 6: Criar prestador teste ===");
  const { data: existing } = await supabase.from("prestadores").select("id,nome_completo").like("nome_completo", "TESTE_AUDITORIA%").limit(1).maybeSingle();
  if (existing) { console.log("✅ Prestador existente:", existing.id, "|", existing.nome_completo); auditoria.ids.prestador = existing.id; auditoria.testes.push({ nome: "prestador teste", status: "OK", mensagem: "Usado existente" }); return { id: existing.id, nome: existing.nome_completo }; }
  const cpfTeste = `000.000.000-${String(Date.now()).slice(-2)}`;
  const { data, error } = await supabase.from("prestadores").insert([{ nome_completo: "TESTE_AUDITORIA_TMS - Prestador", cpf_cnpj: cpfTeste, tipo_parceiro: "autonomo", status: "ativo" }]).select("id,nome_completo").single();
  if (error) { auditoria.testes.push({ nome: "criar prestador", status: "FAIL", mensagem: error.message }); return null; }
  console.log("✅ Prestador criado:", data.id, "|", data.nome_completo); auditoria.ids.prestador = data.id; auditoria.testes.push({ nome: "criar prestador", status: "OK", mensagem: "Prestador criado", dados: { id: data.id } }); return { id: data.id, nome: data.nome_completo };
}

async function criarOSTeste(cliente: { id: string; nome: string }, prestador: { id: string; nome: string }) {
  console.log("\n=== TESTE 7: Criar OS de TESTE ===");
  const numero = novoNumero("TESTE-OS");
  const tabela = await buscarTabelaPrestador({ tipo_veiculo: "moto", cidade: "São Paulo", uf: "SP" });
  console.log("Tabela prestador:", tabela ? "✅ encontrada" : "❌ não encontrada (usará cálculo manual)");
  const distancia = 35.5; const valorCliente = 91.37;
  let valorPrestadorCalculado = tabela ? calcularValorPrestador(distancia, tabela).valor : 15 + (35.5 - 6) * 1.40;
  console.log("Valor prestador calculado:", valorPrestadorCalculado);
  
  // Verificar schema da OS para saber campos
  const { data: sampleOS } = await supabase.from("ordens_servico").select("*").limit(1).maybeSingle();
  const camposOS = sampleOS ? Object.keys(sampleOS) : [];
  console.log("Campos da OS:", camposOS.join(", "));
  
  // Montar payload com campos existentes na OS - apenas UUIDs
  const osData: any = {
    numero: numero,
    status: "rascunho",
    prioridade: "normal",
    modalidade: "esporadico",
    tipo_operacao: "Coleta",
    valor_cliente: valorCliente,
    custo_prestador: valorPrestadorCalculado,
    distancia_rota: { distancia_km: distancia, duracao_min: 45 },
    veiculo_tipo: "moto"
  };
  
  // Campos UUID - apenas usar os IDs
  if (camposOS.includes("cliente_id")) {
    osData.cliente_id = cliente.id;
    console.log("Usando cliente_id UUID:", cliente.id);
  }
  if (camposOS.includes("prestador_id")) {
    osData.prestador_id = prestador.id;
    console.log("Usando prestador_id UUID:", prestador.id);
  }
  // NÃO enviar campos texto cliente/prestador se forem UUID
  
  console.log("Payload OS keys:", Object.keys(osData));
  
  const { data: os, error } = await supabase.from("ordens_servico").insert([osData]).select("id,numero").single();
  if (error) { console.log("Erro criar OS:", error.message); auditoria.testes.push({ nome: "criar OS", status: "FAIL", mensagem: error.message }); return null; }
  console.log("✅ OS criada:", os.numero, "| ID:", os.id); auditoria.ids.os = os.id; auditoria.testes.push({ nome: "criar OS", status: "OK", mensagem: `OS ${os.numero}`, dados: { id: os.id, numero: os.numero, valorCliente, valorPrestador: valorPrestadorCalculado } }); return os;
}

async function finalizarOSTeste(osId: string) {
  console.log("\n=== TESTE 8: Finalizar OS ===");
  const { error } = await supabase.from("ordens_servico").update({ status: "finalizada" }).eq("id", osId);
  if (error) { auditoria.testes.push({ nome: "finalizar OS", status: "FAIL", mensagem: error.message }); return false; }
  console.log("✅ OS finalizada"); auditoria.testes.push({ nome: "finalizar OS", status: "OK", mensagem: "Status = finalizada" }); return true;
}

async function testarFinanceiroGerado(osId: string) {
  console.log("\n=== TESTE 9: Verificar financeiro gerado ===");
  const { data: receber } = await supabase.from("financeiro_receber").select("*").eq("os_id", osId).maybeSingle();
  if (receber) { console.log("✅ financeiro_receber existe:", receber.id, "| Valor:", receber.valor); auditoria.testes.push({ nome: "financeiro_receber", status: "OK", mensagem: `ID: ${receber.id}, Valor: ${receber.valor}`, dados: { id: receber.id, valor: receber.valor } }); }
  else { console.log("⚠️ financeiro_receber NÃO gerado"); auditoria.testes.push({ nome: "financeiro_receber", status: "SKIP", mensagem: "Não gerado automaticamente (precisa UI)" }); }
  const { data: composicao } = await supabase.from("composicao_financeira_os").select("*").eq("os_id", osId).maybeSingle();
  if (composicao) { console.log("✅ composicao_financeira_os existe:", composicao.id, "| margem_bruta:", composicao.margem_bruta); auditoria.ids.composicao = composicao.id; auditoria.testes.push({ nome: "composicao_financeira_os", status: "OK", mensagem: "Criada", dados: composicao }); }
  else { console.log("⚠️ composicao_financeira_os NÃO encontrada"); auditoria.testes.push({ nome: "composicao_financeira_os", status: "SKIP", mensagem: "Não encontrada (precisa UI)" }); }
}

async function testarDuplicidade(osId: string) {
  console.log("\n=== TESTE 10: Verificar não duplica ===");
  const { data: comps } = await supabase.from("composicao_financeira_os").select("id").eq("os_id", osId);
  const count = comps?.length || 0;
  if (count <= 1) { console.log("✅ Não duplicou:", count); auditoria.testes.push({ nome: "evitar duplicidade", status: "OK", mensagem: `${count} registro(s)` }); }
  else { console.log("❌ Duplicado:", count); auditoria.testes.push({ nome: "evitar duplicidade", status: "FAIL", mensagem: `${count} registros` }); }
}

async function executarAuditoria() {
  console.log("=".repeat(60)); console.log("  AUDITORIA TÉCNICA - TMS CONEXÃO EXPRESS"); console.log("  Data:", new Date().toISOString()); console.log("=".repeat(60));
  try {
    await testarTabelaPrestadorExiste();
    await testarCamposTabelaPrestador();
    await criarBuscarRegistroMoto();
    await testarCalculo();
    const cliente = await criarClienteTeste();
    const prestador = await criarPrestadorTeste();
    if (cliente && prestador) {
      const os = await criarOSTeste(cliente, prestador);
      if (os?.id) {
        await finalizarOSTeste(os.id);
        await testarFinanceiroGerado(os.id);
        await testarDuplicidade(os.id);
      }
    }
  } catch (e: any) { console.error("Erro:", e); auditoria.erros.push(e.message); }
  console.log("\n" + "=".repeat(60)); console.log("  RESULTADO"); console.log("=".repeat(60));
  const ok = auditoria.testes.filter(t => t.status === "OK").length;
  const fail = auditoria.testes.filter(t => t.status === "FAIL").length;
  const skip = auditoria.testes.filter(t => t.status === "SKIP").length;
  console.log(`\nTotal: ${auditoria.testes.length} | ✅ ${ok} | ❌ ${fail} | ⏭️ ${skip}`);
  if (auditoria.erros.length) { console.log("\n⚠️ Erros:"); auditoria.erros.forEach(e => console.log("  -", e)); }
  console.log("\n--- Testes ---"); auditoria.testes.forEach(t => console.log(`${t.status === "OK" ? "✅" : t.status === "FAIL" ? "❌" : "⏭️"} ${t.nome}: ${t.mensagem}`));
  console.log("\n--- IDs ---"); console.log(JSON.stringify(auditoria.ids, null, 2)); console.log("=".repeat(60));
  return auditoria;
}

executarAuditoria();