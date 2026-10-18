import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const N = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

async function main() {
  // 1. Find a cliente with tabela_valores
  console.log("=== 1. BUSCANDO DADOS REAIS ===\n");

  const { data: tabelas } = await supabase
    .from("tabelas_valores")
    .select("id, nome, tipo_veiculo, cliente, universal, valor_base, valor_km, valor_minimo, franquia_km, km_franquia, valor_km_excedente, percentual_prestador, adicionais")
    .not("cliente", "is", null)
    .not("cliente", "eq", "")
    .limit(1);

  if (!tabelas || tabelas.length === 0) {
    console.log("❌ Nenhuma tabela_valores com cliente encontrada");
    process.exit(1);
  }

  const tv = tabelas[0];
  console.log(`📋 Tabela: ${tv.nome}`);
  console.log(`   Cliente: "${tv.cliente}" | Veículo: ${tv.tipo_veiculo}`);
  console.log(`   Base: R$ ${tv.valor_base} | KM: R$ ${tv.valor_km} | Mínimo: R$ ${tv.valor_minimo}`);
  console.log(`   Franquia: ${tv.franquia_km ?? tv.km_franquia}km | KM exc: R$ ${tv.valor_km_excedente}`);
  console.log(`   % Prestador: ${tv.percentual_prestador}%`);

  // Find the client by nome_fantasia matching the tabela.cliente
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, razao_social, nome_fantasia, cidade, uf, aliquota_iss")
    .eq("nome_fantasia", tv.cliente)
    .limit(1);

  if (!clientes || clientes.length === 0) {
    console.log("❌ Cliente não encontrado pelo nome");
    process.exit(1);
  }

  const cliente = clientes[0];
  console.log(`\n📋 Cliente: ${cliente.razao_social} (ID: ${cliente.id})`);
  console.log(`   Cidade: ${cliente.cidade}/${cliente.uf} | ISS: ${cliente.aliquota_iss}%`);

  // 2. Find a prestador with financial data
  // prestadores usa 'status' (não 'ativo') e não tem 'tipo_veiculo'
  const { data: prestadores } = await supabase
    .from("prestadores")
    .select("id, nome_completo, valor_diaria, valor_km, franquia_km, valor_saida, valor_ajudante, valor_espera, valor_reentrega, valor_devolucao")
    .in("status", ["ativo", "Ativo"])
    .gt("valor_diaria", 0)
    .limit(5);

  if (!prestadores || prestadores.length === 0) {
    console.log("\n⚠️  Nenhum prestador com valor_diaria > 0. Buscando qualquer prestador ativo...");
    const { data: p2 } = await supabase
      .from("prestadores")
      .select("id, nome_completo, valor_diaria, valor_km, franquia_km, valor_saida, valor_ajudante, valor_espera, valor_reentrega, valor_devolucao")
      .limit(5);
    if (!p2 || p2.length === 0) {
      console.log("❌ Nenhum prestador encontrado");
      process.exit(1);
    }
    prestadores.push(...p2);
  }

  const prestador = prestadores[0];
  console.log(`\n📋 Prestador: ${prestador.nome_completo} (ID: ${prestador.id})`);
  console.log(`   Diária: R$ ${prestador.valor_diaria} | KM: R$ ${prestador.valor_km} | Franquia: ${prestador.franquia_km}km`);
  console.log(`   Saída: R$ ${prestador.valor_saida} | Ajudante: R$ ${prestador.valor_ajudante} | Espera: R$ ${prestador.valor_espera}`);

  // 3. Find a veículo for this prestador
  const { data: veiculos } = await supabase
    .from("veiculos")
    .select("id, placa, tipo_veiculo, prestador_vinculado")
    .eq("prestador_vinculado", prestador.id)
    .limit(1);

  const veiculo = veiculos?.[0];
  console.log(`\n📋 Veículo: ${veiculo?.placa || "N/A"} | Tipo: ${veiculo?.tipo_veiculo || tv.tipo_veiculo}`);

  // 4. Get tenant
  const { data: tenant } = await supabase.rpc("current_tenant_id_safe" as any);
  const tenantId = tenant as string || "00000000-0000-0000-0000-000000000001";
  console.log(`\n📋 Tenant: ${tenantId}`);

  // Now run the pricing engine
  console.log("\n\n=== 2. EXECUTANDO ENGINE DE PRECIFICAÇÃO ===\n");

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const baseDir = resolve(__dirname, "..");
  const { buscarTabelaValoresCliente, buscarTabelaPrestador, buscarAliquotaIss } = await import(
    pathToFileURL(resolve(baseDir, "src", "services", "precificacao", "buscarTabelasService.ts")).href
  );
  const { calcularPreco } = await import(
    pathToFileURL(resolve(baseDir, "src", "services", "precificacao", "precificacaoEngineService.ts")).href
  );

  const input = {
    tenant_id: tenantId,
    cliente_id: cliente.id,
    prestador_id: prestador.id,
    veiculo_id: veiculo?.id || "",
    tipo_veiculo: veiculo?.tipo_veiculo || tv.tipo_veiculo,
    tipo_operacao: "dedicado" as const,
    distancia_km: 150,
    quantidade_paradas: 2,
    origem: { cidade: "SAO PAULO", uf: "SP" },
    destino: { cidade: "CAMPINAS", uf: "SP" },
    minutos_espera: 90,
    modo: "preview" as const,
  };

  console.log("📥 Input:", JSON.stringify(input, null, 2));
  console.log("");

  const result = await calcularPreco(input);

  console.log("📤 OUTPUT\n");
  console.log(`Sucesso: ${result.sucesso}`);
  console.log(`Modo: ${result.modo}`);
  console.log(`\n--- CLIENTE ---`);
  console.log(`Tabela: ${result.cliente.tabela_aplicada.nome} (${result.cliente.tabela_aplicada.fonte})`);
  console.log(`Valor base: R$ ${result.cliente.valor_base.toFixed(2)}`);
  console.log(`Total adicionais: R$ ${result.cliente.total_adicionais.toFixed(2)}`);
  console.log(`Total cliente: R$ ${result.cliente.total.toFixed(2)}`);

  console.log(`\n--- PRESTADOR ---`);
  console.log(`Tabela: ${result.prestador.tabela_aplicada.nome} (${result.prestador.tabela_aplicada.fonte})`);
  console.log(`Valor base: R$ ${result.prestador.valor_base.toFixed(2)}`);
  console.log(`KM: franquia=${result.prestador.detalhes_km.franquia}km, excedente=${result.prestador.detalhes_km.excedente}km, valor_km=R$ ${result.prestador.detalhes_km.valor_km}, total=R$ ${result.prestador.detalhes_km.total_excedente.toFixed(2)}`);
  console.log(`Total adicionais: R$ ${result.prestador.total_adicionais.toFixed(2)}`);
  console.log(`Total descontos: R$ ${result.prestador.total_descontos.toFixed(2)}`);
  console.log(`Total prestador: R$ ${result.prestador.total.toFixed(2)}`);

  console.log(`\n--- MARGEM ---`);
  console.log(`Bruta: R$ ${result.margem.bruta.toFixed(2)} (${result.margem.percentual_bruta}%)`);
  console.log(`Imposto (${result.margem.imposto_percentual}%): R$ ${result.margem.imposto_valor.toFixed(2)}`);
  console.log(`Seguro (1%): R$ ${result.margem.seguro_valor.toFixed(2)}`);
  console.log(`Líquida: R$ ${result.margem.liquida.toFixed(2)} (${result.margem.percentual_liquida}%)`);

  console.log(`\n--- FONTES DE DADOS ---`);
  Object.entries(result.fontes_dados).forEach(([k, v]) => console.log(`  ${k}: ${v ? "✅" : "❌"}`));

  if (result.alertas.length > 0) {
    console.log(`\n--- ALERTAS (${result.alertas.length}) ---`);
    result.alertas.forEach(a => console.log(`  [${a.tipo}] ${a.mensagem}`));
  }

  if (result.regras_aplicadas.length > 0) {
    console.log(`\n--- REGRAS APLICADAS ---`);
    result.regras_aplicadas.forEach(r => console.log(`  ${r.tipo}: ${r.descricao}`));
  }

  console.log(`\n--- MEMÓRIA DE CÁLCULO ---`);
  result.memoria_calculo.forEach((m, i) => console.log(`  ${m}`));

  console.log(`\n✅ Teste concluído.`);
}

main().catch(e => {
  console.error("❌ Erro:", e.message);
  process.exit(1);
});
