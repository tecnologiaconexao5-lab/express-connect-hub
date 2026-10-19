import { supabase } from "@/lib/supabase";
import { buscarTabelaPrestador } from "./precificacao/buscarTabelasService";
// M104: Eventos publicados automaticamente por SQL triggers no banco
// import { publicarEvento } from "./eventBus/eventBusService";

// Mapeamento de status OS → status Escala
const STATUS_OS_PARA_ESCALA: Record<string, string> = {
  em_analise: "planejada",
  rascunho: "planejada",
  pendente: "aguardando_aceite",
  agendada: "aceita",
  em_andamento: "aceita",
  em_rota: "em_rota",
  coletado: "em_rota",
  entregue: "concluida",
  finalizada: "concluida",
  cancelada: "cancelada",
  ocorrencia: "ocorrencia",
};

function mapearStatusOSParaEscala(statusOS: string): string {
  return STATUS_OS_PARA_ESCALA[statusOS] || "planejada";
}

export interface ResultadoSincronizacaoEscala {
  sucesso: boolean;
  acao: "criada" | "atualizada" | "ignorada";
  alocacaoId?: string;
  erro?: string;
}

/**
 * Sincroniza OS com alocacao_escala automaticamente.
 * Cria se não existir, atualiza se já existir.
 * Pula se faltarem dados obrigatórios (prestador, data, veiculo).
 */
export async function sincronizarComEscala(os: Record<string, any>): Promise<ResultadoSincronizacaoEscala> {
  try {
    const osId = os.id || os.osId;
    if (!osId) return { sucesso: false, acao: "ignorada", erro: "OS sem ID" };

    const prestadorId = os.prestador_id || os.prestadorId;
    const dataOS = os.data || os.dataProgramada;
    const veiculoTipo = os.veiculo_tipo || os.veiculoTipo;
    const clienteId = os.cliente_id || os.clienteId;

    if (!prestadorId || !dataOS || !veiculoTipo) {
      return { sucesso: false, acao: "ignorada", erro: "Dados insuficientes: prestador, data e veículo obrigatórios" };
    }

    // Verificar se já existe alocação vinculada
    const { data: existente } = await supabase
      .from("alocacoes_escala")
      .select("id, status")
      .eq("ordem_servico_id", osId)
      .limit(1)
      .maybeSingle();

    const statusEscala = mapearStatusOSParaEscala(os.status || "rascunho");
    const dataEscala = dataOS.split("T")[0];

    // Extrair enderecos da OS para origem/destino
    const enderecos = os.enderecos || [];
    const enderecoColeta = Array.isArray(enderecos)
      ? enderecos.find((e: any) => e.tipo === "coleta" || e.tipo === "origem")
      : null;
    const enderecoEntrega = Array.isArray(enderecos)
      ? enderecos.find((e: any) => e.tipo === "entrega" || e.tipo === "destino" || e.tipo === "delivery")
      : null;

    const montarEndereco = (e: any): string | null => {
      if (!e) return null;
      const partes = [e.endereco, e.bairro, e.cidade, e.estado || e.uf].filter(Boolean);
      return partes.length > 0 ? partes.join(", ") : null;
    };

    const montarOperationalAddress = (e: any): Record<string, any> | null => {
      if (!e) return null;
      return {
        tipo_ponto: e.tipo,
        nome_local: e.nomeLocal || null,
        sequencia: e.sequencia,
        endereco: e.endereco || null,
        cep: e.cep || null,
        logradouro: e.logradouro || null,
        numero: e.numero || null,
        complemento: e.complemento || null,
        bairro: e.bairro || null,
        cidade: e.cidade || null,
        estado: e.estado || null,
        uf: e.estado || null,
        endereco_formatado: e.enderecoFormatado || null,
        referencia: e.referencia || null,
        mapbox_place_id: e.mapboxPlaceId || null,
        latitude: e.latitude || null,
        longitude: e.longitude || null,
        contato_nome: e.contatoNome || e.contato || null,
        contato_telefone: e.contatoTelefone || e.telefone || null,
        responsavel: e.responsavel || null,
        recebedor_previsto: e.recebedorPrevisto || e.recebedor || null,
        data_prevista: e.dataPrevista || null,
        janela_inicio: e.janelaInicio || null,
        janela_fim: e.janelaFim || null,
        horario_limite: e.horarioLimite || null,
        instrucoes: e.instrucoes || null,
        observacoes: e.observacoes || null,
        observacao_ponto: e.observacaoPonto || null,
        procedimento_entrada: e.procedimentoEntrada || null,
        procedimento_saida: e.procedimentoSaida || null,
        portaria: e.portaria || null,
        doca: e.doca || null,
        estacionamento: e.estacionamento || null,
        documento_necessario: e.documentoNecessario || null,
        codigo_acesso: e.codigoAcesso || null,
        exigencia_epi: e.exigenciaEpi ?? null,
        exige_ajudante: e.exigeAjudante ?? null,
        restricao_veiculo: e.restricaoVeiculo || null,
        restricao_altura: e.restricaoAltura || null,
        outras_restricoes: e.outrasRestricoes || null,
        restricoes: e.restricoes || null,
        prioridade: e.prioridade || null,
        agendamento: e.agendamento ?? false,
      };
    };

    const extrairHora = (v: any): string | null => {
      if (!v) return null;
      const s = String(v).trim();
      const m = s.match(/(\d{2}):(\d{2})/);
      return m ? `${m[1]}:${m[2]}` : null;
    };

    const payload: Record<string, any> = {
      ordem_servico_id: osId,
      prestador_id: prestadorId,
      cliente_id: clienteId || null,
      data_escala: dataEscala,
      tipo_veiculo: veiculoTipo,
      placa: os.veiculo_placa || os.veiculoPlaca || null,
      status: statusEscala,
      horario_saida: extrairHora(os.previsao_inicio || os.previsaoInicio),
      horario_retorno_previsto: extrairHora(os.previsao_termino || os.previsaoTermino),
      km_previstos: os.distancia_km || os.distanciaKm || 0,
      valor_frete: os.valor_cliente || os.valorCliente || 0,
      valor_repasse: os.custo_prestador || os.custoPrestador || 0,
      valor_pedagio: os.pedagio || 0,
      instrucoes_operacionais: os.instrucoes_operacionais_os || os.instrucoesOperacionaisOS || null,
      observacoes: os.observacoes_gerais || os.observacoesGerais || null,
      origem: montarEndereco(enderecoColeta),
      destino: montarEndereco(enderecoEntrega),
      endereco_origem: montarOperationalAddress(enderecoColeta),
      endereco_destino: montarOperationalAddress(enderecoEntrega),
      rota: os.numero || null,
      metadata: {
        origem: "ordem_servico",
        os_numero: os.numero,
        os_status: os.status,
        tipo_operacao: os.tipo_operacao || os.tipoOperacao,
        precisa_aceite_app: true,
      },
    };

    if (existente) {
      const { error } = await supabase
        .from("alocacoes_escala")
        .update(payload)
        .eq("id", existente.id);

      if (error) {
        console.error("[SincronizacaoEscala] Erro ao atualizar:", error);
        return { sucesso: false, acao: "ignorada", erro: error.message };
      }

      return { sucesso: true, acao: "atualizada", alocacaoId: existente.id };
    }

    const { data: nova, error } = await supabase
      .from("alocacoes_escala")
      .insert([payload])
      .select("id")
      .single();

    if (error) {
      console.error("[SincronizacaoEscala] Erro ao criar:", error);
      return { sucesso: false, acao: "ignorada", erro: error.message };
    }

    return { sucesso: true, acao: "criada", alocacaoId: nova?.id };
  } catch (err: any) {
    console.error("[SincronizacaoEscala] Erro geral:", err);
    return { sucesso: false, acao: "ignorada", erro: err.message };
  }
}

export interface ResultadoFinanceiroOS {
  sucesso: boolean;
  osId: string;
  financeiroReceber?: { id: string; valor: number; action: "created" | "updated" | "ignorado" };
  pagamentoPrestador?: { id: string; valor: number; action: "created" | "updated" | "ignorado" };
  composicaoFinanceira?: { id: string; margemBruta: number; margemLiquida: number; action: "created" | "updated" | "ignorado" };
  erro?: string;
}

/**
 * Sincroniza financeiro automaticamente ao salvar/alterar OS.
 * Cria/atualiza financeiro_receber, pagamentos_prestadores e composicao_financeira_os.
 * Não duplica registros (usa os_id como chave).
 * Pode ser chamada para qualquer status da OS, não apenas finalizada.
 */
/**
 * MISSÃO 80 — Removida persistência financeira do TypeScript.
 * A propagação financeira agora é feita exclusivamente por triggers:
 *   - M66 (trg_propagar_financeiro_alocacao): alocacoes_escala → financeiro
 *   - M80 (trg_propagar_financeiro_os): ordens_servico → financeiro
 *
 * Esta função é mantida como no-op para compatibilidade de callers.
 * Remove calls em Missão 81.
 */
export interface CriarOSInput {
  cliente_id: string;
  cliente: string;
  filial?: string;
  status?: string;

  // Endereços
  origem: string;
  origem_cidade?: string;
  origem_uf?: string;
  destino: string;
  destino_cidade?: string;
  destino_uf?: string;

  // Carga
  descricao?: string;
  peso?: number;
  volumes?: number;
  valor_declarado?: number;
  tipo_carga?: string;
  observacoes?: string;
  comprimento?: number;
  largura?: number;
  altura?: number;

  // Financeiro (cliente-side apenas)
  valor_cliente?: number;
  /**
   * MISSAO OS-MOBILE (item 4) — aditivo, opcional:
   * custo do prestador (repasse). Se prestador_id vier preenchido,
   * o trigger M80 cria financeiro_pagar + pagamentos_prestadores
   * junto com financeiro_receber. Se vier NULL, só o Receber é criado
   * (e quem chama insere o Pagar manualmente para prestador avulso).
   */
  custo_prestador?: number;
  /** UUID de prestadores.id (coluna legada `prestador` da OS) */
  prestador_id?: string;
  /** Texto legado `prestador_id` da OS — recebe o mesmo UUID como string */
  prestador_id_texto?: string;
  /** Veículo alocado (coluna `veiculo_tipo` de ordens_servico) */
  veiculo_tipo?: string;
  /** Placa do veículo alocado (coluna `placa_alocada`) */
  placa?: string;

  // Datas
  data_coleta?: string;
  data_entrega?: string;

  // Metadados
  prioridade?: string;
  tenant_id?: string;
  metadata?: Record<string, any>;

  // OS Mobile (aditivo) — dados ricos de rota/paradas gravados na própria OS
  distancia_km?: number;
  distancia_rota?: Record<string, any>;
  enderecos?: Record<string, any>[];
  carga?: Record<string, any>;
  retorno_obrigatorio?: boolean;
  tempo_estimado?: number;
}

export interface CriarOSResultado {
  sucesso: boolean;
  os_id?: string;
  os_numero?: string;
  erro?: string;
}

/**
 * Cria uma Ordem de Serviço real a partir de dados estruturados.
 * Usa o mapper toOSInsert para garantir compatibilidade com o form TMS.
 * Insere endereços em os_enderecos.
 * Esta é a única função de criação de OS — tanto TMS quanto Portal usam ela.
 */
export async function criarOrdemServico(input: CriarOSInput): Promise<CriarOSResultado> {
  try {
    // Gerar número da OS
    const now = new Date();
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const seq = String(Math.floor(Math.random() * 900000) + 100000).padStart(6, '0');
    const numero = `OS-${ano}${mes}-${seq}`;

    // Montar carga_descricao
    const cargaDescricao = input.descricao || input.tipo_carga || "Portal Cliente";

    // NOTA: ordens_servico.cliente = UUID (FK clientes.id), cliente_id = TEXT (legado)
    // input.cliente_id contém o UUID do cliente
    const payload: Record<string, any> = {
      numero,
      data: new Date().toISOString().split('T')[0],
      cliente_id: input.cliente_id,
      cliente: input.cliente_id,
      unidade: input.filial || null,
      status: input.status || "pendente",
      origem: input.origem,
      destino: input.destino,
      tipo_operacao: input.metadata?.tipo_operacao || "fracionado",
      carga_descricao: cargaDescricao,
      peso: input.peso || 0,
      volumes: input.volumes || 1,
      valor_declarado: input.valor_declarado || 0,
      tipo_carga: input.tipo_carga || "seca",
      observacoes_gerais: input.observacoes || "",
      carga: {
        tipo: input.tipo_carga || "seca",
        descricao: cargaDescricao,
        volumes: input.volumes || 1,
        peso: input.peso || 0,
        cubagem: 0,
        valorDeclarado: input.valor_declarado || 0,
        refrigerada: input.tipo_carga === "refrigerado",
        ...(input.carga || {}),
      },

      // Financeiro (cliente-side)
      valor_cliente: input.valor_cliente || 0,
      custo_prestador: input.custo_prestador || 0,

      // Datas
      data_programada: input.data_coleta || null,

      // Metadados
      prioridade: input.prioridade || "normal",
      veiculo_sugerido: input.metadata?.veiculo_sugerido || null,

      // OS Mobile (aditivo) — rota, paradas e marcador de origem
      distancia_km: input.distancia_km ?? 0,
      distancia_rota: input.distancia_rota || null,
      enderecos: input.enderecos || [],
      retorno_obrigatorio: input.retorno_obrigatorio ?? false,
      tempo_estimado: input.tempo_estimado ?? 0,

      // Controle
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // MISSAO OS-MOBILE (item 4) — prestador + veículo alocado (aditivo):
    // `prestador` (UUID) e `prestador_id` (TEXT) são preenchidos com o
    // MESMO UUID para satisfazer a leitura do trigger M80
    // (NEW.prestador_id::UUID) e as queries legadas do TMS.
    if (input.prestador_id) {
      payload.prestador = input.prestador_id;
      payload.prestador_id = input.prestador_id_texto || input.prestador_id;
    }
    if (input.veiculo_tipo) payload.veiculo_tipo = input.veiculo_tipo;
    if (input.placa) payload.placa_alocada = input.placa;

    if (input.comprimento) payload.comprimento = input.comprimento;
    if (input.largura) payload.largura = input.largura;
    if (input.altura) payload.altura = input.altura;

    // Inserir OS
    const { data: os, error } = await supabase
      .from("ordens_servico")
      .insert([payload])
      .select()
      .single();

    if (error || !os) {
      console.error("[criarOrdemServico] Erro ao criar OS:", error?.message);
      return { sucesso: false, erro: error?.message || "Falha ao criar OS" };
    }

    // Inserir endereços em os_enderecos
    if (os.id && input.metadata?.enderecos) {
      const enderecos = input.metadata.enderecos as any[];
      if (Array.isArray(enderecos) && enderecos.length > 0) {
        const endInsert = enderecos.map((e: any) => ({
          os_id: os.id,
          sequencia: e.sequencia || 0,
          tipo: e.tipo || "entrega",
          nome_local: e.nome_local || e.nomeLocal || "",
          logradouro: e.logradouro || "",
          numero: e.numero || "",
          bairro: e.bairro || "",
          cidade: e.cidade || "",
          estado: e.estado || e.uf || "",
          endereco: e.endereco || "",
          cep: e.cep || "",
          referencia: e.referencia || "",
          responsavel: e.responsavel || "",
          telefone: e.telefone || "",
          email: e.email || "",
          janela_inicio: e.janela_inicio || e.janelaInicio || "",
          janela_fim: e.janela_fim || e.janelaFim || "",
          observacao: e.observacao || e.observacaoPonto || "",
          latitude: e.latitude || null,
          longitude: e.longitude || null,
        }));
        await supabase.from("os_enderecos").insert(endInsert);
      }
    }

    // M104: Evento os.ordem_servico.criada publicado pelo trigger SQL trg_evento_os_criada

    return { sucesso: true, os_id: os.id, os_numero: os.numero };
  } catch (err: any) {
    console.error("[criarOrdemServico] Erro geral:", err);
    return { sucesso: false, erro: err.message || "Erro desconhecido" };
  }
}

export async function sincronizarFinanceiroOS(osData: Record<string, any>): Promise<ResultadoFinanceiroOS> {
  const osId = osData.id || osData.osId;
  if (!osId) {
    return { sucesso: false, osId: "", erro: "OS sem ID" };
  }
  console.log("[M80] sincronizarFinanceiroOS no-op — trigger OS cuida da persistência financeira");
  return { sucesso: true, osId: osId };
}

export interface FinalizarOSResult {
  success: boolean;
  osId: string;
  osNumero: string;
  financeiroReceber?: { id: string; valor: number; action: "created" | "updated" | "existing" };
  pagamentoPrestador?: { id: string; valor: number; action: "created" | "updated" | "existing" };
  composicaoFinanceira?: { id: string; margemBruta: number; margemLiquida: number; action: "created" | "updated" | "existing" };
  erro?: string;
  debug?: any;
}

export async function finalizarOrdemServico(osId: string): Promise<FinalizarOSResult> {
  console.log("[OrdemServicoService] Iniciando finalização da OS:", osId);
  
  const result: FinalizarOSResult = {
    success: false,
    osId,
    osNumero: ""
  };

  try {
    // 1. Buscar OS pelo ID
    const { data: os, error: osError } = await supabase
      .from("ordens_servico")
      .select("*")
      .eq("id", osId)
      .single();

    if (osError || !os) {
      result.erro = "OS não encontrada: " + (osError?.message || "sem dados");
      console.error("[OrdemServicoService] Erro ao buscar OS:", osError);
      return result;
    }

    result.osNumero = os.numero;
    console.log("[OrdemServicoService] OS encontrada:", os.numero, "| Status atual:", os.status);

    // 2. Se já estiver finalizada, apenas retorna info
    if (os.status === "finalizada" || os.status === "encerrada") {
      console.log("[OrdemServicoService] OS já está finalizada");
    }

    // 3. Buscar tabela do prestador
    let valorPrestadorCalculado = os.custo_prestador || os.valor_prestador_calculado || 0;
    let tabelaUsada: any = null;

    // Verificar se tem prestador vinculado
    const prestadorId = os.prestador_id;
    const tipoVeiculo = os.veiculo_tipo || os.tipo_veiculo;

    // Buscar cidade/UF do endereço de entrega
    let cidade = "São Paulo";
    let uf = "SP";
    
    if (os.enderecos && Array.isArray(os.enderecos) && os.enderecos.length > 0) {
      const enderecoEntrega = os.enderecos.find((e: any) => e.tipo === "entrega" || e.tipo === "delivery");
      if (enderecoEntrega) {
        cidade = enderecoEntrega.cidade || cidade;
        uf = enderecoEntrega.uf || enderecoEntrega.estado || uf;
      }
    }

    console.log("[OrdemServicoService] Buscando tabela para:", { prestadorId, tipoVeiculo, cidade, uf });

    const origemEnd = Array.isArray(os.enderecos) ? os.enderecos.find((e: any) => e.tipo === "coleta" || e.tipo === "origem") : null;
    const destinoEnd = Array.isArray(os.enderecos) ? os.enderecos.find((e: any) => e.tipo === "entrega" || e.tipo === "destino") : null;
    const distanciaKm = os.distancia_rota?.distancia_km || os.distancia_km || 0;

    const buscaTabela = await buscarTabelaPrestador({
      tenant_id: os.tenant_id || "",
      cliente_id: os.cliente_id || "",
      tipo_veiculo: tipoVeiculo || "",
      tipo_operacao: "fracionado",
      distancia_km: Number(distanciaKm),
      quantidade_paradas: 1,
      origem: { cidade: origemEnd?.cidade || cidade, uf: origemEnd?.uf || uf, endereco: "", bairro: "", cep: "" },
      destino: { cidade: destinoEnd?.cidade || "", uf: destinoEnd?.uf || "", endereco: "", bairro: "", cep: "" },
      modo: "preview",
      prestador_id: prestadorId || undefined,
    });
    tabelaUsada = buscaTabela?.tabela || null;

    // 4. Calcular valor do prestador se tiver distância e tabela
    if (tabelaUsada && distanciaKm > 0) {
      const vmin = Number(tabelaUsada.valor_minimo) || 0;
      const kmInc = Number(tabelaUsada.km_incluso) || 0;
      const vKm = Number(tabelaUsada.valor_km) || 0;
      const vSaida = Number(tabelaUsada.valor_saida) || 0;
      const kmExc = Math.max(0, distanciaKm - kmInc);
      valorPrestadorCalculado = Math.round((vmin + (kmExc * vKm) + vSaida) * 100) / 100;
      console.log("[OrdemServicoService] Valor prestador calculado:", { valor: valorPrestadorCalculado, kmExc });
    } else if (!tabelaUsada) {
      console.log("[OrdemServicoService] Tabela não encontrada, mantendo valor manual ou 0");
    }

    const valorCliente = os.valor_cliente || 0;

    // 5. Atualizar OS para status finalizada
    const updatePayload: any = {
      status: "finalizada",
      updated_at: new Date().toISOString()
    };

    // Atualizar campos financeiros calculados
    if (valorPrestadorCalculado > 0) {
      updatePayload.custo_prestador = valorPrestadorCalculado;
      updatePayload.valor_prestador_calculado = valorPrestadorCalculado;
    }

    console.log("[OrdemServicoService] Atualizando OS com:", updatePayload);

    const { error: updateError } = await supabase
      .from("ordens_servico")
      .update(updatePayload)
      .eq("id", osId);

    if (updateError) {
      result.erro = "Erro ao atualizar OS: " + updateError.message;
      console.error("[OrdemServicoService] Erro ao atualizar OS:", updateError);
      return result;
    }

    console.log("[OrdemServicoService] OS atualizada para finalizada");

    // M80: Financeiro propagado pelo trigger OS (trg_propagar_financeiro_os) ao atualizar status=finalizada
    // O trigger cuida de financeiro_receber, financeiro_pagar, pagamentos_prestadores, composicao_financeira_os
    console.log("[OrdemServicoService] Financeiro propagado via trigger OS (M80)");

    // M104: Evento os.ordem_servico.finalizada publicado pelo trigger SQL trg_evento_os_finalizada

    result.success = true;
    console.log("[OrdemServicoService] Finalização concluída com sucesso!");
    return result;

  } catch (error: any) {
    console.error("[OrdemServicoService] Erro geral:", error);
    result.erro = error.message || "Erro desconhecido";
    return result;
  }
}

export interface ResultadoSyncOSEscala {
  sucesso: boolean;
  acao: "atualizada" | "sem_os" | "ignorada";
  osId?: string;
  mensagem?: string;
  erro?: string;
}

/**
 * Sincroniza dados da Escala para a OS vinculada.
 * Chamado quando uma alocação é criada/atualizada na Escala.
 * NÃO chama sincronizarComEscala (evita loop).
 */
export async function sincronizarOSEscala(alocacaoData: Record<string, any>): Promise<ResultadoSyncOSEscala> {
  try {
    const alocId = alocacaoData.id || alocacaoData.alocacaoId;
    if (!alocId) return { sucesso: false, acao: "ignorada", erro: "Alocação sem ID" };

  const ordemServicoId = alocacaoData.ordem_servico_id || alocacaoData.os;
  const osId = (typeof ordemServicoId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ordemServicoId)) ? ordemServicoId : null;

  console.log("[ESCALA_FINANCEIRO_DEBUG] sincronizarOSEscala called", {
    alocId,
    ordemServicoId,
    osId,
    valor_frete: alocacaoData.valor_frete,
    valor_repasse: alocacaoData.valor_repasse,
    valor_cliente: alocacaoData.valor_cliente,
    custo_prestador: alocacaoData.custo_prestador,
    prestador_id: alocacaoData.prestador_id,
    cliente_id: alocacaoData.cliente_id,
  });

  if (!osId) {
    // MISSÃO 76: Removida chamada a sincronizarFinanceiroOSAlocacao() que duplicava trigger M66.
    // A trigger SQL f_trg_propagar_financeiro_alocacao já propaga automaticamente
    // os valores de alocacoes_escala para financeiro_receber, pagamentos_prestadores
    // e composicao_financeira_os quando a alocação é inserida/atualizada.
    console.log("[ESCALA_FINANCEIRO_DEBUG] Sem OS vinculada. Trigger M66 cuidará da propagação financeira.");
    return { sucesso: true, acao: "financeiro_trigger_m66", mensagem: "Propagação financeira delegada à trigger M66" };
  }

    let alocacao = alocacaoData;
    if (!alocacao.prestador_id && !alocacao.tipo_veiculo) {
      const { data: alocDB } = await supabase
        .from("alocacoes_escala")
        .select("*")
        .eq("id", alocId)
        .single();
      if (alocDB) alocacao = alocDB;
      else return { sucesso: false, acao: "ignorada", erro: "Alocação não encontrada no banco" };
    }

    // Buscar OS atual
    const { data: osAtual } = await supabase
      .from("ordens_servico")
      .select("id, status")
      .eq("id", osId)
      .single();

    if (!osAtual) return { sucesso: false, acao: "ignorada", erro: "OS vinculada não encontrada" };

    const MAPA_ESCALA_PARA_OS: Record<string, string> = {
      planejada: "agendada",
      aguardando_aceite: "pendente",
      aceita: "agendada",
      recusada: "pendente",
      em_rota: "em_rota",
      concluida: "finalizada",
      cancelada: "cancelada",
      ocorrencia: "ocorrencia",
    };

    const statusOS = MAPA_ESCALA_PARA_OS[alocacao.status] || osAtual.status;

    const updatePayload: Record<string, any> = {
      tipo_veiculo: alocacao.tipo_veiculo || undefined,
      veiculo_placa: alocacao.placa || undefined,
      data_programada: alocacao.data_escala || undefined,
      prestador_id: alocacao.prestador_id || undefined,
      valor_cliente: alocacao.valor_frete || undefined,
      custo_prestador: alocacao.valor_repasse || undefined,
      instrucoes_operacionais_os: alocacao.instrucoes_operacionais || undefined,
      observacoes_gerais: alocacao.observacoes || undefined,
      updated_at: new Date().toISOString(),
    };

    if (alocacao.status && alocacao.status !== osAtual.status) {
      updatePayload.status = statusOS;
    }

    Object.keys(updatePayload).forEach((k) => {
      if (updatePayload[k] === undefined) delete updatePayload[k];
    });

    if (Object.keys(updatePayload).length <= 1) {
      return { sucesso: true, acao: "ignorada", mensagem: "Nenhum campo para atualizar", osId };
    }

    const { error: updError } = await supabase
      .from("ordens_servico")
      .update(updatePayload)
      .eq("id", osId);

    if (updError) {
      console.error("[SyncOSEscala] Erro ao atualizar OS:", updError);
      return { sucesso: false, acao: "ignorada", erro: updError.message };
    }

    // M80: Financeiro propagado pelo trigger OS — não mais pelo TS
    return { sucesso: true, acao: "atualizada", osId, mensagem: "OS atualizada a partir da Programação Operacional" };
  } catch (err: any) {
    console.error("[SyncOSEscala] Erro geral:", err);
    return { sucesso: false, acao: "ignorada", erro: err.message };
  }
}

