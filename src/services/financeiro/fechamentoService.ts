// ============================================================================
// FIN-P1-03 — Fechamento do Prestador: ciclo de vida completo
//
// Ciclo: EM_CONFERENCIA → CONFERIDO → APROVADO → PAGO → CANCELADO
//
// Regras:
// - Cada item (pagamentos_prestadores) pertence no MÁXIMO 1 fechamento ativo
// - Snapshot: valores são preservados no momento da conferência
// - Idempotência: segunda confirmação de pagamento é bloqueada
// - Aprovação: só items conferidos podem ser aprovados
// - Pagamento: só fechamento aprovado pode ser pago
// ============================================================================

import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

export type StatusFechamento =
  | "em_conferencia"
  | "conferido"
  | "aprovado"
  | "pago"
  | "cancelado";

export interface CriarFechamentoInput {
  prestador_id: string;
  prestador_nome: string;
  prestador_documento?: string;
  periodo_inicio: string;
  periodo_fim: string;
  itens_ids: string[]; // IDs dos pagamentos_prestadores (serviços)
  observacao?: string;
}

export interface FechamentoDetalhado {
  id: string;
  prestador_id: string;
  prestador_nome: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_servicos: number;
  valor_reembolsos: number;
  valor_bonus: number;
  valor_descontos: number;
  valor_adiantamentos: number;
  valor_liquido: number;
  quantidade_itens: number;
  status: StatusFechamento;
  data_conferencia: string | null;
  data_aprovacao: string | null;
  data_pagamento: string | null;
  observacao: string | null;
  itens: FechamentoItem[];
}

export interface FechamentoItem {
  id: string;
  prestador_nome: string;
  valor_servicos: number;
  pedagio: number;
  adicionais: number;
  descontos: number;
  valor_liquido: number;
  os_id: string | null;
  os_numero: string | null;
  origem_lancamento: string | null;
  periodo_inicio: string;
}

// ── Transições permitidas ──────────────────────────────────────────────────

const TRANSICOES_PERMITIDAS: Record<StatusFechamento, StatusFechamento[]> = {
  em_conferencia: ["conferido", "cancelado"],
  conferido: ["aprovado", "cancelado"],
  aprovado: ["pago", "cancelado"],
  pago: [], // Terminal
  cancelado: [], // Terminal
};

function validarTransicao(atual: StatusFechamento, novo: StatusFechamento): void {
  const permitidos = TRANSICOES_PERMITIDAS[atual] || [];
  if (!permitidos.includes(novo)) {
    throw new Error(
      `Transição inválida: ${atual} → ${novo}. Permitidos: ${permitidos.join(", ") || "nenhum"}`
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

const hoje = (): string => new Date().toISOString().split("T")[0];

// ── 1. CRIAR FECHAMENTO ───────────────────────────────────────────────────
// Agrupa itens existentes em um fechamento. Snapshot dos valores no momento.

export async function criarFechamento(input: CriarFechamentoInput): Promise<FechamentoDetalhado> {
  if (!input.prestador_id) throw new Error("prestador_id é obrigatório");
  if (!input.itens_ids?.length) throw new Error("Pelo menos 1 item é obrigatório");

  // Verificar que todos os itens existem e pertencem ao prestador
  const { data: itens, error: errItens } = await supabase
    .from("pagamentos_prestadores")
    .select("id, prestador_id, status, fechamento_id, valor_liquido, valor_servicos, pedagio, adicionais, descontos, valor_reembolsos, valor_bonus, valor_adiantamentos, os_id, os_numero, origem_lancamento, periodo_inicio")
    .in("id", input.itens_ids);

  if (errItens) throw new Error(`Erro ao buscar itens: ${errItens.message}`);
  if (!itens?.length) throw new Error("Nenhum item encontrado para os IDs informados");

  // Validações
  for (const item of itens) {
    if (item.prestador_id !== input.prestador_id) {
      throw new Error(`Item ${item.id} não pertence ao prestador ${input.prestador_id}`);
    }
    if (item.fechamento_id) {
      throw new Error(`Item ${item.id} já pertence ao fechamento ${item.fechamento_id}`);
    }
  }

  // Snapshot: calcular totais no momento da criação
  const totalServicos = arredondar2(itens.reduce((s, i) => s + (i.valor_servicos || 0), 0));
  const totalPedagio = arredondar2(itens.reduce((s, i) => s + (i.pedagio || 0), 0));
  const totalAdicionais = arredondar2(itens.reduce((s, i) => s + (i.adicionais || 0), 0));
  const totalDescontos = arredondar2(itens.reduce((s, i) => s + (i.descontos || 0), 0));
  const totalReembolsos = arredondar2(itens.reduce((s, i) => s + (i.valor_reembolsos || 0), 0));
  const totalBonus = arredondar2(itens.reduce((s, i) => s + (i.valor_bonus || 0), 0));
  const totalAdiantamentos = arredondar2(itens.reduce((s, i) => s + (i.valor_adiantamentos || 0), 0));
  const totalLiquido = arredondar2(itens.reduce((s, i) => s + (i.valor_liquido || 0), 0));

  // Criar registro do fechamento (a "mãe")
  const payloadFechamento = {
    prestador_id: input.prestador_id,
    prestador_nome: input.prestador_nome,
    prestador_documento: input.prestador_documento || null,
    valor_liquido: totalLiquido,
    valor_servicos: totalServicos,
    valor_reembolsos: totalReembolsos,
    valor_bonus: totalBonus,
    valor_descontos: totalDescontos,
    valor_adiantamentos: totalAdiantamentos,
    pedagio: totalPedagio,
    adicionais: totalAdicionais,
    descontos: totalDescontos,
    qtd_os: itens.length,
    quantidade_os: itens.length,
    tipo_lancamento: "Fechamento",
    tipo_pagamento: "fechamento",
    natureza: "credito",
    origem_lancamento: "fechamento",
    data_competencia: input.periodo_fim,
    competencia: input.periodo_fim,
    data_prevista_pagamento: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    periodo_inicio: input.periodo_inicio,
    periodo_fim: input.periodo_fim,
    status: "pendente",
    status_conferencia: "em_aberto",
    status_aprovacao: "aguardando_aprovacao",
    status_pagamento: "pendente",
    impacto_dre: true,
    impacto_fluxo_caixa: true,
    observacao: input.observacao || `Fechamento ${input.periodo_inicio} a ${input.periodo_fim} — ${itens.length} itens`,
  };

  const { data: fechamento, error: errFech } = await supabase
    .from("pagamentos_prestadores")
    .insert([payloadFechamento])
    .select()
    .single();

  if (errFech) throw new Error(`Erro ao criar fechamento: ${errFech.message}`);

  // Vincular itens ao fechamento
  const { error: errLink } = await supabase
    .from("pagamentos_prestadores")
    .update({ fechamento_id: fechamento.id })
    .in("id", input.itens_ids);

  if (errLink) {
    // Rollback: remover fechamento criado
    await supabase.from("pagamentos_prestadores").delete().eq("id", fechamento.id);
    throw new Error(`Erro ao vincular itens: ${errLink.message}`);
  }

  return buscarFechamento(fechamento.id);
}

// ── 2. BUSCAR FECHAMENTO ──────────────────────────────────────────────────

export async function buscarFechamento(fechamentoId: string): Promise<FechamentoDetalhado> {
  const { data: fechamento, error: errFech } = await supabase
    .from("pagamentos_prestadores")
    .select("*")
    .eq("id", fechamentoId)
    .single();

  if (errFech || !fechamento) throw new Error("Fechamento não encontrado");

  const { data: itens, error: errItens } = await supabase
    .from("pagamentos_prestadores")
    .select("id, prestador_nome, valor_servicos, pedagio, adicionais, descontos, valor_liquido, os_id, os_numero, origem_lancamento, periodo_inicio, valor_reembolsos, valor_bonus, valor_adiantamentos")
    .eq("fechamento_id", fechamentoId)
    .order("periodo_inicio");

  if (errItens) throw new Error(`Erro ao buscar itens: ${errItens.message}`);

  return {
    id: fechamento.id,
    prestador_id: fechamento.prestador_id,
    prestador_nome: fechamento.prestador_nome,
    periodo_inicio: fechamento.periodo_inicio,
    periodo_fim: fechamento.periodo_fim,
    valor_servicos: fechamento.valor_servicos || 0,
    valor_reembolsos: fechamento.valor_reembolsos || 0,
    valor_bonus: fechamento.valor_bonus || 0,
    valor_descontos: fechamento.valor_descontos || 0,
    valor_adiantamentos: fechamento.valor_adiantamentos || 0,
    valor_liquido: fechamento.valor_liquido || 0,
    quantidade_itens: itens?.length || 0,
    status: fechamento.status_conferencia === "em_aberto"
      ? "em_conferencia"
      : fechamento.status_conferencia === "conferido" && fechamento.status_aprovacao === "aguardando_aprovacao"
        ? "conferido"
        : fechamento.status_aprovacao === "aprovado" && fechamento.status_pagamento !== "pago"
          ? "aprovado"
          : fechamento.status_pagamento === "pago"
            ? "pago"
            : fechamento.status === "cancelado"
              ? "cancelado"
              : "em_conferencia",
    data_conferencia: fechamento.data_conferencia || null,
    data_aprovacao: fechamento.data_aprovacao || null,
    data_pagamento: fechamento.data_pagamento || null,
    observacao: fechamento.observacao || null,
    itens: (itens || []) as FechamentoItem[],
  };
}

// ── 3. LISTAR FECHAMENTOS ─────────────────────────────────────────────────

export async function listarFechamentos(params: {
  prestador_id?: string;
  status?: StatusFechamento;
  periodo_inicio?: string;
  periodo_fim?: string;
}): Promise<FechamentoDetalhado[]> {
  let query = supabase
    .from("pagamentos_prestadores")
    .select("id")
    .eq("tipo_pagamento", "fechamento")
    .order("created_at", { ascending: false });

  if (params.prestador_id) query = query.eq("prestador_id", params.prestador_id);
  if (params.periodo_inicio) query = query.gte("periodo_inicio", params.periodo_inicio);
  if (params.periodo_fim) query = query.lte("periodo_fim", params.periodo_fim);

  const { data: fechamentos, error } = await query;
  if (error) throw new Error(`Erro ao listar fechamentos: ${error.message}`);
  if (!fechamentos?.length) return [];

  const detalhes = await Promise.all(
    fechamentos.map(f => buscarFechamento(f.id))
  );

  // Filtro por status (após montagem, pois status é derivado)
  if (params.status) {
    return detalhes.filter(f => f.status === params.status);
  }
  return detalhes;
}

// ── 4. CONFERIR ───────────────────────────────────────────────────────────
// Transição: EM_CONFERENCIA → CONFERIDO
// Autoridade: RPC f_conferir_fechamento (SECURITY DEFINER) — S1 lock preservado.

export async function conferirFechamento(
  fechamentoId: string,
  conferidoPor?: string
): Promise<FechamentoDetalhado> {
  const { data, error } = await supabase.rpc("f_conferir_fechamento", {
    p_fechamento_id: fechamentoId,
    p_conferido_por: conferidoPor ?? null,
  });

  if (error) throw new Error(`Erro ao conferir: ${error.message}`);

  const resultado = Array.isArray(data) ? data[0] : data;
  if (!resultado?.sucesso) {
    throw new Error(resultado?.mensagem || "Fechamento não foi conferido");
  }

  return buscarFechamento(fechamentoId);
}

// ── 5. APROVAR ─────────────────────────────────────────────────────────────
// Transição: CONFERIDO → APROVADO
// Autoridade: RPC f_aprovar_fechamento (SECURITY DEFINER) — S1 lock preservado.

export async function aprovarFechamento(
  fechamentoId: string,
  aprovadoPor?: string
): Promise<FechamentoDetalhado> {
  const { data, error } = await supabase.rpc("f_aprovar_fechamento", {
    p_fechamento_id: fechamentoId,
    p_aprovado_por: aprovadoPor ?? null,
  });

  if (error) throw new Error(`Erro ao aprovar: ${error.message}`);

  const resultado = Array.isArray(data) ? data[0] : data;
  if (!resultado?.sucesso) {
    throw new Error(resultado?.mensagem || "Fechamento não foi aprovado");
  }

  return buscarFechamento(fechamentoId);
}

// ── 6. PAGAR ───────────────────────────────────────────────────────────────
// Transição: APROVADO → PAGO
// Idempotência: se já pago, retorna sem erro
// Atomicidade: usa RPC f_confirmar_pagamento_fechamento, que processa
// todos os itens em uma única transação. Se qualquer item falhar,
// NENHUMA alteração financeira persiste.

export async function pagarFechamento(
  fechamentoId: string,
  dataPagamento?: string,
  contaFinanceiraId?: string
): Promise<FechamentoDetalhado> {
  const { data: atual, error: errBusca } = await supabase
    .from("pagamentos_prestadores")
    .select("id, status_pagamento, status_aprovacao, status_conferencia, status, observacao")
    .eq("id", fechamentoId)
    .single();

  if (errBusca || !atual) throw new Error("Fechamento não encontrado");

  // Idempotência: já pago → retorna sem erro
  if (atual.status_pagamento === "pago") {
    return buscarFechamento(fechamentoId);
  }

  const statusAtual = mapStatusCompleto(atual.status_conferencia, atual.status_aprovacao, atual.status);
  validarTransicao(statusAtual, "pago");

  // Chama RPC transacional que paga todos os itens e o fechamento
  // de forma atômica. Não atualiza status manualmente antes da baixa.
  const { data, error: errRpc } = await supabase.rpc("f_confirmar_pagamento_fechamento", {
    p_fechamento_id: fechamentoId,
    p_data_pagamento: dataPagamento || hoje(),
  });

  if (errRpc) {
    throw new Error(`Erro ao pagar fechamento: ${errRpc.message}`);
  }

  const resultado = Array.isArray(data) ? data[0] : data;
  if (!resultado?.sucesso) {
    throw new Error(resultado?.mensagem || "Fechamento não foi pago financeiramente");
  }

  // S1 preservado: authenticated NÃO tem UPDATE direto em pagamentos_prestadores.
  // O status e a baixa são gravados pela RPC transacional acima. A referência
  // da conta (contaFinanceiraId) permanece na assinatura por compatibilidade,
  // porém não executa DML direto nesta camada.

  return buscarFechamento(fechamentoId);
}

// ── 7. CANCELAR ────────────────────────────────────────────────────────────
// Transição: qualquer estado exceto PAGO → CANCELADO
// Autoridade: RPC f_cancelar_fechamento (SECURITY DEFINER) — S1 lock preservado.

export async function cancelarFechamento(
  fechamentoId: string,
  motivo: string
): Promise<FechamentoDetalhado> {
  if (!motivo?.trim()) throw new Error("Motivo do cancelamento é obrigatório");

  const { data, error } = await supabase.rpc("f_cancelar_fechamento", {
    p_fechamento_id: fechamentoId,
    p_motivo: motivo.trim(),
  });

  if (error) throw new Error(`Erro ao cancelar: ${error.message}`);

  const resultado = Array.isArray(data) ? data[0] : data;
  if (!resultado?.sucesso) {
    throw new Error(resultado?.mensagem || "Fechamento não foi cancelado");
  }

  return buscarFechamento(fechamentoId);
}

// ── 8. VERIFICAR DUPLICIDADE ──────────────────────────────────────────────
// Retorna true se o item já está em algum fechamento não-cancelado

export async function itemEmFechamentoAtivo(itemId: string): Promise<boolean> {
  const { data } = await supabase
    .from("pagamentos_prestadores")
    .select("fechamento_id")
    .eq("id", itemId)
    .single();

  if (!data?.fechamento_id) return false;

  // Verificar se o fechamento pai está cancelado
  const { data: pai } = await supabase
    .from("pagamentos_prestadores")
    .select("status")
    .eq("id", data.fechamento_id)
    .single();

  return pai?.status !== "cancelado";
}

// ── Mappers ────────────────────────────────────────────────────────────────

function mapStatusCompleto(
  conferencia: string,
  aprovacao: string,
  status?: string
): StatusFechamento {
  if (status === "cancelado") return "cancelado";
  if (status === "pago") return "pago";
  if (aprovacao === "aprovado") return "aprovado";
  if (conferencia === "conferido") return "conferido";
  return "em_conferencia";
}
