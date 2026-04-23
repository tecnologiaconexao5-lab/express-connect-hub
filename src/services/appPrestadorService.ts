// ============================================
// SERVIÇO: Integração App Prestador (CORRIGIDO FINAL)
// Responsável: validar acesso e gerenciar app do prestador
// Revisado em: 2026-04-22
// ============================================
// Este é um serviço PREPARATÓRIO
// Não tem integração real em produção - apenas organiza a base
// ============================================
//
// IMPORTANTE - CORREÇÕES BASEADAS NO SCHEMA FINAL:
// - ordens_servico: prestador é TEXT (não UUID)
// - prestadores: usa nome_completo, tipo_parceiro, scoreInterno
// - Busca via prestador TEXT = nome do prestador
// ============================================

import { supabase } from "@/lib/supabase";

// ============================================
// INTERFACES
// ============================================

export interface PrestadorAcesso {
  prestador: string;  // TEXT (nome do prestador)
  status_cadastro: string;
  data_analise: string | null;
  app_instalado: boolean;
  ultimo_acesso: string | null;
}

export interface PrestadorEngajamento {
  prestador: string;  // TEXT (nome do prestador)
  score_geral: number;
  score_pontualidade: number;
  score_qualidade: number;
  score_comunicacao: number;
  total_entregas: number;
  total_entregas_mes: number;
  taxa_ocorrencias: number;
  bonificacao_ativa: boolean;
  valor_bonificacao: number;
}

export interface AppConfig {
  Engajamento?: {
    enabled: boolean;
    tipos: string[];
  };
  AppVersion?: {
    ios: string;
    android: string;
  };
}

// ============================================
// 1. VALIDAR ACESSO DO PRESTADOR
// Retorna se o prestador pode acessar o app
// Baseado em: prestadores + prestador_acesso (se existir)
// nota: prestador_acesso ainda não existe no schema - necessário criar
// ============================================
export async function validarAcessoPrestador(userId: string): Promise<{
  podeAcessar: boolean;
  status: string;
  motivo?: string;
  precisaAprovar?: boolean;
}> {
// BUSCA PRESTADOR POR user_id (campo do schema atual)
    const { data: prestador, error: pError } = await supabase
      .from("prestadores")
      .select("id, nome_completo, status")
      .eq("user_id", userId)
      .single();

    if (pError || !prestador) {
      return { podeAcessar: false, status: "nao_encontrado", motivo: "Prestador não encontrado" };
    }

    const nomePrestador = prestador.nome_completo;

  // Nota: prestador_acesso NÃO existe no schema atual ainda
  // Por enquanto, usa o status do próprio prestador
  // Quando a tabela for criada, verificar lá também
  if (prestador.status === "ativo") {
    return { podeAcessar: true, status: "aprovado" };
  } else if (prestador.status === "em_analise") {
    return { podeAcessar: false, status: "em_analise", motivo: "Seu cadastro está em análise.", precisaAprovar: true };
  } else if (prestador.status === "inativo") {
    return { podeAcessar: false, status: "inativo", motivo: "Seu acesso foi inativado." };
  } else {
    return { podeAcessar: false, status: "pendente", motivo: "Aguardando análise do cadastro", precisaAprovar: true };
  }
}

// ============================================
// 2. OBTER DADOS DO PRESTADOR (HOME APP)
// Retorna dados para a home do app
// nota: usa campos TEXT pois o schema usa prestador TEXT
// ============================================
export async function getDadosHomeApp(userId: string): Promise<{
  success: boolean;
  dados?: {
    prestador: {
      id: string;
      nome: string;
      tipo: string;
      status: string;
      score: number;
    };
    resumo: {
      emAndamento: number;
      concluidasMes: number;
      pendentesReembolso: number;
      notificationsNaoLidas: number;
    };
    engajamento?: {
      score_geral: number;
      bonificacao_ativa: boolean;
      valor_bonificacao: number;
    };
  };
  erro?: string;
}> {
  try {
    // BUSCA PRESTADOR
    const { data: prestador } = await supabase
      .from("prestadores")
      .select("id, nome_completo, tipo_parceiro, status, scoreInterno")
      .eq("user_id", userId)
      .single();

    if (!prestador) {
      return { success: false, erro: "Prestador não encontrado" };
    }

    // Usa nome completo para buscar ordens (campo TEXT)
    const nomePrestador = prestador.nome_completo;
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // BUSCA DADOS - usa prestador TEXT (nome completo)
    const [{ data: emAndamento }, { data: concluidas }, { data: reembolsos }, { data: notif }, { data: engajamento }] = await Promise.all([
      // Busca por nome (TEXT) em vez de UUID
      supabase.from("ordens_servico").select("id").eq("prestador", nomePrestador).in("status", ["aceita", "em_rota", "em_entrega"]),
      supabase.from("ordens_servico").select("id").eq("prestador", nomePrestador).in("status", ["concluida"]),
      supabase.from("prestador_reembolsos").select("id, valor").eq("prestador", nomePrestador).in("status", ["pendente"]),
      supabase.from("prestador_notificacoes").select("id").eq("prestador", nomePrestador).eq("visualizada", false),
      supabase.from("prestador_engajamento").select("*").eq("prestador", nomePrestador).single(),
    ]);

    // Verifica se data está no mês atual (usando created_at)
    const CondeMes = concluidas?.filter(o => o.created_at >= firstDayOfMonth) ?? [];

    // BUSCA CONFIG DE ENGAJAMENTO
    const [{ data: configEngajamento }] = await Promise.all([
      supabase.from("app_config").select("valor").eq("chave", "engajamento_ativo").single(),
    ]);

    const engajamentoAtivado = configEngajamento?.valor?.enabled ?? false;
    const tipoPermitido = configEngajamento?.valor?.tipos ?? ["Fixo", "Agregado"];
    const mostraEngajamento = engajamentoAtivado && tipoPermitido.includes(prestador.tipoParceiro);

return {
      success: true,
      dados: {
        prestador: {
          id: prestador.id,
          nome: prestador.nome_completo,
          tipo: prestador.tipo_parceiro,
          status: prestador.status,
          score: prestador.scoreInterno,
        },
        resumo: {
          emAndamento: emAndamento?.length ?? 0,
          concluidasMes: CondeMes.length,
          pendentesReembolso: reembolsos?.reduce((sum, r) => sum + (r.valor ?? 0), 0) ?? 0,
          notificationsNaoLidas: notif?.length ?? 0,
        },
        engajamento: mostraEngajamento && engajamento ? {
          score_geral: engajamento.score_geral,
          bonificacao_ativa: engajamento.bonificacao_ativa,
          valor_bonificacao: engajamento.valor_bonificacao,
        } : undefined,
      },
    };
  } catch (err) {
    console.error("[HomeApp] Erro:", err);
    return { success: false, erro: "Erro ao carregar dados" };
  }
}

// ============================================
// 3. OBTER MINHAS ROTAS (OS DO PRESTADOR)
// Retorna ordens de serviço do prestador
// nota: usa prestador (TEXT) + join em clientes
// ============================================
export async function getMinhasRotasApp(prestadorId: string, filtros?: {
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}): Promise<{
  success: boolean;
  rotas?: any[];
  erro?: string;
}> {
  try {
    let query = supabase
      .from("ordens_servico")
      .select(`
        *,
        cliente:clientes(nome_fantasia, razao_social),
        veiculos(placa, tipo)
      `)
      .eq("prestador", prestadorId);

    if (filtros?.status) {
      query = query.eq("status", filtros.status);
    }
    if (filtros?.dataInicio) {
      query = query.gte("created_at", filtros.dataInicio);
    }
    if (filtros?.dataFim) {
      query = query.lte("created_at", filtros.dataFim);
    }

    const { data: ordens, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    // FORMATA RESPOTA
    const rotasFormatadas = ordens?.map((os) => ({
      id: os.id,
      numero: os.numero,
      status: os.status,
      cliente: os.cliente?.nome_fantasia || os.cliente?.razao_social,
      veiculo: os.veiculos?.[0]?.placa,
      tipoVeiculo: os.veiculos?.[0]?.tipo,
      valor: os.valor_cliente,
      previsao: os.previsao_inicio,
      origem: os.unidade,
      createdAt: os.created_at,
    })) ?? [];

    return { success: true, rotas: rotasFormatadas };
  } catch (err) {
    console.error("[MinhasRotas] Erro:", err);
    return { success: false, erro: "Erro ao carregar rotas" };
  }
}

// ============================================
// 4. OBTER DETALHE DA OS COM PARADAS
// Retorna detalhamento de uma OS
// nota: os_enderecos pode ter campos extras (se adicionados)
// ============================================
export async function getDetalheOSApp(osId: string): Promise<{
  success: boolean;
  os?: {
    id: string;
    numero: string;
    status: string;
    valorFrete: number;
    dataPrevisao: string;
    cliente: {
      nome: string;
    };
    veiculo: {
      placa: string;
      tipo: string;
    };
    paradas: {
      id: string;
      tipo: string;
      sequencia: number;
      endereco: string;
      status: string;
      horaChegada?: string;
      horaInicio?: string;
    }[];
    ocorrencias: {
      id: string;
      tipo: string;
      descricao: string;
      status: string;
      createdAt: string;
    }[];
    pod: {
      id: string;
      tipo: string;
      urlComprovante?: string;
    }[];
  };
  erro?: string;
}> {
  try {
    const [{ data: os }, { data: paradas }, { data: ocorrencias }, { data: pods }] = await Promise.all([
      supabase.from("ordens_servico").select("*, cliente:clientes(nome_fantasia), veiculos(placa, tipo)").eq("id", osId).single(),
      supabase.from("os_enderecos").select("*").eq("os_id", osId).order("sequencia"),
      supabase.from("ocorrencias").select("*").eq("os_id", osId).order("created_at", { ascending: false }),
      supabase.from("os_pod").select("*").eq("os_id", osId),
    ]);

    if (!os) {
      return { success: false, erro: "OS não encontrada" };
    }

    return {
      success: true,
      os: {
        id: os.id,
        numero: os.numero,
        status: os.status,
        valorFrete: os.custo_prestador,
        dataPrevisao: os.previsao_inicio,
        cliente: { nome: os.cliente?.nome_fantasia },
        veiculo: { placa: os.veiculos?.[0]?.placa, tipo: os.veiculos?.[0]?.tipo },
        paradas: paradas?.map((p) => ({
          id: p.id,
          tipo: p.tipo,
          sequencia: p.sequencia,
          endereco: p.logradouro || p.nome_local,
          status: p.status_ponto,
          horaChegada: p.hora_chegada,
          horaInicio: p.hora_inicio,
        })) ?? [],
        ocorrencias: ocorrencias?.map((o) => ({
          id: o.id,
          tipo: o.tipo,
          descricao: o.descricao,
          status: o.status,
          createdAt: o.created_at,
        })) ?? [],
        pod: pods?.map((p) => ({
          id: p.id,
          tipo: p.tipo,
          urlComprovante: p.url_comprovante,
        })) ?? [],
      },
    };
  } catch (err) {
    console.error("[DetalheOS] Erro:", err);
    return { success: false, erro: "Erro ao carregar OS" };
  }
}

// ============================================
// 5. REGISTRAR EVENTO DO APP
// Registra eventos para analytics
// Baseado em: dreamflow_eventos (se existir)
// ============================================
export async function registrarEventoApp(prestadorId: string, eventoType: string, osId?: string, metadata?: any): Promise<boolean> {
  try {
    await supabase.from("dreamflow_eventos").insert({
      prestador: prestadorId,  // TEXT
      evento_type: eventoType,
      os_id: osId,
      metadata: metadata,
    });
    return true;
  } catch (err) {
    console.error("[EventoApp] Erro:", err);
    return false;
  }
}

// ============================================
// 6. ATUALIZAR ULTIMO ACESSO
// Atualiza timestamp do último acesso do prestador
// nota:PrestadorAcESSO ainda não existe no schema
// ============================================
export async function atualizaUltimoAcesso(userId: string): Promise<void> {
  // Busca prestador
  const { data: prestador } = await supabase
    .from("prestadores")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (prestador) {
    // AtualizaultimaAtualizacao
    await supabase
      .from("prestadores")
      .update({ ultimaAtualizacao: new Date().toISOString() })
      .eq("id", prestador.id);
  }
}

// ============================================
// 7. VERIFICAR SE É ELEGTIVEL PARA REDE
// Verifica se o prestador é elegível para uma rede de serviço
// nota: usa campos TEXT
// ============================================
export async function verificarElegibilidadeRede(
  prestadorId: string,
  rede: { tipo_veiculo: string; regiao: string }
): Promise<{
  elegivel: boolean;
  motivos?: string[];
}> {
  const motivos: string[] = [];

  // Busca PRESTADOR (nome) e VEÍCULOS
  const [{ data: prestador }, { data: veiculos }, { data: disponibilidade }] = await Promise.all([
    supabase.from("prestadores").select("id, nome_completo, tipo_parceiro, status").eq("nome_completo", prestadorId).single(),
    supabase.from("veiculos").select("id, tipo").eq("prestadorVinculado", prestadorId).eq("status", "Ativo"),
    supabase.from("prestador_disponibilidade").select("*").eq("prestador", prestadorId).eq("disponivel", true).gte("data", new Date().toISOString().split("T")[0]).single(),
  ]);

  if (!prestador) {
    motivos.push("Prestador não encontrado");
  }

  // Verifica STATUS
  if (prestador?.status !== "ativo") {
    motivos.push(`Prestador com status ${prestador.status}`);
  }

  // Verifica VEÍCULO COMPATÍVEL
  if (!veiculos || veiculos.length === 0) {
    motivos.push("Nenhum veículo ativo");
  } else {
    const temTipoCompativel = veiculos.some((v) => v.tipo === rede.tipo_veiculo);
    if (!temTipoCompativel) {
      motivos.push(`Veículo incompatível: precisa ser ${rede.tipo_veiculo}`);
    }
  }

  // Verifica DISPONIBILIDADE
  if (!disponibilidade) {
    motivos.push("Prestador não está disponível");
  }

  return {
    elegivel: motivos.length === 0,
    motivos,
  };
}

// ============================================
// 8. CALCULAR SCORE DO PRESTADOR
// Recalcula score do prestador (chamado periodicamente)
// nota: usa prestador TEXT (nome)
// ============================================
export async function calcularScorePrestador(prestadorNome: string): Promise<void> {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Busca ENTREGAS e OCORRÊNCIAS do mês
  const [{ data: entregas }, { data: ocorrencias }] = await Promise.all([
    supabase.from("ordens_servico").select("id").eq("prestador", prestadorNome).in("status", ["concluida"]),
    supabase.from("ocorrencias").select("id").eq("prestador", prestadorNome),
  ]);

  // Filtra por data
  const CondeMes = entregas?.filter(o => o.created_at >= firstDayOfMonth) ?? [];
  const comOcorrencia = ocorrencias?.filter(o => o.created_at >= firstDayOfMonth) ?? [];

  const total = CondeMes.length;
  const taxaOcorrencias = total > 0 ? (comOcorrencia.length / total) * 100 : 0;

  // Calcula SCORES
  const scorePontualidade = 100 - Math.min(taxaOcorrencias * 10, 30);
  const scoreQualidade = taxaOcorrencias < 5 ? 100 : 100 - (taxaOcorrencias - 5) * 10;
  const scoreGeral = (scorePontualidade * 0.4 + scoreQualidade * 0.6);

  // Salva ENGAJAMENTO
  await supabase.from("prestador_engajamento").upsert({
    prestador: prestadorNome,
    score_geral: Math.round(scoreGeral),
    score_pontualidade: Math.round(scorePontualidade),
    score_qualidade: Math.round(scoreQualidade),
    total_entregas_mes: total,
    taxa_ocorrencias: Math.round(taxaOcorrencias * 100) / 100,
    ultimo_calculo: now.toISOString(),
  }, { onConflict: "prestador" });
}

// ============================================
// MÉTODOS PREPARATÓRIOS (NON-EXECUTION)
// Estes métodos existem mas não são chamados automaticamente
// Estão prontos para a fase de conexão real
// ============================================

// ============================================
// 9. CRIAR REGISTRO DE ACESSO (Preparatório)
// Necessário criar tabela prestador_acesso primeiro
// ============================================
export async function criarRegistroAcesso(prestadorNome: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("prestador_acesso").insert({
      prestador: prestadorNome,
      status_cadastro: "pendente",
    });
    return !error;
  } catch (err) {
    console.error("[CriarAcesso] Erro:", err);
    return false;
  }
}

// ============================================
// 10. ATUALIZAR DISPONIBILIDADE (Preparatório)
// tabela prestador_disponibilidade precisa existir
// ============================================
export async function atualizaDisponibilidade(
  prestadorNome: string,
  data: string,
  periodo: string,
  disponivel: boolean,
  justificativa?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from("prestador_disponibilidade").upsert({
      prestador: prestadorNome,
      data,
      periodo,
      disponivel,
      justificativa,
      updated_at: new Date().toISOString(),
    }, { onConflict: "prestador,data" });
    return !error;
  } catch (err) {
    console.error("[Disponibilidade] Erro:", err);
    return false;
  }
}

// ============================================
// 11. SOLICITAR REEMBOLSO (Preparatório)
// tabela prestador_reembolsos precisa existir
// ============================================
export async function solicitarReembolso(
  prestadorNome: string,
  osId: string,
  tipo: string,
  descricao: string,
  valor: number,
  dataDespesa: string,
  comprovanteUrl?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from("prestador_reembolsos").insert({
      prestador: prestadorNome,
      os_id: osId,
      tipo,
      descricao,
      valor,
      data_despesa: dataDespesa,
      comprovante_url: comprovanteUrl,
      status: "pendente",
    });
    return !error;
  } catch (err) {
    console.error("[Reembolso] Erro:", err);
    return false;
  }
}

// ============================================
// 12. REGISTRAR POD (Preparatório)
// tabela os_pod precisa existir
// ============================================
export async function registrarPOD(
  osId: string,
  paradaId: string,
  tipo: "coleta" | "entrega",
  nomeRecebedor: string,
  documentoRecebedor?: string,
  observacao?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from("os_pod").insert({
      os_id: osId,
      parada_id: paradaId,
      tipo,
      nome_recebedor: nomeRecebedor,
      documento_recebedor: documentoRecebedor,
      observacao,
      timestamp_capture: new Date().toISOString(),
    });
    return !error;
  } catch (err) {
    console.error("[POD] Erro:", err);
    return false;
  }
}

// ============================================
// NOTAS IMPORTANTES:
// ============================================
// 1. Este serviço é PREPARATÓRIO
// 2. Schema FINAL usa prestador TEXT (não UUID!)
// 3. Schema FINAL usa nome_completo, tipo_parceiro (não nome_razao, não tipo_parceiro)
// 4. Tabelas novas (prestador_acesso, etc) precisar ser criadas
// 5. Ready for fase de conexão real quando necessário
// ============================================