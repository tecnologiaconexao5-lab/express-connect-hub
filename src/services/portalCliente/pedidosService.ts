import { supabase } from "@/lib/supabase";
import { criarOrdemServico, type CriarOSInput } from "@/services/ordemServicoService";
import { gerarLinkRastreio } from "@/services/rastreamento/trackingService";
import { gerarEventoComunicacao } from "@/services/communicationHubService";
import { calcularPreco } from "@/services/precificacao/precificacaoEngineService";
import type { PricingInput, PricingOutput } from "@/services/precificacao/types";

export interface PedidoPortal {
  id: string;
  cliente_id?: string;
  numero_pedido: string;
  status: "rascunho" | "enviado" | "em_analise" | "programado" | "coleta" | "em_rota" | "entregue" | "cancelado";
  
  // Solicitante
  solicitante_nome?: string;
  solicitante_email?: string;
  solicitante_telefone?: string;
  
  // Unidade
  filial?: string;
  centro_custo?: string;
  
  // Prioridade
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  
  // Coleta
  coleta_cep?: string;
  coleta_rua?: string;
  coleta_numero?: string;
  coleta_complemento?: string;
  coleta_bairro?: string;
  coleta_cidade?: string;
  coleta_uf?: string;
  coleta_referencia?: string;
  coleta_data?: string;
  
  // Entrega
  entrega_destinatario?: string;
  entrega_telefone?: string;
  entrega_email?: string;
  entrega_notificar_whatsapp?: boolean;
  entrega_notificar_email?: boolean;
  entrega_cep?: string;
  entrega_rua?: string;
  entrega_numero?: string;
  entrega_complemento?: string;
  entrega_bairro?: string;
  entrega_cidade?: string;
  entrega_uf?: string;
  entrega_referencia?: string;
  entrega_data?: string;
  
  // Mercadoria
  descricao?: string;
  volumes?: number;
  peso?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  valor_declarado?: number;
  tipo_carga?: string;
  observacoes?: string;
  
  // Inteligência
  veiculo_sugerido?: string;
  prazo_estimado?: string;
  
  // Automação
  payload_n8n?: Record<string, any>;
  os_vinculada_id?: string;
  metadata?: Record<string, any>;
  
  created_at: string;
  updated_at: string;
}

export interface PedidoFormData {
  // Solicitante
  solicitante_nome?: string;
  solicitante_email?: string;
  solicitante_telefone?: string;
  
  // Unidade
  filial?: string;
  centro_custo?: string;
  
  // Prioridade
  prioridade?: string;
  
  // Coleta
  coleta_cep?: string;
  coleta_rua?: string;
  coleta_numero?: string;
  coleta_complemento?: string;
  coleta_bairro?: string;
  coleta_cidade?: string;
  coleta_uf?: string;
  coleta_referencia?: string;
  coleta_data?: string;
  
  // Entrega
  entrega_destinatario?: string;
  entrega_telefone?: string;
  entrega_email?: string;
  entrega_notificar_whatsapp?: boolean;
  entrega_notificar_email?: boolean;
  entrega_cep?: string;
  entrega_rua?: string;
  entrega_numero?: string;
  entrega_complemento?: string;
  entrega_bairro?: string;
  entrega_cidade?: string;
  entrega_uf?: string;
  entrega_referencia?: string;
  entrega_data?: string;
  
  // Mercadoria
  descricao?: string;
  volumes?: number;
  peso?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  valor_declarado?: number;
  tipo_carga?: string;
  observacoes?: string;
  metadata?: Record<string, any>;
  
  // Coleta Reversa
  reversa?: boolean;
  reversa_tipo?: string;
  reversa_qtd_volumes?: number;
  reversa_unidade?: string;
  reversa_endereco?: string;
  reversa_devolucao?: string;
  reversa_responsavel?: string;
  reversa_telefone?: string;
  reversa_data?: string;
  reversa_instrucoes?: string;
  reversa_observacoes?: string;
}

export interface ConfirmacaoPedidoResultado {
  sucesso: boolean;
  pedido_id?: string;
  os_id?: string;
  os_numero?: string;
  tracking_link?: string;
  preco_final?: number;
  previsao_entrega?: string;
  veiculo_sugerido?: string;
  erro?: string;
}

// =====================================================
// CONFIRMAR PEDIDO → GERA OPERAÇÃO REAL NO TMS
// =====================================================
/**
 * Confirma um pedido do Portal Cliente, criando OS real no TMS.
 * Fluxo completo:
 *   1. Calcula precificação (preview) via Engine oficial
 *   2. Cria Ordem de Serviço via service oficial (criarOrdemServico)
 *   3. Vincula pedido à OS em portal_pedidos
 *   4. Gera link de rastreio público
 *   5. Registra evento de timeline (communication_events)
 *
 * Princípios:
 *   - Reusa services do TMS (ordemServicoService, precificacaoEngineService)
 *   - Cliente vê apenas preço final, prazo e veículo sugerido
 *   - Cliente NUNCA vê margem, custo prestador, composição financeira
 */
export async function confirmarPedidoPortal(
  pedidoId: string,
  clienteId: string,
  clienteNome: string,
  tenantId?: string,
): Promise<ConfirmacaoPedidoResultado> {
  try {
    // 1. Buscar pedido completo
    const { data: pedido, error: pedidoErr } = await supabase
      .from("portal_pedidos")
      .select("*")
      .eq("id", pedidoId)
      .single();

    if (pedidoErr || !pedido) {
      return { sucesso: false, erro: "Pedido não encontrado" };
    }

    if (pedido.status !== "enviado" && pedido.status !== "em_analise" && pedido.status !== "aprovado") {
      if (pedido.status === "convertido" && pedido.ordem_servico_id) {
        const { data: os } = await supabase
          .from("ordens_servico")
          .select("id, numero")
          .eq("id", pedido.ordem_servico_id)
          .single();
        return {
          sucesso: true,
          pedido_id: pedidoId,
          os_id: pedido.ordem_servico_id,
          os_numero: os?.numero,
          preco_final: pedido.metadata?.preco_final || 0,
          tracking_link: pedido.metadata?.tracking_link || "",
        };
      }
      return { sucesso: false, erro: `Pedido em status "${pedido.status}" não pode ser confirmado` };
    }

    // 2. Calcular precificação (preview)
    let precoFinal = 0;
    let veiculoSugeridoFinal = pedido.veiculo_sugerido || "A definir";
    let previsaoEntrega = pedido.prazo_estimado || "A definir";

    try {
      const distanciaKm = pedido.metadata?.distancia_km || 0;
      const tipoVeiculo = pedido.veiculo_sugerido || "";
      const qtdParadas = Array.isArray(pedido.metadata?.paradas)
        ? (pedido.metadata.paradas as any[]).length + 1
        : 1;

      const pricingInput: PricingInput = {
        tenant_id: tenantId || "00000000-0000-0000-0000-000000000000",
        cliente_id: clienteId,
        tipo_veiculo: tipoVeiculo || "Van",
        tipo_operacao: "fracionado",
        distancia_km: distanciaKm || 0,
        quantidade_paradas: qtdParadas,
        origem: {
          cidade: pedido.coleta_cidade || "",
          uf: pedido.coleta_uf || "",
        },
        destino: {
          cidade: pedido.entrega_cidade || "",
          uf: pedido.entrega_uf || "",
        },
        peso: pedido.peso || 0,
        modo: "preview",
      };

      const resultado = await calcularPreco(pricingInput);
      if (resultado.sucesso && resultado.cliente) {
        precoFinal = resultado.cliente.total || 0;
      } else {
        await supabase.from("portal_pedidos").update({
          status: "erro_conversao",
          erro_processamento: "Falha ao calcular precificação: engine retornou sem sucesso",
          codigo_erro: "PRICING_FAILED",
          tentativas_processamento: (pedido.tentativas_processamento || 0) + 1,
          ultima_tentativa_em: new Date().toISOString(),
        }).eq("id", pedidoId);
        return { sucesso: false, erro: "Falha ao calcular precificação. Pedido mantido pendente." };
      }
    } catch (pricingErr) {
      await supabase.from("portal_pedidos").update({
        status: "erro_conversao",
        erro_processamento: `Erro na precificação: ${(pricingErr as Error).message}`,
        codigo_erro: "PRICING_ERROR",
        tentativas_processamento: (pedido.tentativas_processamento || 0) + 1,
        ultima_tentativa_em: new Date().toISOString(),
      }).eq("id", pedidoId);
      return { sucesso: false, erro: `Erro ao calcular preço: ${(pricingErr as Error).message}` };
    }

    // 3. Chamar RPC transacional de conversão
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc("converter_pedido_para_os", {
        p_pedido_id: pedidoId,
        p_operador_id: null,
      });

    if (rpcError || !rpcResult?.success) {
      const errorCode = rpcResult?.error_code || "RPC_FAILED";
      const erroMsg = rpcResult?.message || rpcError?.message || "Falha ao converter pedido";

      // D13: Se o RPC retornou ALREADY_CONVERTED, buscar OS existente
      if (errorCode === "ALREADY_CONVERTED" && rpcResult?.ordem_servico_id) {
        const { data: osExistente } = await supabase
          .from("ordens_servico")
          .select("id, numero")
          .eq("id", rpcResult.ordem_servico_id)
          .single();
        if (osExistente) {
          await supabase.from("portal_pedidos").update({
            status: "convertido",
            os_vinculada_id: osExistente.id,
          }).eq("id", pedidoId);
          return {
            sucesso: true,
            pedido_id: pedidoId,
            os_id: osExistente.id,
            os_numero: osExistente.numero,
            preco_final: precoFinal,
            tracking_link: "",
          };
        }
      }

      await supabase.from("portal_pedidos").update({
        status: "erro_conversao",
        erro_processamento: erroMsg,
        codigo_erro: errorCode,
        tentativas_processamento: (pedido.tentativas_processamento || 0) + 1,
        ultima_tentativa_em: new Date().toISOString(),
      }).eq("id", pedidoId);
      return { sucesso: false, erro: erroMsg };
    }

    // Validar retorno do RPC (D13)
    const osId = rpcResult.ordem_servico_id;
    if (!osId) {
      await supabase.from("portal_pedidos").update({
        status: "erro_conversao",
        erro_processamento: "RPC não retornou ID da OS",
        codigo_erro: "RPC_MISSING_OS_ID",
        tentativas_processamento: (pedido.tentativas_processamento || 0) + 1,
        ultima_tentativa_em: new Date().toISOString(),
      }).eq("id", pedidoId);
      return { sucesso: false, erro: "Falha ao criar OS: ID não retornado" };
    }

    // Verificar se o pedido já foi vinculado (idempotência client-side)
    if (pedido.os_vinculada_id && pedido.os_vinculada_id === osId) {
      return {
        sucesso: true,
        pedido_id: pedidoId,
        os_id: osId,
        os_numero: rpcResult.numero_os,
        preco_final: precoFinal,
        tracking_link: pedido.metadata?.tracking_link || "",
      };
    }

    // 4. Gerar link de rastreio público
    let trackingLink = "";
    let trackingStatus = "pendente";
    try {
      const linkResult = await gerarLinkRastreio(osId);
      if (linkResult) {
        trackingLink = linkResult.link;
        trackingStatus = "gerado";
      } else {
        trackingStatus = "falha";
        console.error("[confirmarPedidoPortal] gerarLinkRastreio retornou null para OS:", osId);
      }
    } catch (trackingErr) {
      trackingStatus = "erro";
      console.error("[confirmarPedidoPortal] Falha ao gerar tracking:", trackingErr);
    }

    // 5. Salvar dados complementares no pedido
    await supabase
      .from("portal_pedidos")
      .update({
        metadata: {
          ...((pedido.metadata as Record<string, any>) || {}),
          preco_final: precoFinal,
          tracking_link: trackingLink,
          tracking_status: trackingStatus,
          veiculo_sugerido: veiculoSugeridoFinal,
          logs: [
            ...((pedido.metadata?.logs as any[]) || []),
            {
              acao: "convertido",
              timestamp: new Date().toISOString(),
              os_id: osId,
              os_numero: rpcResult.numero_os,
              preco: precoFinal,
              tracking_status: trackingStatus,
            },
          ],
        },
      })
      .eq("id", pedidoId);

    return {
      sucesso: true,
      pedido_id: pedidoId,
      os_id: osId,
      os_numero: rpcResult.numero_os,
      tracking_link: trackingLink,
      preco_final: precoFinal,
      previsao_entrega: previsaoEntrega || pedido.prazo_estimado || "A definir",
      veiculo_sugerido: veiculoSugeridoFinal,
    };
  } catch (err: any) {
    console.error("[confirmarPedidoPortal] Erro geral:", err);
    const erroMsg = err.message || "Erro desconhecido";
    try {
      const { data: pedidoAtual } = await supabase
        .from("portal_pedidos")
        .select("tentativas_processamento")
        .eq("id", pedidoId)
        .single();
      const tentativas = (pedidoAtual?.tentativas_processamento || 0) + 1;
      await supabase.from("portal_pedidos").update({
        erro_processamento: erroMsg,
        codigo_erro: "UNKNOWN_ERROR",
        tentativas_processamento: tentativas,
        ultima_tentativa_em: new Date().toISOString(),
      }).eq("id", pedidoId);
    } catch (_) {}
    return { sucesso: false, erro: erroMsg };
  }
}

// =====================================================
// SUGESTÃO DE VEÍCULO
// =====================================================
export function sugerirVeiculo(peso: number, tipoCarga?: string): string {
  if (!peso || peso <= 0) return "Consulte";
  
  if (tipoCarga?.toLowerCase().includes('refrigerado') || tipoCarga?.toLowerCase().includes('frio')) {
    if (peso <= 500) return "Van Refrigerada";
    if (peso <= 1500) return "HR Refrigerada";
    return "Truck Refrigerado";
  }
  
  if (peso <= 20) return "Moto";
  if (peso <= 150) return "Moto + Baú";
  if (peso <= 400) return "Fiorino";
  if (peso <= 800) return "Van";
  if (peso <= 1500) return "HR";
  if (peso <= 3000) return "VUC";
  if (peso <= 6000) return "Truck 3/4";
  if (peso <= 10000) return "Truck";
  return "Carreta";
}

// =====================================================
// ESTIMATIVA DE PRAZO
// =====================================================
export function estimarPrazo(origem: string, destino: string, origemUf?: string, destinoUf?: string): string {
  if (!origem || !destino) return "A definir";
  
  const mismaRegiao = origem.toLowerCase() === destino.toLowerCase();
  
  if (mismaRegiao) {
    return "2-4 horas";
  }
  
  const mesmaUF = (origemUf && destinoUf) ? (origemUf.toLowerCase() === destinoUf.toLowerCase()) : false;
  if (mesmaUF) {
    return "Same-day ou 24h";
  }
  
  return "24-48 horas";
}

// =====================================================
// CRIAR PEDIDO
// =====================================================
export async function criarPedidoPortal(
  dados: PedidoFormData,
  clienteId?: string
): Promise<PedidoPortal | null> {
  try {
    // Gerar número do pedido via RPC (D22: sem fallback randômico)
    let numeroPedido = '';
    try {
      const { data: numeroData, error: numeroError } = await supabase.rpc('gerar_numero_pedido');
      if (numeroError || !numeroData) {
        console.error('[PedidosService] Erro RPC gerar_numero_pedido:', numeroError?.message);
        return null;
      }
      numeroPedido = numeroData;
    } catch (rpcErr) {
      console.error('[PedidosService] Exceção RPC gerar_numero_pedido:', rpcErr);
      return null;
    }
    
    // Calcular sugestões
    const veiculoSugerido = sugerirVeiculo(dados.peso || 0, dados.tipo_carga);
    const prazoEstimado = estimarPrazo(dados.coleta_cidade || "", dados.entrega_cidade || "");
    
    // Gerar payload n8n
    const payloadN8n = {
      setor: "portal_cliente",
      evento: "novo_pedido",
      pedido_id: null,
      cliente_id: clienteId,
      coleta: {
        cep: dados.coleta_cep,
        rua: dados.coleta_rua,
        numero: dados.coleta_numero,
        complemento: dados.coleta_complemento,
        bairro: dados.coleta_bairro,
        cidade: dados.coleta_cidade,
        uf: dados.coleta_uf,
        referencia: dados.coleta_referencia,
        data: dados.coleta_data,
      },
      entrega: {
        destinatario: dados.entrega_destinatario,
        telefone: dados.entrega_telefone,
        email: dados.entrega_email,
        notificar_whatsapp: dados.entrega_notificar_whatsapp,
        notificar_email: dados.entrega_notificar_email,
        cep: dados.entrega_cep,
        rua: dados.entrega_rua,
        numero: dados.entrega_numero,
        complemento: dados.entrega_complemento,
        bairro: dados.entrega_bairro,
        cidade: dados.entrega_cidade,
        uf: dados.entrega_uf,
        referencia: dados.entrega_referencia,
        data: dados.entrega_data,
      },
      mercadoria: {
        descricao: dados.descricao,
        volumes: dados.volumes,
        peso: dados.peso,
        dimensoes: {
          comprimento: dados.comprimento,
          largura: dados.largura,
          altura: dados.altura,
        },
        valor_declarado: dados.valor_declarado,
        tipo_carga: dados.tipo_carga,
        observacoes: dados.observacoes,
      },
      prioridade: dados.prioridade || "normal",
      veiculo_sugerido: veiculoSugerido,
      prazo_estimado: prazoEstimado,
      criado_em: new Date().toISOString(),
    };
    
    let responseData = null;
    let responseError = null;

    try {
      const response = await supabase
        .from('portal_pedidos')
        .insert([{
          cliente_id: clienteId,
          numero_pedido: numeroPedido,
          status: 'enviado',
          
          // Solicitante
          solicitante_nome: dados.solicitante_nome,
          solicitante_email: dados.solicitante_email,
          solicitante_telefone: dados.solicitante_telefone,
          
          // Unidade
          filial: dados.filial,
          centro_custo: dados.centro_custo,
          
          // Prioridade
          prioridade: dados.prioridade || 'normal',
          
          // Coleta
          coleta_cep: dados.coleta_cep,
          coleta_rua: dados.coleta_rua,
          coleta_numero: dados.coleta_numero,
          coleta_complemento: dados.coleta_complemento,
          coleta_bairro: dados.coleta_bairro,
          coleta_cidade: dados.coleta_cidade,
          coleta_uf: dados.coleta_uf,
          coleta_referencia: dados.coleta_referencia,
          coleta_data: dados.coleta_data,
          
          // Entrega
          entrega_destinatario: dados.entrega_destinatario,
          entrega_telefone: dados.entrega_telefone,
          entrega_email: dados.entrega_email,
          entrega_notificar_whatsapp: dados.entrega_notificar_whatsapp,
          entrega_notificar_email: dados.entrega_notificar_email,
          entrega_cep: dados.entrega_cep,
          entrega_rua: dados.entrega_rua,
          entrega_numero: dados.entrega_numero,
          entrega_complemento: dados.entrega_complemento,
          entrega_bairro: dados.entrega_bairro,
          entrega_cidade: dados.entrega_cidade,
          entrega_uf: dados.entrega_uf,
          entrega_referencia: dados.entrega_referencia,
          entrega_data: dados.entrega_data,
          
          // Mercadoria
          descricao: dados.descricao,
          volumes: dados.volumes || 1,
          peso: dados.peso || 0,
          comprimento: dados.comprimento,
          largura: dados.largura,
          altura: dados.altura,
          valor_declarado: dados.valor_declarado,
          tipo_carga: dados.tipo_carga,
          observacoes: dados.observacoes,
          
          // Inteligência
          veiculo_sugerido: veiculoSugerido,
          prazo_estimado: prazoEstimado,
          
          solicitacao_via: "portal_cliente",
          data_solicitada: new Date().toISOString(),
          payload_n8n: payloadN8n,
          metadata: dados.metadata || {},
          
          // Coleta Reversa
          reversa: dados.reversa || false,
          reversa_tipo: dados.reversa_tipo || null,
          reversa_qtd_volumes: dados.reversa_qtd_volumes || 0,
          reversa_unidade: dados.reversa_unidade || null,
          reversa_endereco: dados.reversa_endereco || null,
          reversa_devolucao: dados.reversa_devolucao || null,
          reversa_responsavel: dados.reversa_responsavel || null,
          reversa_telefone: dados.reversa_telefone || null,
          reversa_data: dados.reversa_data || null,
          reversa_instrucoes: dados.reversa_instrucoes || null,
          reversa_observacoes: dados.reversa_observacoes || null,
        }])
        .select()
        .single();
      responseData = response.data;
      responseError = response.error;
    } catch (insertErr) {
      console.error('[PedidosService] Falha de inserção no banco de dados:', insertErr);
      responseError = insertErr;
    }

    if (responseError || !responseData) {
      console.error('[PedidosService] Erro ao salvar pedido no Supabase:', responseError?.message || responseError);
      return null;
    }
    
    return responseData;
  } catch (error) {
    console.error('[PedidosService] Erro crítico ao criar pedido:', error);
    return null;
  }
}

// =====================================================
// BUSCAR PEDIDOS
// =====================================================
export async function buscarPedidosPortal(
  clienteId?: string,
  status?: string,
  limit: number = 50
): Promise<PedidoPortal[]> {
  if (!clienteId) return [];
  try {
    let query = supabase
      .from('portal_pedidos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('[PedidosService] Erro ao carregar pedidos do Supabase:', error.message);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('[PedidosService] Erro ao buscar pedidos:', error);
    return [];
  }
}

// =====================================================
// BUSCAR PEDIDO POR ID
// =====================================================
export async function buscarPedidoPorId(
  id: string,
  clienteId?: string
): Promise<PedidoPortal | null> {
  if (!clienteId) return null;
  try {
    const { data, error } = await supabase
      .from('portal_pedidos')
      .select('*')
      .eq('id', id)
      .eq('cliente_id', clienteId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[PedidosService] Erro ao buscar pedido:', error);
    return null;
  }
}

// =====================================================
// ATUALIZAR PEDIDO
// =====================================================
export async function atualizarPedidoPortal(
  id: string,
  dados: Partial<PedidoFormData>,
  clienteId?: string
): Promise<boolean> {
  if (!clienteId) return false;
  try {
    const { error } = await supabase
      .from('portal_pedidos')
      .update({
        ...dados,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('cliente_id', clienteId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[PedidosService] Erro ao atualizar pedido:', error);
    return false;
  }
}

// =====================================================
// CANCELAR PEDIDO
// =====================================================
export async function cancelarPedidoPortal(
  id: string,
  clienteId?: string
): Promise<boolean> {
  if (!clienteId) return false;
  try {
    const { error } = await supabase
      .from('portal_pedidos')
      .update({
        status: 'cancelado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('cliente_id', clienteId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[PedidosService] Erro ao cancelar pedido:', error);
    return false;
  }
}

// =====================================================
// VALIDAR CAMPOS OBRIGATÓRIOS
// =====================================================
export function validarPedido(dados: PedidoFormData): { valido: boolean; erros: string[] } {
  const erros: string[] = [];
  
  if (!dados.entrega_destinatario?.trim()) {
    erros.push('Nome do destinatário é obrigatório');
  }
  
  if (!dados.entrega_cidade?.trim()) {
    erros.push('Cidade de entrega é obrigatória');
  }
  
  if (!dados.descricao?.trim()) {
    erros.push('Descrição da mercadoria é obrigatória');
  }
  
  if (!dados.entrega_telefone?.trim() && !dados.entrega_email?.trim()) {
    erros.push('Telefone ou email do destinatário é obrigatório');
  }
  
  if (!dados.coleta_cidade?.trim()) {
    erros.push('Cidade de coleta é obrigatória');
  }
  
  if (dados.peso && dados.peso <= 0) {
    erros.push('Peso deve ser maior que zero');
  }
  
  return {
    valido: erros.length === 0,
    erros,
  };
}

// =====================================================
// CORES POR STATUS
// =====================================================
export const statusCores: Record<string, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  enviado: 'bg-blue-100 text-blue-600',
  em_analise: 'bg-amber-100 text-amber-600',
  programado: 'bg-purple-100 text-purple-600',
  coleta: 'bg-orange-100 text-orange-600',
  em_rota: 'bg-orange-100 text-orange-600',
  entregue: 'bg-emerald-100 text-emerald-600',
  cancelado: 'bg-red-100 text-red-600',
};

// =====================================================
// CORES POR PRIORIDADE
// =====================================================
export const prioridadeCores: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-100 text-blue-600',
  alta: 'bg-orange-100 text-orange-600',
  urgente: 'bg-red-100 text-red-600',
};

// =====================================================
// INTERFACES DE INTELIGÊNCIA
// =====================================================
export interface RotaInfo {
  tempoTexto: string;
  distanciaKm: number;
  distanciaTexto: string;
  minutos: number;
}

export interface ResumoInteligente {
  paradas: number;
  peso: number;
  cubagemM3: number;
  km: number;
  tempoEstimado: string;
  veiculoSugerido: string;
  sla: string;
  complexidade: "Baixa" | "Média" | "Elevada";
  refrigerado: boolean;
}

// =====================================================
// CALCULAR CUBAGEM
// =====================================================
export function calcularCubagem(comprimento?: number | string, largura?: number | string, altura?: number | string): number {
  const c = Number(comprimento) || 0;
  const l = Number(largura) || 0;
  const a = Number(altura) || 0;
  if (!c || !l || !a) return 0;
  return Math.round((c * l * a) / 1000000 * 100) / 100;
}

// =====================================================
// CALCULAR TEMPO E DISTÂNCIA DE ROTA
// =====================================================
export function calcularTempoRota(
  coletaCidade: string,
  coletaUf: string,
  destinos: { cidade?: string; uf?: string }[]
): RotaInfo {
  if (!coletaCidade || destinos.length === 0) {
    return { tempoTexto: "—", distanciaKm: 0, distanciaTexto: "—", minutos: 0 };
  }

  const numParadas = destinos.length;
  const todasCidades = [coletaCidade.toUpperCase().trim(), ...destinos.map(d => (d.cidade || "").toUpperCase().trim())];
  const todasUfs = [coletaUf.toUpperCase().trim(), ...destinos.map(d => (d.uf || "").toUpperCase().trim())];

  const mesmaCidade = todasCidades.every(c => c === todasCidades[0]);
  const mesmaUf = todasUfs.every(u => u === todasUfs[0]) && !mesmaCidade;
  const ufValidas = todasUfs.filter(u => u.length === 2);
  const diferentesUfs = ufValidas.length > 1 && new Set(ufValidas).size > 1;

  let distanciaPorParada: number;
  let tempoPorParadaMin: number;
  let tempoParadaMin: number;

  if (mesmaCidade) {
    distanciaPorParada = 8;
    tempoPorParadaMin = 20;
    tempoParadaMin = 25;
  } else if (mesmaUf) {
    distanciaPorParada = 45;
    tempoPorParadaMin = 40;
    tempoParadaMin = 30;
  } else if (diferentesUfs) {
    distanciaPorParada = 180;
    tempoPorParadaMin = 120;
    tempoParadaMin = 35;
  } else {
    distanciaPorParada = 60;
    tempoPorParadaMin = 55;
    tempoParadaMin = 25;
  }

  const distanciaKm = Math.round(distanciaPorParada * numParadas);
  const minutos = Math.round(tempoPorParadaMin * numParadas + tempoParadaMin * (numParadas - 1));

  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  const tempoTexto = horas > 0 ? `${horas}h${mins > 0 ? `${mins}min` : ""}` : `${mins}min`;

  const distanciaTexto = distanciaKm >= 1 ? `${distanciaKm} km` : `${Math.round(distanciaPorParada * numParadas * 1000)} m`;

  return { tempoTexto, distanciaKm, distanciaTexto, minutos };
}

// =====================================================
// SUGERIR VEÍCULO AVANÇADO
// =====================================================
export interface SugerirVeiculoParams {
  peso: number;
  cubagemM3: number;
  refrigerado: boolean;
  fragilidade: string;
  necessidades: string[];
  destinosCount: number;
}

export function sugerirVeiculoAvancado(params: SugerirVeiculoParams): string {
  const { peso, cubagemM3, refrigerado, fragilidade, necessidades, destinosCount } = params;

  if (!peso || peso <= 0) return "Consulte";

  const precisaPlataforma = necessidades.includes("plataforma") || necessidades.includes("veiculo_alto");
  const altoValor = cubagemM3 > 15 || destinosCount > 5;

  if (refrigerado) {
    if (peso <= 500 && cubagemM3 <= 6) return "Van Refrigerada";
    if (peso <= 1500 && cubagemM3 <= 15) return "HR Refrigerada";
    return "Truck Refrigerado";
  }

  if (fragilidade === "muito_fragil") {
    if (peso <= 800) return "Van (carga fragil)";
    if (peso <= 3000) return "VUC (carga fragil)";
    return "Truck (carga fragil)";
  }

  if (precisaPlataforma) {
    if (peso <= 1500) return "HR c/ Plataforma";
    if (peso <= 6000) return "Truck 3/4 c/ Plataforma";
    return "Truck c/ Plataforma";
  }

  if (peso <= 20 && cubagemM3 <= 0.3 && !altoValor) return "Moto";
  if (peso <= 150 && cubagemM3 <= 1.5) return "Moto + Baú";
  if (peso <= 400 && cubagemM3 <= 4) return "Fiorino";
  if (peso <= 800 && cubagemM3 <= 8) return "Van";
  if (peso <= 1500 && cubagemM3 <= 15) return "HR";
  if (peso <= 3000 && cubagemM3 <= 20) return "VUC";
  if (peso <= 6000 && cubagemM3 <= 30) return "Truck 3/4";
  if (peso <= 10000 && cubagemM3 <= 45) return "Truck";
  return "Carreta";
}

// =====================================================
// SUGESTÃO INTELIGENTE CONSULTIVA
// =====================================================
export interface SugestaoInteligente {
  mensagem: string;
  tipo: "info" | "warning" | "tip";
  icone: string;
}

export function gerarSugestaoInteligente(
  distanciaKm: number,
  numParadas: number,
  horarioLimite: string,
  necessidades: string[],
  peso: number
): SugestaoInteligente | null {
  const sugestoes: SugestaoInteligente[] = [];

  if (distanciaKm > 100) {
    sugestoes.push({
      tipo: "warning",
      icone: "route",
      mensagem: "Recomendamos agendamento prévio desta entrega para melhor performance operacional."
    });
  }

  if (numParadas >= 3) {
    sugestoes.push({
      tipo: "info",
      icone: "stops",
      mensagem: "Esta operação possui melhor eficiência quando previamente agendada."
    });
  }

  if (necessidades.includes("area_risco")) {
    sugestoes.push({
      tipo: "warning",
      icone: "alert",
      mensagem: "Área de risco identificada. Recomendamos agendamento diurno e rastreamento adicional."
    });
  }

  if (necessidades.includes("refrigerado") && peso > 500) {
    sugestoes.push({
      tipo: "tip",
      icone: "temp",
      mensagem: "Carga refrigerada de grande volume. Recomendamos conferência do sistema de frio antes do embarque."
    });
  }

  if (necessidades.includes("fragil") || necessidades.includes("nao_empilhar")) {
    sugestoes.push({
      tipo: "info",
      icone: "fragile",
      mensagem: "Carga sensível identificada. Sugerimos conferência de amarração e proteção adicional."
    });
  }

  return sugestoes.length > 0 ? sugestoes[0] : null;
}

// =====================================================
// RESUMO INTELIGENTE
// =====================================================
export function gerarResumoInteligente(
  peso: string | number,
  comprimento: string | number,
  largura: string | number,
  altura: string | number,
  necessidades: string[],
  destinos: { cidade?: string; uf?: string }[],
  coletaCidade: string,
  coletaUf: string,
  fragilidade: string
): ResumoInteligente {
  const pesoNum = Number(peso) || 0;
  const cubagem = calcularCubagem(comprimento, largura, altura);
  const rota = calcularTempoRota(coletaCidade, coletaUf, destinos);
  const refrigerado = necessidades.includes("refrigerado");
  const veiculo = sugerirVeiculoAvancado({
    peso: pesoNum,
    cubagemM3: cubagem,
    refrigerado,
    fragilidade,
    necessidades,
    destinosCount: destinos.length
  });

  const sla = rota.minutos > 0
    ? `${Math.ceil(rota.minutos / 60)}h`
    : "A definir";

  let complexidade: "Baixa" | "Média" | "Elevada" = "Baixa";
  const fatores = (necessidades.length > 0 ? 1 : 0) + (destinos.length >= 3 ? 1 : 0) + (refrigerado ? 1 : 0) + (rota.distanciaKm > 100 ? 1 : 0);
  if (fatores >= 3) complexidade = "Elevada";
  else if (fatores >= 1) complexidade = "Média";

  return {
    paradas: 1 + destinos.length,
    peso: pesoNum,
    cubagemM3: cubagem,
    km: rota.distanciaKm,
    tempoEstimado: rota.tempoTexto,
    veiculoSugerido: veiculo,
    sla,
    complexidade,
    refrigerado,
  };
}