// ===================================================================
// roteirizacaoDespachoService.ts
//
// Despacha um roteiro gerado no Roteirizador Web para o App do Motorista.
//
// Estrategia (SEM migrations; apenas colunas reais):
//   1) ordens_servico  — cria a OS "guarda-chuva" do roteiro com `enderecos`
//      JSONB estruturados. Colunas: numero, cliente (uuid), cliente_id (text),
//      prestador (uuid), prestador_id (text), status, tipo_operacao,
//      prioridade, peso, volumes, cubagem, enderecos, romaneio.
//   2) alocacoes_escala — cria a operacao que o App/Torre leem. Colunas reais:
//      data_escala, tipo_veiculo, placa, prestador_id, cliente_id,
//      ordem_servico_id, status ('aguardando_aceite'), regiao, origem,
//      destino, endereco_origem (jsonb), endereco_destino (jsonb),
//      quantidade_paradas, km_previstos, valor_repasse, metadata.
//      OBS.: a tabela NAO possui coluna `veiculo_id`; o App deriva o veiculo
//      por prestador+placa. O id do veiculo vai em metadata.veiculo_id.
//   3) rotas — colunas: nome, status, data_rota, tipo_rota, distancia_km,
//      duracao_min, peso_total, volumes_total, veiculo_sugerido, prestador_id,
//      os_id, cliente_id, motorista, veiculo, numero_paradas, paradas_pendentes,
//      operation_mode, alocacao_id, metadata.
//   4) rota_paradas — colunas: rota_id, sequencia, cliente_nome, telefone, cep,
//      endereco, numero, complemento, bairro, cidade, uf, latitude, longitude,
//      peso, volumes, cubagem, temperatura, prioridade, janela_entrega,
//      janela_inicio, janela_fim, contato_nome, contato_telefone, observacoes,
//      status, metadata.
// ===================================================================
import { supabase } from "@/lib/supabase";
import type { PedidoRoteirizacao, VeiculoRoteirizacao } from "@/types/roteirizacao";

export interface EnderecoEstruturado {
  tipo?: "coleta" | "entrega";
  sequencia?: number;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contato?: string | null;
  telefone?: string | null;
  janela_inicio?: string | null;
  janela_fim?: string | null;
  instrucoes?: string | null;
}

export interface DespachoRotaInput {
  pedidos: PedidoRoteirizacao[];
  veiculo?: VeiculoRoteirizacao | null;
  prestadorId: string | null;
  placa?: string | null;
  tipoVeiculo?: string | null;
  motorista?: string | null;
  regiao?: string | null;
  distanciaKm?: number;
  duracaoMin?: number;
  dataRota?: string;
  rotaNome?: string;
  origem?: EnderecoEstruturado | null;
}

export interface DespachoRotaResultado {
  rotaId: string;
  alocacaoId: string;
  osId: string;
  numeroOs: string;
  totalParadas: number;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function coordOuNull(valor?: number | null): number | null {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor === 0) {
    return null;
  }
  return valor;
}

function hojeSP(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const campo = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value || "";
  return `${campo("year")}-${campo("month")}-${campo("day")}`;
}

/**
 * Despacha a rota para o App do Motorista criando OS + alocacao + rota +
 * paradas em uma sequencia segura (com rollback best-effort em falha).
 */
export async function despacharRotaParaApp(
  input: DespachoRotaInput,
): Promise<DespachoRotaResultado> {
  if (!input.prestadorId) {
    throw new Error("Selecione um motorista/prestador para despachar.");
  }
  if (input.pedidos.length === 0) {
    throw new Error("A rota nao possui paradas para despachar.");
  }

  const dataRota = input.dataRota || hojeSP();
  const tipoVeiculo = input.tipoVeiculo || input.veiculo?.tipoVeiculo ||
    "Van_VUC";
  const placa = input.placa || input.veiculo?.placa || null;

  const totalPeso = input.pedidos.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
  const totalVolumes = input.pedidos.reduce(
    (acc, p) => acc + (p.quantidadeVolumes || 0),
    0,
  );
  const totalCubagem = input.pedidos.reduce(
    (acc, p) => acc + (p.cubagemM3 || 0),
    0,
  );

  // cliente_id (uuid) apenas quando vier de uma OS com uuid valido.
  const clienteId = input.pedidos
    .map((p) => (p.clienteId || "").trim())
    .find((id) => UUID_RE.test(id)) || null;

  const enderecosJson: EnderecoEstruturado[] = input.pedidos.map((p, idx) => ({
    tipo: "entrega",
    sequencia: idx + 1,
    logradouro: p.endereco || p.enderecoCompleto || null,
    numero: p.numero || null,
    complemento: p.complemento || null,
    bairro: p.bairro || null,
    cidade: p.cidade || null,
    uf: p.estado || null,
    cep: p.cep || null,
    latitude: coordOuNull(p.latitude),
    longitude: coordOuNull(p.longitude),
    contato: p.destinatario || p.cliente || null,
    telefone: p.telefone || null,
    janela_inicio: p.janelaInicio || null,
    janela_fim: p.janelaFim || null,
    instrucoes: p.observacoes || null,
  }));

  const numeroOs = `ROT-${Date.now().toString().slice(-9)}`;
  const rotaNome = input.rotaNome || `Rota ${tipoVeiculo} - ${placa || "S/PLACA"}`;

  // ---------- 1) ordens_servico ----------
  const { data: os, error: osError } = await supabase
    .from("ordens_servico")
    .insert([{
      numero: numeroOs,
      cliente: clienteId,
      cliente_id: clienteId,
      prestador: input.prestadorId,
      prestador_id: input.prestadorId,
      status: "em_analise",
      tipo_operacao: "entrega",
      tipo_veiculo: tipoVeiculo,
      prioridade: "normal",
      peso: totalPeso,
      volumes: totalVolumes,
      cubagem: totalCubagem,
      enderecos: enderecosJson,
      romaneio: rotaNome,
    }])
    .select("id")
    .single();

  if (osError || !os) {
    throw new Error(
      "Falha ao criar a OS do roteiro: " + (osError?.message || "sem retorno"),
    );
  }
  const osId = String(os.id);

  // ---------- 2) alocacoes_escala ----------
  const { data: alocacao, error: alocacaoError } = await supabase
    .from("alocacoes_escala")
    .insert([{
      data_escala: dataRota,
      tipo_veiculo: tipoVeiculo,
      placa,
      prestador_id: input.prestadorId,
      cliente_id: clienteId,
      ordem_servico_id: osId,
      status: "aguardando_aceite",
      regiao: input.regiao || null,
      origem: input.origem?.logradouro || null,
      destino: enderecosJson[enderecosJson.length - 1]?.logradouro || null,
      endereco_origem: input.origem || null,
      endereco_destino: enderecosJson[enderecosJson.length - 1] || null,
      quantidade_paradas: input.pedidos.length,
      km_previstos: input.distanciaKm || 0,
      valor_repasse: 0,
      metadata: {
        origem: "roteirizador_web",
        multi_paradas: true,
        veiculo_id: input.veiculo?.id || null,
        motorista: input.motorista || null,
        rota_nome: rotaNome,
      },
    }])
    .select("id")
    .single();

  if (alocacaoError || !alocacao) {
    // rollback best-effort da OS
    await supabase.from("ordens_servico").delete().eq("id", osId);
    throw new Error(
      "Falha ao criar a alocacao no App: " +
        (alocacaoError?.message || "sem retorno"),
    );
  }
  const alocacaoId = String(alocacao.id);

  // ---------- 3) rotas ----------
  const { data: rota, error: rotaError } = await supabase
    .from("rotas")
    .insert([{
      nome: rotaNome,
      status: "pendente",
      data_rota: dataRota,
      tipo_rota: "entrega",
      distancia_km: input.distanciaKm || 0,
      duracao_min: input.duracaoMin || 0,
      peso_total: totalPeso,
      volumes_total: totalVolumes,
      veiculo_sugerido: tipoVeiculo,
      prestador_id: input.prestadorId,
      os_id: osId,
      cliente_id: clienteId,
      motorista: input.motorista || null,
      veiculo: placa,
      numero_paradas: input.pedidos.length,
      paradas_pendentes: input.pedidos.length,
      operation_mode: "multi_stop_route",
      alocacao_id: alocacaoId,
      metadata: { origem: "roteirizador_web", regiao: input.regiao || null },
    }])
    .select("id")
    .single();

  if (rotaError || !rota) {
    await supabase.from("alocacoes_escala").delete().eq("id", alocacaoId);
    await supabase.from("ordens_servico").delete().eq("id", osId);
    throw new Error("Falha ao salvar a rota: " + (rotaError?.message || "sem retorno"));
  }
  const rotaId = String(rota.id);

  // ---------- 4) rota_paradas ----------
  const paradasPayload = input.pedidos.map((p, idx) => ({
    rota_id: rotaId,
    sequencia: idx + 1,
    cliente_nome: p.destinatario || p.cliente || null,
    telefone: p.telefone || null,
    cep: p.cep || null,
    endereco: p.endereco || p.enderecoCompleto || null,
    numero: p.numero || null,
    complemento: p.complemento || null,
    bairro: p.bairro || null,
    cidade: p.cidade || null,
    uf: p.estado || null,
    latitude: coordOuNull(p.latitude),
    longitude: coordOuNull(p.longitude),
    peso: p.pesoKg || 0,
    volumes: p.quantidadeVolumes || 0,
    cubagem: p.cubagemM3 || 0,
    temperatura: p.secoOuRefrigerado === "refrigerado" ? "refrigerado" : "seco",
    prioridade: p.prioridade || "media",
    janela_entrega: (p.janelaInicio || p.janelaFim)
      ? `${p.janelaInicio || ""}–${p.janelaFim || ""}`
      : null,
    janela_inicio: p.janelaInicio || null,
    janela_fim: p.janelaFim || null,
    contato_nome: p.destinatario || p.cliente || null,
    contato_telefone: p.telefone || null,
    observacoes: p.observacoes || null,
    status: "pendente",
    metadata: {
      os_id: osId,
      alocacao_id: alocacaoId,
      pedido_id: p.id,
      email: p.email || null,
      documento: p.documento || null,
    },
  }));

  const { error: paradasError } = await supabase
    .from("rota_paradas")
    .insert(paradasPayload);

  if (paradasError) {
    throw new Error(
      "Rota e alocacao criadas, mas falhou ao salvar as paradas: " +
        paradasError.message,
    );
  }

  return {
    rotaId,
    alocacaoId,
    osId,
    numeroOs,
    totalParadas: input.pedidos.length,
  };
}
