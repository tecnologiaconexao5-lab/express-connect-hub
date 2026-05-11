import { supabase } from "@/lib/supabase";
import { buscarTabelaPrestador, calcularValorPrestador, calcularComposicaoFinanceira, salvarComposicaoFinanceira } from "./financeiro/composicaoFinanceiraService";

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

    // 7. Criar/Atualizar pagamento_prestadores
    if (valorPrestadorCalculado > 0 && (os.prestador || os.prestador_id)) {
      const { data: existentePagar } = await supabase
        .from("financeiro_pagar")
        .select("id,valor")
        .eq("os_id", osId)
        .limit(1)
        .maybeSingle();

      if (existentePagar) {
        // Atualizar
        await supabase
          .from("financeiro_pagar")
          .update({
            valor: valorPrestadorCalculado,
            descricao: `Pagamento Viagem OS ${os.numero}`,
            status: "aberto"
          })
          .eq("id", existentePagar.id);

        result.pagamentoPrestador = {
          id: existentePagar.id,
          valor: valorPrestadorCalculado,
          action: "updated"
        };
        console.log("[OrdemServicoService] financeiro_pagar atualizado:", existentePagar.id);
      } else {
        // Criar
        const dataVencimento = new Date();
        dataVencimento.setDate(dataVencimento.getDate() + 15);

        const { data: novoPagar, error: erroPagar } = await supabase
          .from("financeiro_pagar")
          .insert([{
            os_id: osId,
            descricao: `Pagamento Viagem OS ${os.numero}`,
            valor: valorPrestadorCalculado,
            data_vencimento: dataVencimento.toISOString().split("T")[0],
            status: "aberto",
            prestador: os.prestador,
            prestador_id: os.prestador_id
          }])
          .select("id,valor")
          .single();

        if (erroPagar) {
          console.log("[OrdemServicoService] Erro ao criar financeiro_pagar:", erroPagar.message);
        } else if (novoPagar) {
          result.pagamentoPrestador = {
            id: novoPagar.id,
            valor: novoPagar.valor,
            action: "created"
          };
          console.log("[OrdemServicoService] financeiro_pagar criado:", novoPagar.id);
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

// Função para verificar duplicidade
export async function verificarDuplicidadeFinanceira(osId: string): Promise<{
  financeiroReceberCount: number;
  financeiroPagarCount: number;
  composicaoFinanceiraCount: number;
}> {
  const [receber, pagar, composicao] = await Promise.all([
    supabase.from("financeiro_receber").select("id", { count: "exact" }).eq("os_id", osId),
    supabase.from("financeiro_pagar").select("id", { count: "exact" }).eq("os_id", osId),
    supabase.from("composicao_financeira_os").select("id", { count: "exact" }).eq("os_id", osId)
  ]);

  return {
    financeiraReceberCount: receber.count || 0,
    financeiroPagarCount: pagar.count || 0,
    composicaoFinanceiraCount: composicao.count || 0
  };
}