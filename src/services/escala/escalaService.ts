/**
 * Service de Escala Operacional
 * Gerencia alocações de prestadores/motoristas no Supabase
 * 
 * IMPORTANTE: Este service NÃO usa localStorage, apenas Supabase
 * 
 * REGRA: listarAlocacoes com JOINs é usado APENAS no TMS (admin).
 * O AppPrestador usa listarAlocacoesAppPrestador (sem JOIN) para evitar
 * bloqueio RLS em tabelas relacionadas (ordens_servico, prestadores, clientes).
 */

import { supabase } from '@/lib/supabase';
import { mapearStatusEscalaParaAppPrestador } from './escalaAppPrestadorAdapter';
// M104: Eventos publicados automaticamente por SQL triggers no banco
// import { publicarEvento } from '@/services/eventBus/eventBusService';
import type {
  AlocacaoEscala,
  NovaAlocacaoEscala,
  AtualizarAlocacaoEscala,
  FiltrosEscala,
  ResultadoListagemEscala,
  HistoricoAlocacaoEscala,
  NovoHistoricoAlocacao,
  DadosFinalizacaoEscala,
  EscalaStatus,
} from '@/types/escala';

/**
 * Interface de retorno padronizado
 */
interface ResultadoOperacao<T = any> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
  mensagem?: string;
}

// ============================================================================
// FUNÇÕES DE LISTAGEM E BUSCA
// ============================================================================

/**
 * Lista alocações com filtros opcionais e paginação
 */
export async function listarAlocacoes(
  filtros: FiltrosEscala = {}
): Promise<ResultadoOperacao<ResultadoListagemEscala>> {
  try {
    // SELECT com JOINs para trazer nomes de prestadores, clientes e OS
    let query = supabase.from('alocacoes_escala').select(`
      *,
      prestadores:prestador_id(id, nome_completo, tipo_parceiro),
      clientes:cliente_id(id, nome_fantasia, razao_social),
      ordens_servico:ordem_servico_id(id, numero)
    `, { count: 'exact' });

    // Aplicar filtros de data
    if (filtros.data_inicio) {
      query = query.gte('data_escala', filtros.data_inicio);
    }
    if (filtros.data_fim) {
      query = query.lte('data_escala', filtros.data_fim);
    }
    if (filtros.data_escala) {
      query = query.eq('data_escala', filtros.data_escala);
    }

    // Aplicar filtros de relacionamento
    if (filtros.cliente_id) {
      query = query.eq('cliente_id', filtros.cliente_id);
    }
    if (filtros.prestador_id) {
      query = query.eq('prestador_id', filtros.prestador_id);
    }
    if (filtros.ordem_servico_id) {
      query = query.eq('ordem_servico_id', filtros.ordem_servico_id);
    }
    if (filtros.empresa_id) {
      query = query.eq('empresa_id', filtros.empresa_id);
    }

    // Aplicar filtros de status
    if (filtros.status) {
      if (Array.isArray(filtros.status)) {
        query = query.in('status', filtros.status);
      } else {
        query = query.eq('status', filtros.status);
      }
    }
    if (filtros.status_pagamento) {
      if (Array.isArray(filtros.status_pagamento)) {
        query = query.in('status_pagamento', filtros.status_pagamento);
      } else {
        query = query.eq('status_pagamento', filtros.status_pagamento);
      }
    }

    // Aplicar filtros operacionais
    if (filtros.tipo_veiculo) {
      query = query.eq('tipo_veiculo', filtros.tipo_veiculo);
    }
    if (filtros.regiao) {
      query = query.eq('regiao', filtros.regiao);
    }
    if (filtros.turno) {
      query = query.eq('turno', filtros.turno);
    }
    if (filtros.placa) {
      query = query.eq('placa', filtros.placa);
    }

    // Filtros de aceite e finalização
    if (filtros.aceite_prestador !== undefined) {
      query = query.eq('aceite_prestador', filtros.aceite_prestador);
    }
    if (filtros.finalizada !== undefined) {
      query = query.eq('finalizada', filtros.finalizada);
    }

    // Busca textual (usar ilike para busca case-insensitive)
    if (filtros.busca) {
      query = query.or(
        `observacoes.ilike.%${filtros.busca}%,rota.ilike.%${filtros.busca}%,origem.ilike.%${filtros.busca}%,destino.ilike.%${filtros.busca}%`
      );
    }

    // Tags (busca em array)
    if (filtros.tags && filtros.tags.length > 0) {
      query = query.contains('tags', filtros.tags);
    }

    // Ordenação
    const ordenarPor = filtros.ordenar_por || 'data_escala';
    const ordem = filtros.ordem || 'desc';
    query = query.order(ordenarPor, { ascending: ordem === 'asc' });

    // Paginação
    const limite = filtros.limite || 50;
    const pagina = filtros.pagina || 1;
    const offset = filtros.offset !== undefined ? filtros.offset : (pagina - 1) * limite;
    
    query = query.range(offset, offset + limite - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[EscalaService] Erro ao listar alocações:', error);
      return {
        sucesso: false,
        erro: error.message,
        mensagem: 'Erro ao buscar alocações',
      };
    }

    const total_paginas = count ? Math.ceil(count / limite) : 0;

    return {
      sucesso: true,
      dados: {
        alocacoes: data || [],
        total: count || 0,
        pagina,
        limite,
        total_paginas,
      },
    };
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao listar alocações:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
      mensagem: 'Falha ao buscar alocações',
    };
  }
}

/**
 * Lista alocações do prestador sem JOINs (AppPrestador)
 * Consulta apenas alocacoes_escala.* para evitar bloqueio RLS
 * em tabelas relacionadas. Ideal para uso no App do motorista.
 */
export async function listarAlocacoesAppPrestador(
  prestadorId: string,
  filtros?: { limite?: number; status?: EscalaStatus[] }
): Promise<ResultadoOperacao<ResultadoListagemEscala>> {
  try {
    let query = supabase
      .from('alocacoes_escala')
      .select('*', { count: 'exact' })
      .eq('prestador_id', prestadorId)
      .order('data_escala', { ascending: false });

    const statusFilter = filtros?.status || ['planejada', 'aguardando_aceite', 'aceita', 'recusada', 'em_rota', 'concluida', 'ocorrencia'];
    query = query.in('status', statusFilter);

    const limite = filtros?.limite || 500;
    query = query.range(0, limite - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[EscalaService] AppPrestador - Erro ao listar alocações:', error);
      return { sucesso: false, erro: error.message, mensagem: 'Erro ao buscar alocações do prestador' };
    }

    const alocacoes = (data || []).map(item => ({
      ...item,
      status_original: item.status,
      status: mapearStatusEscalaParaAppPrestador(item.status),
    }));

    return {
      sucesso: true,
      dados: {
        alocacoes,
        total: count || 0,
        pagina: 1,
        limite,
        total_paginas: 1,
      },
    };
  } catch (err: any) {
    console.error('[EscalaService] AppPrestador - Exceção:', err);
    return { sucesso: false, erro: err.message || 'Erro desconhecido', mensagem: 'Falha ao buscar alocações' };
  }
}

/**
 * Busca uma alocação específica por ID
 */
export async function buscarAlocacaoPorId(
  id: string
): Promise<ResultadoOperacao<AlocacaoEscala>> {
  try {
    const { data, error } = await supabase
      .from('alocacoes_escala')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[EscalaService] Erro ao buscar alocação:', error);
      return {
        sucesso: false,
        erro: error.message,
        mensagem: 'Alocação não encontrada',
      };
    }

    return {
      sucesso: true,
      dados: data,
      mensagem: 'Alocação encontrada',
    };
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao buscar alocação:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
    };
  }
}

// ============================================================================
// FUNÇÕES DE CRIAÇÃO E ATUALIZAÇÃO
// ============================================================================

// MISSAO 03: Maquina de estados — transicoes validas de status
const TRANSICOES_VALIDAS: Record<string, string[]> = {
  planejada: ['aguardando_aceite', 'cancelada'],
  aguardando_aceite: ['aceita', 'recusada', 'cancelada'],
  aceita: ['em_rota', 'cancelada'],
  em_rota: ['concluida', 'ocorrencia', 'cancelada'],
  ocorrencia: ['em_rota', 'concluida', 'cancelada'],
  recusada: ['planejada', 'cancelada'],
  concluida: [],
  cancelada: [],
};

async function validarTransicaoStatus(alocacaoId: string, novoStatus: string): Promise<{ valido: boolean; erro?: string; atual?: string }> {
  if (!novoStatus) return { valido: true }; // sem mudanca de status, OK
  const { data } = await supabase.from("alocacoes_escala").select("status").eq("id", alocacaoId).single();
  if (!data) return { valido: true }; // alocacao nova, OK
  const atual = data.status;
  const permitidos = TRANSICOES_VALIDAS[atual];
  if (!permitidos) return { valido: false, erro: `Status atual "${atual}" desconhecido`, atual };
  if (!permitidos.includes(novoStatus)) {
    return { valido: false, erro: `Transicao invalida: "${atual}" → "${novoStatus}". Permitido: ${permitidos.join(', ')}`, atual };
  }
  return { valido: true, atual };
}

/**
 * Cria uma nova alocação
 */
export async function criarAlocacao(
  dados: NovaAlocacaoEscala
): Promise<ResultadoOperacao<AlocacaoEscala>> {
  try {
    // Validações básicas
    if (!dados.data_escala) {
      return {
        sucesso: false,
        erro: 'Data da Programação Operacional é obrigatória',
      };
    }
    if (!dados.tipo_veiculo) {
      return {
        sucesso: false,
        erro: 'Tipo de veículo é obrigatório',
      };
    }

    // Verificar conflito de prestador antes de criar
    if (dados.prestador_id) {
      const conflito = await verificarConflitoPrestador(
        dados.prestador_id,
        dados.data_escala
      );
      if (conflito.sucesso && conflito.dados) {
        return {
          sucesso: false,
          erro: 'Conflito: Prestador já possui alocação ativa nesta data.',
          mensagem: 'Não foi possível criar alocação devido a conflito de agenda.',
        };
      }
    }

    // Verificar conflito de veículo (placa)
    if (dados.placa && dados.placa.trim()) {
      const conflitoPlaca = await verificarConflitoPlaca(
        dados.placa,
        dados.data_escala
      );
      if (conflitoPlaca.sucesso && conflitoPlaca.dados) {
        return {
          sucesso: false,
          erro: `Conflito: Veículo placa ${dados.placa} já está alocado nesta data.`,
          mensagem: 'Não foi possível criar alocação devido a conflito de veículo.',
        };
      }
    }

    // AG-07F — GATE ÚNICO DE ELEGIBILIDADE OPERACIONAL
    // Não depende do Select da interface: mesmo uma chamada direta ao backend
    // não cria alocação operacional para prestador inelegível.
    if (dados.prestador_id) {
      const { verificarElegibilidadeOperacionalPrestador, verificarElegibilidadeVeiculo, verificarCompatibilidadeTipoVeiculo, verificarCapacidadeVeiculo, verificarRefrigerado, verificarAjudante } = await import(
        "@/services/escala/eligibilidadeOperacionalService"
      );
      const gatePrestador = await verificarElegibilidadeOperacionalPrestador(dados.prestador_id);
      if (!gatePrestador.elegivel) {
        return {
          sucesso: false,
          erro: `Prestador não está elegível para operação: ${gatePrestador.detalhe || gatePrestador.motivo}`,
          mensagem: 'Não foi possível criar alocação: prestador não autorizado.',
        };
      }
      if (dados.placa && dados.placa.trim()) {
        const gateVeiculo = await verificarElegibilidadeVeiculo(dados.placa);
        if (!gateVeiculo.elegivel) {
          return { sucesso: false, erro: gateVeiculo.detalhe || 'Veículo não elegível para operação.' };
        }
      }
      // AG-07I-B1 — compatibilidade de tipo de veículo OS × veículo
      const gateTipo = await verificarCompatibilidadeTipoVeiculo(dados.ordem_servico_id, dados.tipo_veiculo);
      if (!gateTipo.elegivel) {
        return { sucesso: false, erro: `Veículo incompatível com o tipo exigido pela operação: ${gateTipo.detalhe || gateTipo.motivo}` };
      }
      // AG-07I-B2 — capacidade kg/m³ do veículo × peso/cubagem da OS
      if (dados.ordem_servico_id && dados.placa) {
        const gateCap = await verificarCapacidadeVeiculo(dados.ordem_servico_id, dados.placa);
        if (!gateCap.elegivel) {
          return { sucesso: false, erro: `Capacidade do veículo insuficiente para esta operação: ${gateCap.detalhe || gateCap.motivo}` };
        }
      }
      // AG-07I-B3 — refrigerado/térmico: OS exige × veículo possui
      if (dados.ordem_servico_id && dados.placa) {
        const gateRefri = await verificarRefrigerado(dados.ordem_servico_id, dados.placa);
        if (!gateRefri.elegivel) {
          return { sucesso: false, erro: `Compatibilidade térmica: ${gateRefri.detalhe || gateRefri.motivo}` };
        }
      }
      // AG-07I-B5 — ajudante obrigatório: OS exige + alocação tem 0 → bloqueado
      if (dados.ordem_servico_id) {
        const gateAj = await verificarAjudante(dados.ordem_servico_id, dados.ajudantes);
        if (!gateAj.elegivel) {
          return { sucesso: false, erro: gateAj.detalhe || gateAj.motivo };
        }
      }
    }

    // Auto-associate or create Ordem de Serviço (OS) if not provided
    if (!dados.ordem_servico_id) {
      // Try to find an existing OS with same client, provider, date, and vehicle type
      const existingOs = await supabase
        .from('ordens_servico')
        .select('id')
        .eq('cliente_id', dados.cliente_id)
        .eq('prestador_id', dados.prestador_id)
        .eq('data', dados.data_escala)
        .eq('tipo_veiculo', dados.tipo_veiculo)
        .maybeSingle();

      if (existingOs.error) {
        console.error('[EscalaService] Erro ao buscar OS existente:', existingOs.error);
        return { sucesso: false, erro: existingOs.error.message };
      }

      if (existingOs.data) {
        dados.ordem_servico_id = existingOs.data.id;
      } else {
        // Create a new OS using the official service
        const { criarOrdemServico } = await import('@/services/ordemServicoService');
        const novoOS = await criarOrdemServico({
          cliente_id: dados.cliente_id,
          cliente: dados.cliente_id,
          origem: dados.origem || '',
          destino: dados.destino || '',
          data_coleta: dados.data_escala,
          metadata: {},
        } as any);
        if (!novoOS.sucesso || !novoOS.os_id) {
          return { sucesso: false, erro: novoOS.erro || 'Falha ao criar Ordem de Serviço' };
        }
        dados.ordem_servico_id = novoOS.os_id;
      }
    }

    const { data, error } = await supabase
      .from('alocacoes_escala')
      .insert([dados])
      .select()
      .single();

    if (error) {
      console.error('[EscalaService] Erro ao criar alocação:', error);
      return {
        sucesso: false,
        erro: error.message,
        mensagem: 'Erro ao criar alocação',
      };
    }

    return {
      sucesso: true,
      dados: data,
      mensagem: 'Alocação criada com sucesso',
    };
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao criar alocação:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
      mensagem: 'Falha ao criar alocação',
    };
  }
}

/**
 * Atualiza uma alocação existente
 */
export async function atualizarAlocacao(
  id: string,
  dados: AtualizarAlocacaoEscala
): Promise<ResultadoOperacao<AlocacaoEscala>> {
  try {
    // MISSAO 03: Validar transicao de status
    if (dados.status) {
      const validacao = await validarTransicaoStatus(id, dados.status);
      if (!validacao.valido) {
        return { sucesso: false, erro: validacao.erro, mensagem: validacao.erro || 'Transicao invalida' };
      }
    }

    const { data, error } = await supabase
      .from('alocacoes_escala')
      .update(dados)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[EscalaService] Erro ao atualizar alocação:', error);
      return {
        sucesso: false,
        erro: error.message,
        mensagem: 'Erro ao atualizar alocação',
      };
    }

    return {
      sucesso: true,
      dados: data,
      mensagem: 'Alocação atualizada com sucesso',
    };
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao atualizar alocação:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
      mensagem: 'Falha ao atualizar alocação',
    };
  }
}

// ============================================================================
// FUNÇÕES DE AÇÕES ESPECÍFICAS
// ============================================================================

/**
 * Cancela uma alocação
 */
export async function cancelarAlocacao(
  id: string,
  motivo?: string,
  usuario_id?: string
): Promise<ResultadoOperacao<AlocacaoEscala>> {
  try {
    const atualizacao: AtualizarAlocacaoEscala = {
      status: 'cancelada',
      status_pagamento: 'cancelado',
      finalizada: true,
      data_finalizacao: new Date().toISOString(),
      observacoes_internas: motivo,
      updated_by: usuario_id,
    };

    const resultado = await atualizarAlocacao(id, atualizacao);

    if (resultado.sucesso && motivo) {
      // Registrar no histórico
      await registrarHistorico(id, {
        alocacao_id: id,
        evento: 'cancelamento',
        descricao: motivo,
        status_novo: 'cancelada',
        created_by: usuario_id,
      });
    }

    // M80: Financeiro cancelado pelo trigger trg_cancelar_financeiro_escala
    // (UPDATE de alocacoes_escala.status → 'cancelada' dispara o trigger automaticamente)
    return resultado;
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao cancelar alocação:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
      mensagem: 'Falha ao cancelar alocação',
    };
  }
}

/**
 * Prestador aceita a alocação
 */
export async function aceitarAlocacao(
  id: string,
  prestador_id: string
): Promise<ResultadoOperacao<AlocacaoEscala>> {
  try {
    const atualizacao: AtualizarAlocacaoEscala = {
      status: 'aceita',
      aceite_prestador: true,
      data_aceite: new Date().toISOString(),
      updated_by: prestador_id,
    };

    const resultado = await atualizarAlocacao(id, atualizacao);

    // M104: Evento escala.alocacao.aceita publicado pelo trigger SQL trg_evento_prestador_aceitou

    return resultado;
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao aceitar alocação:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
      mensagem: 'Falha ao aceitar alocação',
    };
  }
}

/**
 * Prestador recusa a alocação
 */
export async function recusarAlocacao(
  id: string,
  prestador_id: string,
  motivo: string
): Promise<ResultadoOperacao<AlocacaoEscala>> {
  try {
    const atualizacao: AtualizarAlocacaoEscala = {
      status: 'recusada',
      aceite_prestador: false,
      motivo_recusa: motivo,
      updated_by: prestador_id,
    };

    const resultado = await atualizarAlocacao(id, atualizacao);

    if (resultado.sucesso) {
      // Registrar no histórico
      await registrarHistorico(id, {
        alocacao_id: id,
        evento: 'recusa_prestador',
        descricao: motivo,
        status_novo: 'recusada',
        created_by: prestador_id,
        payload: { motivo },
      });
    }

    return resultado;
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao recusar alocação:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
      mensagem: 'Falha ao recusar alocação',
    };
  }
}

/**
 * Prestador inicia a rota/viagem
 */
export async function iniciarRota(
  id: string,
  prestador_id?: string,
  kmInicial?: number
): Promise<ResultadoOperacao<AlocacaoEscala>> {
  try {
    const atualizacao: AtualizarAlocacaoEscala = {
      status: 'em_rota',
      horario_inicio_real: new Date().toISOString(),
      metadata: kmInicial !== undefined ? { km_inicial: kmInicial } : undefined,
      updated_by: prestador_id,
    };

    return await atualizarAlocacao(id, atualizacao);
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao iniciar rota:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
      mensagem: 'Falha ao iniciar rota',
    };
  }
}

/**
 * Finaliza uma alocação com dados de conclusão
 */
export async function finalizarAlocacao(
  id: string,
  dadosFinalizacao: DadosFinalizacaoEscala,
  usuario_id?: string
): Promise<ResultadoOperacao<AlocacaoEscala>> {
  try {
    const atualizacao: AtualizarAlocacaoEscala = {
      status: 'concluida',
      finalizada: true,
      data_finalizacao: new Date().toISOString(),
      horario_fim_real: dadosFinalizacao.horario_fim_real || new Date().toISOString(),
      km_realizados: dadosFinalizacao.km_realizados,
      tempo_total_minutos: dadosFinalizacao.tempo_total_minutos,
      comprovante_url: dadosFinalizacao.comprovante_url,
      assinatura_url: dadosFinalizacao.assinatura_url,
      fotos_entrega: dadosFinalizacao.fotos_entrega,
      observacoes: dadosFinalizacao.observacoes,
      ocorrencias_descricao: dadosFinalizacao.ocorrencias_descricao,
      metadata: dadosFinalizacao.metadata,
      updated_by: usuario_id,
    };

    return await atualizarAlocacao(id, atualizacao);
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao finalizar alocação:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
      mensagem: 'Falha ao finalizar alocação',
    };
  }
}

// ============================================================================
// MISSAO 03: FUNCOES DE TROCA (SWAP)
// ============================================================================

export async function trocarMotorista(alocacaoId: string, novoPrestadorId: string, usuarioId?: string, motivo?: string): Promise<ResultadoOperacao<AlocacaoEscala>> {
  try {
    const { data: atual } = await supabase.from("alocacoes_escala").select("prestador_id, prestador_nome, data_escala, status, ordem_servico_id").eq("id", alocacaoId).single();
    if (!atual) return { sucesso: false, erro: "Alocacao nao encontrada" };
    if (atual.status === 'concluida' || atual.status === 'cancelada') return { sucesso: false, erro: `Alocacao ${atual.status} nao permite troca` };
    const { data: novo } = await supabase.from("prestadores").select("nome_completo, status, liberado_app").eq("id", novoPrestadorId).single();
    if (!novo) return { sucesso: false, erro: "Prestador nao encontrado" };
    // AG-07F — GATE único de elegibilidade na troca de motorista
    const { prestadorOperacionalmenteElegivelDados, verificarCompatibilidadeTipoVeiculo, verificarCapacidadeVeiculo, verificarRefrigerado } = await import("@/services/escala/eligibilidadeOperacionalService");
    const gate = prestadorOperacionalmenteElegivelDados(novo);
    if (!gate.elegivel) return { sucesso: false, erro: `Prestador não está elegível para operação: ${gate.detalhe || gate.motivo}` };
    // AG-07I-B1 — compatibilidade de tipo: busca veículo do novo prestador e compara com OS
    if (atual.ordem_servico_id) {
      const { data: novoVeiculo } = await supabase.from("veiculos").select("tipo, placa, capacidade_kg, capacidade_m3, tipo_carga").eq("prestador_vinculado", novoPrestadorId).maybeSingle();
      const gateTipo = await verificarCompatibilidadeTipoVeiculo(atual.ordem_servico_id, novoVeiculo?.tipo);
      if (!gateTipo.elegivel) return { sucesso: false, erro: `Veículo do novo motorista incompatível: ${gateTipo.detalhe || gateTipo.motivo}` };
      // AG-07I-B2 — capacidade kg/m³
      if (novoVeiculo?.placa) {
        const gateCap = await verificarCapacidadeVeiculo(atual.ordem_servico_id, novoVeiculo.placa);
        if (!gateCap.elegivel) return { sucesso: false, erro: `Capacidade do veículo do novo motorista insuficiente: ${gateCap.detalhe || gateCap.motivo}` };
      }
      // AG-07I-B3 — refrigerado/térmico
      if (novoVeiculo?.placa) {
        const gateRefri = await verificarRefrigerado(atual.ordem_servico_id, novoVeiculo.placa);
        if (!gateRefri.elegivel) return { sucesso: false, erro: `Refrigerado/térmico incompatível: ${gateRefri.detalhe || gateRefri.motivo}` };
      }
    }
    const conflito = await verificarConflitoPrestador(novoPrestadorId, atual.data_escala, alocacaoId);
    if (conflito.sucesso && conflito.dados) return { sucesso: false, erro: "Prestador ja possui alocacao nesta data" };
    await registrarHistorico(alocacaoId, { alocacao_id: alocacaoId, evento: 'troca_motorista', descricao: `Motorista: ${atual.prestador_nome || atual.prestador_id} → ${novo.nome_completo || novoPrestadorId}. ${motivo || ''}`, created_by: usuarioId });
    return await atualizarAlocacao(alocacaoId, { prestador_id: novoPrestadorId, prestador_nome: novo.nome_completo, updated_by: usuarioId });
  } catch (err: any) { return { sucesso: false, erro: err.message }; }
}

export async function trocarVeiculo(alocacaoId: string, novaPlaca: string, usuarioId?: string, motivo?: string): Promise<ResultadoOperacao<AlocacaoEscala>> {
  try {
    const { data: atual } = await supabase.from("alocacoes_escala").select("placa, data_escala, status, ordem_servico_id").eq("id", alocacaoId).single();
    if (!atual) return { sucesso: false, erro: "Alocacao nao encontrada" };
    if (atual.status === 'concluida' || atual.status === 'cancelada') return { sucesso: false, erro: `Alocacao ${atual.status} nao permite troca` };
    const { data: veiculo } = await supabase.from("veiculos").select("status, tipo, capacidade_kg, capacidade_m3, tipo_carga").eq("placa", novaPlaca).maybeSingle();
    if (veiculo && (veiculo.status === 'manutencao' || veiculo.status === 'inativo')) return { sucesso: false, erro: `Veiculo ${novaPlaca} esta ${veiculo.status}` };
    // AG-07I-B1 — compatibilidade de tipo: compara tipo do novo veículo com OS
    if (atual.ordem_servico_id && veiculo?.tipo) {
      const { verificarCompatibilidadeTipoVeiculo, verificarCapacidadeVeiculo, verificarRefrigerado } = await import("@/services/escala/eligibilidadeOperacionalService");
      const gateTipo = await verificarCompatibilidadeTipoVeiculo(atual.ordem_servico_id, veiculo.tipo);
      if (!gateTipo.elegivel) return { sucesso: false, erro: `Veículo incompatível com o tipo exigido pela operação: ${gateTipo.detalhe || gateTipo.motivo}` };
      // AG-07I-B2 — capacidade kg/m³
      const gateCap = await verificarCapacidadeVeiculo(atual.ordem_servico_id, novaPlaca);
      if (!gateCap.elegivel) return { sucesso: false, erro: `Capacidade do novo veículo insuficiente: ${gateCap.detalhe || gateCap.motivo}` };
      // AG-07I-B3 — refrigerado/térmico
      const gateRefri = await verificarRefrigerado(atual.ordem_servico_id, novaPlaca);
      if (!gateRefri.elegivel) return { sucesso: false, erro: `Refrigerado/térmico incompatível: ${gateRefri.detalhe || gateRefri.motivo}` };
    }
    const conflitoPlaca = await verificarConflitoPlaca(novaPlaca, atual.data_escala, alocacaoId);
    if (conflitoPlaca.sucesso && conflitoPlaca.dados) return { sucesso: false, erro: `Veiculo ${novaPlaca} ja alocado nesta data` };
    await registrarHistorico(alocacaoId, { alocacao_id: alocacaoId, evento: 'troca_veiculo', descricao: `Veiculo: ${atual.placa || '?'} → ${novaPlaca}. ${motivo || ''}`, created_by: usuarioId });
    return await atualizarAlocacao(alocacaoId, { placa: novaPlaca, updated_by: usuarioId });
  } catch (err: any) { return { sucesso: false, erro: err.message }; }
}

// ============================================================================
// FUNCOES DE HISTORICO
// ============================================================================

/**
 * Registra um evento no histórico de uma alocação
 */
export async function registrarHistorico(
  alocacao_id: string,
  dados: NovoHistoricoAlocacao
): Promise<ResultadoOperacao<HistoricoAlocacaoEscala>> {
  try {
    const { data, error } = await supabase
      .from('historico_alocacoes_escala')
      .insert([dados])
      .select()
      .single();

    if (error) {
      console.error('[EscalaService] Erro ao registrar histórico:', error);
      return {
        sucesso: false,
        erro: error.message,
      };
    }

    return {
      sucesso: true,
      dados: data,
    };
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao registrar histórico:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Lista o histórico de uma alocação
 */
export async function listarHistorico(
  alocacao_id: string
): Promise<ResultadoOperacao<HistoricoAlocacaoEscala[]>> {
  try {
    const { data, error } = await supabase
      .from('historico_alocacoes_escala')
      .select('*')
      .eq('alocacao_id', alocacao_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[EscalaService] Erro ao listar histórico:', error);
      return {
        sucesso: false,
        erro: error.message,
      };
    }

    return {
      sucesso: true,
      dados: data || [],
    };
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao listar histórico:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
    };
  }
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Verifica se existe conflito de prestador na mesma data
 */
export async function verificarConflitoPrestador(
  prestador_id: string,
  data_escala: string,
  alocacao_id_ignorar?: string
): Promise<ResultadoOperacao<boolean>> {
  try {
    let query = supabase
      .from('alocacoes_escala')
      .select('id', { count: 'exact', head: true })
      .eq('prestador_id', prestador_id)
      .eq('data_escala', data_escala)
      .in('status', ['planejada', 'aguardando_aceite', 'aceita', 'em_rota', 'ocorrencia']);

    if (alocacao_id_ignorar) {
      query = query.neq('id', alocacao_id_ignorar);
    }

    const { count, error } = await query;

    if (error) {
      console.error('[EscalaService] Erro ao verificar conflito:', error);
      return {
        sucesso: false,
        erro: error.message,
      };
    }

    return {
      sucesso: true,
      dados: (count || 0) > 0,
      mensagem: (count || 0) > 0 ? 'Prestador já tem alocação nesta data' : 'Sem conflitos',
    };
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao verificar conflito:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Verifica se existe conflito de veículo (placa) na mesma data
 */
export async function verificarConflitoPlaca(
  placa: string,
  data_escala: string,
  alocacao_id_ignorar?: string
): Promise<ResultadoOperacao<boolean>> {
  try {
    let query = supabase
      .from('alocacoes_escala')
      .select('id', { count: 'exact', head: true })
      .eq('placa', placa)
      .eq('data_escala', data_escala)
      .in('status', ['planejada', 'aguardando_aceite', 'aceita', 'em_rota', 'ocorrencia']);

    if (alocacao_id_ignorar) {
      query = query.neq('id', alocacao_id_ignorar);
    }

    const { count, error } = await query;

    if (error) {
      console.error('[EscalaService] Erro ao verificar conflito de placa:', error);
      return {
        sucesso: false,
        erro: error.message,
      };
    }

    return {
      sucesso: true,
      dados: (count || 0) > 0,
      mensagem: (count || 0) > 0 ? `Veículo placa ${placa} já está alocado nesta data` : 'Sem conflitos',
    };
  } catch (err: any) {
    console.error('[EscalaService] Exceção ao verificar conflito de placa:', err);
    return {
      sucesso: false,
      erro: err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Exportar todas as funções como objeto default também
 */
export default {
  listarAlocacoes,
  listarAlocacoesAppPrestador,
  buscarAlocacaoPorId,
  criarAlocacao,
  atualizarAlocacao,
  cancelarAlocacao,
  aceitarAlocacao,
  recusarAlocacao,
  iniciarRota,
  finalizarAlocacao,
  registrarHistorico,
  listarHistorico,
  verificarConflitoPrestador,
};
