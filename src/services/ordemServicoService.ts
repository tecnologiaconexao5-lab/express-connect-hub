import { supabase } from "@/lib/supabase";
import { buscarTabelaPrestador, calcularValorPrestador, calcularComposicaoFinanceira, salvarComposicaoFinanceira } from "./financeiro/composicaoFinanceiraService";

// Mapeamento de status OS → status Escala
const STATUS_OS_PARA_ESCALA: Record<string, string> = {
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

    const payload: Record<string, any> = {
      ordem_servico_id: osId,
      prestador_id: prestadorId,
      cliente_id: clienteId || null,
      data_escala: dataEscala,
      tipo_veiculo: veiculoTipo,
      placa: os.veiculo_placa || os.veiculoPlaca || null,
      status: statusEscala,
      horario_saida: os.previsao_inicio || os.previsaoInicio || null,
      horario_retorno_previsto: os.previsao_termino || os.previsaoTermino || null,
      km_previstos: os.distancia_km || os.distanciaKm || 0,
      valor_frete: os.valor_cliente || os.valorCliente || 0,
      valor_repasse: os.custo_prestador || os.custoPrestador || 0,
      valor_pedagio: os.pedagio || 0,
      instrucoes_operacionais: os.instrucoes_operacionais_os || os.instrucoesOperacionaisOS || null,
      observacoes: os.observacoes_gerais || os.observacoesGerais || null,
      metadata: {
        origem: "ordem_servico",
        os_numero: os.numero,
        os_status: os.status,
        tipo_operacao: os.tipo_operacao || os.tipoOperacao,
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
export async function sincronizarFinanceiroOS(osData: Record<string, any>): Promise<ResultadoFinanceiroOS> {
  const osId = osData.id || osData.osId;
  const osNumero = osData.numero || osData.osNumero || "";
  const valorCliente = Number(osData.valor_cliente || osData.valorCliente || 0);
  const valorPrestador = Number(osData.custo_prestador || osData.custoPrestador || 0);
  const prestadorId = osData.prestador_id || osData.prestadorId;
  let prestadorNome = osData.prestador || "";
  const clienteId = osData.cliente_id || osData.clienteId;
  const clienteNome = osData.cliente || "";
  const dataOS = osData.data || osData.dataProgramada || new Date().toISOString().split("T")[0];
  const pedagio = Number(osData.pedagio_valor || osData.pedagio || 0);

  const resultado: ResultadoFinanceiroOS = { sucesso: false, osId };

    if (!osId) {
    resultado.erro = "OS sem ID";
    return resultado;
  }

  const osStatus = osData.status || "";
  const isCancelada = osStatus === "cancelada";

  try {
    // Buscar prestador_id por nome se necessário
    let prestadorIdReal = prestadorId;
    if (!prestadorIdReal && prestadorNome) {
      const { data: pData } = await supabase
        .from("prestadores")
        .select("id")
        .eq("nome", prestadorNome)
        .limit(1)
        .maybeSingle();
      if (pData) prestadorIdReal = pData.id;
    }

    // Buscar dados completos do prestador
    let prestadorDocumento = "";
    if (prestadorIdReal) {
      const { data: pd } = await supabase
        .from("prestadores")
        .select("nome_completo, cpf_cnpj")
        .eq("id", prestadorIdReal)
        .maybeSingle();
      if (pd) {
        prestadorNome = pd.nome_completo || prestadorNome;
        prestadorDocumento = pd.cpf_cnpj || "";
      }
    }

    // 1. Financeiro Receber
    if (valorCliente > 0 && !isCancelada) {
      const { data: existenteRec } = await supabase
        .from("financeiro_receber")
        .select("id")
        .eq("os_id", osId)
        .limit(1)
        .maybeSingle();

      if (existenteRec) {
        await supabase
          .from("financeiro_receber")
          .update({
            valor: valorCliente,
            descricao: `Faturamento OS ${osNumero}`,
            cliente: clienteNome,
            cliente_id: clienteId || null,
            status: "aberto",
          })
          .eq("id", existenteRec.id);
        resultado.financeiroReceber = { id: existenteRec.id, valor: valorCliente, action: "updated" };
      } else {
        const dataVencimento = new Date();
        dataVencimento.setDate(dataVencimento.getDate() + 30);
        const { data: novo, error } = await supabase
          .from("financeiro_receber")
          .insert([{
            os_id: osId,
            descricao: `Faturamento OS ${osNumero}`,
            valor: valorCliente,
            data_vencimento: dataVencimento.toISOString().split("T")[0],
            status: "aberto",
            cliente: clienteNome,
            cliente_id: clienteId || null,
          }])
          .select("id,valor")
          .single();
        if (novo) resultado.financeiroReceber = { id: novo.id, valor: novo.valor, action: "created" };
        else if (error) console.error("[FinanceiroAuto] Erro criar receber:", error.message);
      }
    } else {
      // Cancelar receber existente se OS cancelada ou valor zerado
      const { data: existenteRec } = await supabase
        .from("financeiro_receber")
        .select("id")
        .eq("os_id", osId)
        .limit(1)
        .maybeSingle();
      if (existenteRec) {
        await supabase
          .from("financeiro_receber")
          .update({
            valor: 0,
            status: "cancelado",
          })
          .eq("id", existenteRec.id);
        resultado.financeiroReceber = { id: existenteRec.id, valor: 0, action: "updated" };
      }
    }

    // 2. Pagamento Prestador
    if (valorPrestador > 0 && (prestadorIdReal || prestadorNome) && !isCancelada) {
      const { data: existePg } = await supabase
        .from("pagamentos_prestadores")
        .select("id")
        .eq("os_id", osId)
        .limit(1)
        .maybeSingle();

      if (existePg) {
        await supabase
          .from("pagamentos_prestadores")
          .update({
            prestador_id: prestadorIdReal || null,
            prestador_nome: prestadorNome,
            prestador_documento: prestadorDocumento,
            cliente_id: clienteId || null,
            cliente_nome: clienteNome || null,
            valor: valorPrestador,
            valor_liquido: valorPrestador,
            valor_servicos: valorPrestador,
            os_numero: osNumero,
            data_competencia: dataOS,
          })
          .eq("id", existePg.id);
        resultado.pagamentoPrestador = { id: existePg.id, valor: valorPrestador, action: "updated" };
      } else {
        const { data: novo, error } = await supabase
          .from("pagamentos_prestadores")
          .insert([{
            prestador_id: prestadorIdReal || null,
            prestador_nome: prestadorNome,
            prestador_documento: prestadorDocumento,
            cliente_id: clienteId || null,
            cliente_nome: clienteNome || null,
            os_id: osId,
            os_numero: osNumero,
            tipo_lancamento: "Serviço OS",
            natureza: "credito",
            valor: valorPrestador,
            valor_liquido: valorPrestador,
            valor_servicos: valorPrestador,
            data_competencia: dataOS,
            data_prevista_pagamento: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
            status_conferencia: "em_aberto",
            status_pagamento: "pendente",
            origem_lancamento: "os_finalizada",
            quantidade_os: 1,
            periodo_inicio: dataOS,
            periodo_fim: dataOS,
            categoria_financeira: "Custo Logístico",
          }])
          .select("id,valor")
          .single();
        if (novo) resultado.pagamentoPrestador = { id: novo.id, valor: novo.valor, action: "created" };
        else if (error) console.error("[FinanceiroAuto] Erro criar pagamento:", error.message);
      }
    } else {
      // Cancelar pagamento existente se OS cancelada, sem prestador, ou valor zerado
      const { data: existePg } = await supabase
        .from("pagamentos_prestadores")
        .select("id")
        .eq("os_id", osId)
        .limit(1)
        .maybeSingle();
      if (existePg) {
        await supabase
          .from("pagamentos_prestadores")
          .update({
            valor: 0,
            valor_liquido: 0,
            valor_servicos: 0,
            status_conferencia: "cancelado",
            status_pagamento: "cancelado",
          })
          .eq("id", existePg.id);
        resultado.pagamentoPrestador = { id: existePg.id, valor: 0, action: "updated" };
      }
    }

    // 3. Composição Financeira
    const impostoPercentual = 4.5;
    const seguroValor = valorCliente * 0.01;
    const composicaoCalc = calcularComposicaoFinanceira({
      valor_cliente: valorCliente,
      valor_prestador: valorPrestador,
      imposto_percentual: impostoPercentual,
      seguro_valor: seguroValor,
      pedagio_valor: pedagio,
      outros_custos: 0,
    });

    const composicaoSalva = await salvarComposicaoFinanceira(osId, {
      ...composicaoCalc,
      cliente_id: clienteId,
      prestador_id: prestadorIdReal,
    });

    if (composicaoSalva.success && composicaoSalva.id) {
      resultado.composicaoFinanceira = {
        id: composicaoSalva.id,
        margemBruta: composicaoCalc.margem_bruta,
        margemLiquida: composicaoCalc.margem_liquida,
        action: composicaoSalva.id ? "updated" : "created",
      };
    }

    resultado.sucesso = true;
    return resultado;

  } catch (err: any) {
    console.error("[FinanceiroAuto] Erro geral:", err);
    resultado.erro = err.message || "Erro desconhecido";
    return resultado;
  }
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

    tabelaUsada = await buscarTabelaPrestador({
      prestador_id: prestadorId,
      tipo_veiculo: tipoVeiculo,
      cidade,
      uf
    });

    // 4. Calcular valor do prestador se tiver distância e tabela
    if (tabelaUsada && os.distancia_rota) {
      const distanciaKm = os.distancia_rota?.distancia_km || 
                          (typeof os.distancia_rota === 'object' ? os.distancia_rota.distancia_km : 0) ||
                          (os.distancia_km || 0);
      
      if (distanciaKm > 0) {
        const calc = calcularValorPrestador(distanciaKm, tabelaUsada);
        valorPrestadorCalculado = calc.valor;
        console.log("[OrdemServicoService] Valor prestador calculado:", calc);
      }
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

    // 6. Criar/Atualizar financeiro_receber
    if (valorCliente > 0) {
      const { data: existenteReceber } = await supabase
        .from("financeiro_receber")
        .select("id,valor")
        .eq("os_id", osId)
        .limit(1)
        .maybeSingle();

      if (existenteReceber) {
        // Atualizar
        await supabase
          .from("financeiro_receber")
          .update({
            valor: valorCliente,
            descricao: `Faturamento OS ${os.numero}`,
            status: "aberto"
          })
          .eq("id", existenteReceber.id);
        
        result.financeiroReceber = {
          id: existenteReceber.id,
          valor: valorCliente,
          action: "updated"
        };
        console.log("[OrdemServicoService] financeiro_receber atualizado:", existenteReceber.id);
      } else {
        // Criar
        const dataVencimento = new Date();
        dataVencimento.setDate(dataVencimento.getDate() + 30);

        const { data: novoReceber, error: erroReceber } = await supabase
          .from("financeiro_receber")
          .insert([{
            os_id: osId,
            descricao: `Faturamento OS ${os.numero}`,
            valor: valorCliente,
            data_vencimento: dataVencimento.toISOString().split("T")[0],
            status: "aberto",
            cliente: os.cliente,
            cliente_id: os.cliente_id
          }])
          .select("id,valor")
          .single();

        if (erroReceber) {
          console.log("[OrdemServicoService] Erro ao criar financeiro_receber:", erroReceber.message);
        } else if (novoReceber) {
          result.financeiroReceber = {
            id: novoReceber.id,
            valor: novoReceber.valor,
            action: "created"
          };
          console.log("[OrdemServicoService] financeiro_receber criado:", novoReceber.id);
        }
      }
    }

    // 7. Criar/Atualizar pagamento em pagamentos_prestadores (fluxo unificado)
    if (valorPrestadorCalculado > 0 && (os.prestador || os.prestador_id)) {
      // Buscar dados completos do prestador
      let prestadorNome = os.prestador || "";
      let prestadorDocumento = "";
      if (os.prestador_id) {
        const { data: prestadorData } = await supabase
          .from("prestadores")
          .select("nome_completo, cpf_cnpj")
          .eq("id", os.prestador_id)
          .maybeSingle();
        if (prestadorData) {
          prestadorNome = prestadorData.nome_completo || prestadorNome;
          prestadorDocumento = prestadorData.cpf_cnpj || "";
        }
      }

      // Verificar se já existe para evitar duplicidade
      const { data: existentePrestador } = await supabase
        .from("pagamentos_prestadores")
        .select("id, valor")
        .eq("os_id", osId)
        .eq("origem_lancamento", "os_finalizada")
        .limit(1)
        .maybeSingle();

      if (existentePrestador) {
        await supabase
          .from("pagamentos_prestadores")
          .update({
            prestador_nome: prestadorNome,
            prestador_documento: prestadorDocumento,
            cliente_id: os.cliente_id || null,
            cliente_nome: os.cliente || null,
            valor: valorPrestadorCalculado,
            valor_liquido: valorPrestadorCalculado,
            valor_servicos: valorPrestadorCalculado,
            tipo_lancamento: "Serviço OS",
            data_competencia: os.data || new Date().toISOString().split("T")[0],
          })
          .eq("id", existentePrestador.id);

        result.pagamentoPrestador = {
          id: existentePrestador.id,
          valor: valorPrestadorCalculado,
          action: "updated"
        };
        console.log("[OrdemServicoService] pagamentos_prestadores atualizado:", existentePrestador.id);
      } else {
        const { data: novoPrestador, error: erroPrestador } = await supabase
          .from("pagamentos_prestadores")
          .insert([{
            prestador_id: os.prestador_id,
            prestador_nome: prestadorNome,
            prestador_documento: prestadorDocumento,
            cliente_id: os.cliente_id || null,
            cliente_nome: os.cliente || null,
            os_id: osId,
            os_numero: os.numero,
            tipo_lancamento: "Serviço OS",
            natureza: "credito",
            valor: valorPrestadorCalculado,
            valor_liquido: valorPrestadorCalculado,
            valor_servicos: valorPrestadorCalculado,
            data_competencia: os.data || new Date().toISOString().split("T")[0],
            data_prevista_pagamento: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
            status_conferencia: "em_aberto",
            status_pagamento: "pendente",
            origem_lancamento: "os_finalizada",
            quantidade_os: 1,
            periodo_inicio: os.data || new Date().toISOString().split("T")[0],
            periodo_fim: os.data || new Date().toISOString().split("T")[0],
            categoria_financeira: "Custo Logístico",
          }])
          .select("id,valor")
          .single();

        if (erroPrestador) {
          console.error("[OrdemServicoService] Erro ao criar pagamentos_prestadores:", erroPrestador.message);
        } else if (novoPrestador) {
          result.pagamentoPrestador = {
            id: novoPrestador.id,
            valor: novoPrestador.valor,
            action: "created"
          };
          console.log("[OrdemServicoService] pagamentos_prestadores criado:", novoPrestador.id);
        }
      }
    }

    // 8. Criar/Atualizar composicao_financeira_os
    const pedagio = os.pedagio_valor || os.pedagio || 0;
    const impostoPercentual = 4.5; // Default
    const seguroValor = (valorCliente * 0.01); // 1% placeholder

    const composicaoCalc = calcularComposicaoFinanceira({
      valor_cliente: valorCliente,
      valor_prestador: valorPrestadorCalculado,
      imposto_percentual: impostoPercentual,
      seguro_valor: seguroValor,
      pedagio_valor: pedagio,
      outros_custos: 0
    });

    const composicaoSalva = await salvarComposicaoFinanceira(osId, {
      ...composicaoCalc,
      cliente_id: os.cliente_id,
      prestador_id: os.prestador_id
    });

    if (composicaoSalva.success && composicaoSalva.id) {
      // Buscar dados calculados
      const { data: composicaoAtualizada } = await supabase
        .from("composicao_financeira_os")
        .select("*")
        .eq("id", composicaoSalva.id)
        .single();

      result.composicaoFinanceira = {
        id: composicaoSalva.id,
        margemBruta: composicaoAtualizada?.margem_bruta || composicaoCalc.margem_bruta,
        margemLiquida: composicaoAtualizada?.margem_liquida || composicaoCalc.margem_liquida,
        action: composicaoSalva.id ? "updated" : "created"
      };
      console.log("[OrdemServicoService] composicao_financeira_os salva:", composicaoSalva.id);
    }

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
 * Sincroniza financeiro direto de alocacao (sem OS vinculada).
 * Usa alocacao_id como referencia nas tabelas financeiras.
 */
async function sincronizarFinanceiroOSAlocacao(alocId: string, alocData: Record<string, any>): Promise<ResultadoFinanceiroOS> {
  const resultado: ResultadoFinanceiroOS = { sucesso: false, osId: alocId };

  try {
    const valorCliente = Number(alocData.valor_frete || alocData.valor_cliente || alocData.financeiro?.valorCliente || 0);
    const valorPrestador = Number(alocData.valor_repasse || alocData.custo_prestador || alocData.financeiro?.valorFixo || 0);
    const prestadorId = alocData.prestador_id || alocData.prestadorId;
    const prestadorNome = alocData.prestador_nome || alocData.prestador || alocData.prestadorNome || '';
    const clienteId = alocData.cliente_id || alocData.clienteId;
    const clienteNome = alocData.cliente_nome || alocData.cliente || alocData.clienteNome || '';
    const dataEscala = alocData.data_escala || alocData.data || new Date().toISOString().split('T')[0];
    const tipoVeiculo = alocData.tipo_veiculo || alocData.prestadorVeiculo?.tipo_veiculo || '';
    const pedagio = Number(alocData.valor_pedagio || alocData.financeiro?.pedagio || 0);
    const osNumero = `ALOC-${alocId.slice(0, 8)}`;

    console.log("[ESCALA_FINANCEIRO_DEBUG] sincronizarFinanceiroOSAlocacao", {
      alocId,
      valorCliente,
      valorPrestador,
      prestadorId,
      prestadorNome,
      clienteId,
      clienteNome,
      dataEscala,
      osNumero,
    });

    let prestadorIdReal = prestadorId;
    let prestadorDocumento = '';
    if (prestadorIdReal) {
      const { data: pd } = await supabase.from("prestadores").select("nome_completo, cpf_cnpj").eq("id", prestadorIdReal).maybeSingle();
      if (pd) {
        prestadorDocumento = pd.cpf_cnpj || '';
      }
    }

    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() + 30);
    const dataVencStr = dataVencimento.toISOString().split("T")[0];

    if (valorCliente > 0) {
      const { data: existenteRec } = await supabase.from("financeiro_receber").select("id").eq("os_id", alocId).limit(1).maybeSingle();
      if (existenteRec) {
        await supabase.from("financeiro_receber").update({ valor: valorCliente, cliente: clienteNome, cliente_id: clienteId || null, status: "aberto" }).eq("id", existenteRec.id);
        resultado.financeiroReceber = { id: existenteRec.id, valor: valorCliente, action: "updated" };
      } else {
        const { data: novo, error } = await supabase.from("financeiro_receber").insert([{ os_id: alocId, descricao: `Faturamento ${osNumero}`, valor: valorCliente, data_vencimento: dataVencStr, status: "aberto", cliente: clienteNome, cliente_id: clienteId || null }]).select("id,valor").single();
        if (novo) resultado.financeiroReceber = { id: novo.id, valor: novo.valor, action: "created" };
        else if (error) console.error("[FinanceiroAloc] Erro criar receber:", error.message);
      }
    }

    if (valorPrestador > 0 && (prestadorIdReal || prestadorNome)) {
      const { data: existePg } = await supabase.from("pagamentos_prestadores").select("id").eq("os_id", alocId).limit(1).maybeSingle();
      if (existePg) {
        await supabase.from("pagamentos_prestadores").update({ prestador_id: prestadorIdReal || null, prestador_nome: prestadorNome, prestador_documento: prestadorDocumento, cliente_id: clienteId || null, cliente_nome: clienteNome || null, valor: valorPrestador, valor_liquido: valorPrestador, valor_servicos: valorPrestador, os_numero: osNumero, data_competencia: dataEscala }).eq("id", existePg.id);
        resultado.pagamentoPrestador = { id: existePg.id, valor: valorPrestador, action: "updated" };
      } else {
        const { data: novo, error } = await supabase.from("pagamentos_prestadores").insert([{ prestador_id: prestadorIdReal || null, prestador_nome: prestadorNome, prestador_documento: prestadorDocumento, cliente_id: clienteId || null, cliente_nome: clienteNome || null, os_id: alocId, os_numero: osNumero, tipo_lancamento: "Serviço Escala", natureza: "credito", valor: valorPrestador, valor_liquido: valorPrestador, valor_servicos: valorPrestador, data_competencia: dataEscala, data_prevista_pagamento: dataVencStr, status_conferencia: "em_aberto", status_pagamento: "pendente", origem_lancamento: "escala_direta", quantidade_os: 1, periodo_inicio: dataEscala, periodo_fim: dataEscala, categoria_financeira: "Custo Logístico" }]).select("id,valor").single();
        if (novo) resultado.pagamentoPrestador = { id: novo.id, valor: novo.valor, action: "created" };
        else if (error) console.error("[FinanceiroAloc] Erro criar pagamento:", error.message);
      }
    }

    resultado.sucesso = true;
    return resultado;
  } catch (err: any) {
    console.error("[FinanceiroAloc] Erro geral:", err);
    resultado.erro = err.message;
    return resultado;
  }
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
    console.log("[ESCALA_FINANCEIRO_DEBUG] Sem OS vinculada, sincronizando financeiro direto");
    const syncResult = await sincronizarFinanceiroOSAlocacao(alocId, alocacaoData);
    if (syncResult.sucesso) {
      console.log("[ESCALA_FINANCEIRO_DEBUG] Financeiro direto OK:", JSON.stringify(syncResult));
      return { sucesso: true, acao: "financeiro_direto", mensagem: "Financeiro sincronizado diretamente da alocação" };
    }
    console.error("[ESCALA_FINANCEIRO_DEBUG] Financeiro direto falhou:", syncResult.erro);
    return { sucesso: false, acao: "financeiro_falhou", erro: syncResult.erro || "Financeiro não sincronizado" };
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

    // Sincronizar financeiro após atualizar OS
    const osDataCompleto = { ...updatePayload, id: osId, numero: osAtual.id };
    sincronizarFinanceiroOS(osDataCompleto).catch((e) =>
      console.error("[SyncOSEscala] Financeiro não sincronizado:", e.message)
    );

    return { sucesso: true, acao: "atualizada", osId, mensagem: "OS atualizada a partir da Escala" };
  } catch (err: any) {
    console.error("[SyncOSEscala] Erro geral:", err);
    return { sucesso: false, acao: "ignorada", erro: err.message };
  }
}

// Função para verificar duplicidade
export async function verificarDuplicidadeFinanceira(osId: string): Promise<{
  financeiroReceberCount: number;
  pagamentoPrestadorCount: number;
  composicaoFinanceiraCount: number;
}> {
  const [receber, pagamento, composicao] = await Promise.all([
    supabase.from("financeiro_receber").select("id", { count: "exact" }).eq("os_id", osId),
    supabase.from("pagamentos_prestadores").select("id", { count: "exact" }).eq("os_id", osId),
    supabase.from("composicao_financeira_os").select("id", { count: "exact" }).eq("os_id", osId)
  ]);

  return {
    financeiroReceberCount: receber.count || 0,
    pagamentoPrestadorCount: pagamento.count || 0,
    composicaoFinanceiraCount: composicao.count || 0
  };
}