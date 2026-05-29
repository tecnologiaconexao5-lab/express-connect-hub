/**
 * Service de Escala Operacional
 * Gerencia alocações de prestadores/motoristas no Supabase
 * 
 * IMPORTANTE: Este service NÃO usa localStorage, apenas Supabase
 */

import { supabase } from '@/lib/supabase';
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
        erro: 'Data da escala é obrigatória',
      };
    }
    if (!dados.tipo_veiculo) {
      return {
        sucesso: false,
        erro: 'Tipo de veículo é obrigatório',
      };
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

    return await atualizarAlocacao(id, atualizacao);
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
  prestador_id?: string
): Promise<ResultadoOperacao<AlocacaoEscala>> {
  try {
    const atualizacao: AtualizarAlocacaoEscala = {
      status: 'em_rota',
      horario_inicio_real: new Date().toISOString(),
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
// FUNÇÕES DE HISTÓRICO
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
      .in('status', ['planejada', 'aguardando_aceite', 'aceita', 'em_rota']);

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
 * Exportar todas as funções como objeto default também
 */
export default {
  listarAlocacoes,
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
