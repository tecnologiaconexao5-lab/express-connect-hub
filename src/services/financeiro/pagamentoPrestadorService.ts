import { supabase } from "@/lib/supabase";

// ───────────────────────────────────────────────────────────────────────────────
// MISSÃO F0-E / F0-E2 — Pagamento de Prestadores: serviço = ÚNICA fonte de escrita.
// Contrato REAL de `pagamentos_prestadores` (confirmado em Produção via
// information_schema — F0-E2).
// NÃO ENVIAR: arquivo, conta_pagamento, forma_pagamento, cliente_id,
//            cliente_nome, tenant_id (colunas inexistentes).
// NÃO ENVIAR: valor (F0-E2 — coluna NÃO existe em produção; o valor financeiro
//            oficial é `valor_liquido`). `valor` só existe na tabela legada
//            `pagamento_prestadores` (singular, 6 colunas) e no migration
//            stale 20260510090000_baseline_external_tables.sql.
// Mapeamentos seguros: forma_pagamento → tipo_pagamento; conta/arquivo →
//            observacao (referência textual); valor (input) → valor_liquido.
// ───────────────────────────────────────────────────────────────────────────────

const arredondar2 = (n: number): number => Math.round(n * 100) / 100;
const hoje = (): string => new Date().toISOString().split("T")[0];
const em30Dias = (): string => new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

function montarObservacao(observacao?: string, contaPagamento?: string, arquivo?: string): string | null {
  const partes: string[] = [];
  if (observacao && observacao.trim()) partes.push(observacao.trim());
  if (contaPagamento && contaPagamento.trim()) partes.push(`[Conta de pagamento: ${contaPagamento.trim()}]`);
  if (arquivo && arquivo.trim()) partes.push(`[Anexo: ${arquivo.trim()}]`);
  return partes.length > 0 ? partes.join(" ") : null;
}

export interface PagamentoPrestadorInput {
  prestador_id?: string;
  prestador_nome?: string;
  prestador_documento?: string;
  os_id?: string;
  os_numero?: string;
  valor: number;
  valor_liquido?: number;
  valor_servicos?: number;
  valor_reembolsos?: number;
  valor_bonus?: number;
  valor_descontos?: number;
  valor_adiantamentos?: number;
  pedagio?: number;
  reembolsos?: number;
  adicionais?: number;
  descontos?: number;
  adiantamentos?: number;
  multas?: number;
  ajustes?: number;
  data_competencia?: string;
  competencia?: string;
  data_prevista_pagamento?: string;
  tipo_lancamento?: string;
  tipo_pagamento?: string;
  natureza?: string;
  origem_lancamento?: string;
  quantidade_os?: number;
  periodo_inicio?: string;
  periodo_fim?: string;
  categoria_financeira?: string;
  centro_custo?: string;
  conta_contabil?: string;
  status_conferencia?: string;
  status_aprovacao?: string;
  status_pagamento?: string;
  elegivel_lote?: boolean;
  lote_id?: string;
  impacto_dre?: boolean;
  impacto_fluxo_caixa?: boolean;
  observacao?: string;
  // Referências textuais (NUNCA gravadas como coluna — migradas p/ observacao)
  conta_pagamento?: string;
  arquivo?: string;
}

export interface PagamentoPrestadorUpdate {
  status_conferencia?: string;
  status_pagamento?: string;
  status_aprovacao?: string;
  status?: string;
  data_pagamento?: string;
  valor_liquido?: number;
  observacao?: string;
}

export interface DadosFechamento {
  valor_total: number;
  valor_servicos?: number;
  valor_reembolsos?: number;
  valor_bonus?: number;
  valor_descontos?: number;
  valor_adiantamentos?: number;
  periodo_inicio: string;
  periodo_fim: string;
  itens_ids?: string[];
  prestador_nome?: string;
  prestador_documento?: string;
  qtd_os?: number;
  status_aprovacao?: string;
  impacto_dre?: boolean;
  impacto_fluxo_caixa?: boolean;
  data_competencia?: string;
  origem_lancamento?: string;
  observacao?: string;
}

export interface AtualizarFechamento {
  valor_total?: number;
  valor_servicos?: number;
  valor_reembolsos?: number;
  valor_bonus?: number;
  valor_descontos?: number;
  valor_adiantamentos?: number;
  periodo_inicio?: string;
  periodo_fim?: string;
  qtd_os?: number;
  observacao?: string;
}

// ───────────────────────────────────────────────────────────────────────────────
// Anti-duplicidade (idempotência de retry)
// UNIQUE(os_id) já protege contra duplicação por OS. Esta checagem prévia torna
// a criação idempotente: retry do MESMO fechamento/lote/OS retorna o registro
// existente em vez de criar duplicata ou estourar violação de unicidade.
// ───────────────────────────────────────────────────────────────────────────────
async function buscarPagamentoDuplicado(params: {
  prestador_id?: string;
  os_id?: string;
  os_numero?: string;
  origem_lancamento?: string;
  valor_liquido?: number;
  periodo_inicio?: string;
  periodo_fim?: string;
  tipo_pagamento?: string;
}): Promise<any | null> {
  // Dedup SOMENTE quando há chave concreta de unicidade (OS vinculada / fechamento
  // por período). Lançamentos manuais sem OS PODEM se repetir (mesmo valor/prestador
  // é legítimo em meses diferentes) — retry só é protegido por OS e fechamento.
  const temChaveOs = Boolean(params.os_id || params.os_numero);
  const temChaveFechamento = Boolean(params.tipo_pagamento && params.periodo_inicio && params.periodo_fim);
  if (!temChaveOs && !temChaveFechamento) return null;

  let q = supabase.from("pagamentos_prestadores").select("id").limit(1);

  if (params.os_id) {
    q = q.eq("os_id", params.os_id);
  } else if (params.prestador_id && params.os_numero) {
    q = q.eq("prestador_id", params.prestador_id).eq("os_numero", params.os_numero);
  }

  if (params.origem_lancamento) q = q.eq("origem_lancamento", params.origem_lancamento);
  if (params.valor_liquido !== undefined) q = q.eq("valor_liquido", params.valor_liquido);
  if (params.periodo_inicio) q = q.eq("periodo_inicio", params.periodo_inicio);
  if (params.periodo_fim) q = q.eq("periodo_fim", params.periodo_fim);
  if (params.tipo_pagamento) q = q.eq("tipo_pagamento", params.tipo_pagamento);

  const { data } = await q.maybeSingle();
  return data || null;
}

export async function listarPagamentos(params: {
  page?: number;
  pageSize?: number;
  status_pagamento?: string;
  status_conferencia?: string;
  prestador_id?: string;
  os_id?: string;
  data_inicio?: string;
  data_fim?: string;
}): Promise<{ data: any[]; total: number }> {
  let query = supabase
    .from("pagamentos_prestadores")
    .select("*", { count: "exact" });

  if (params.status_pagamento) query = query.eq("status_pagamento", params.status_pagamento);
  if (params.status_conferencia) query = query.eq("status_conferencia", params.status_conferencia);
  if (params.prestador_id) query = query.eq("prestador_id", params.prestador_id);
  if (params.os_id) query = query.eq("os_id", params.os_id);
  if (params.data_inicio) query = query.gte("data_competencia", params.data_inicio);
  if (params.data_fim) query = query.lte("data_competencia", params.data_fim);

  const page = params.page || 1;
  const pageSize = params.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Erro ao listar pagamentos: ${error.message}`);
  return { data: data || [], total: count || 0 };
}

// ───────────────────────────────────────────────────────────────────────────────
// CRIAR pagamento — única fonte de escrita. SOMENTE colunas reais.
// ───────────────────────────────────────────────────────────────────────────────
export async function criarPagamento(input: PagamentoPrestadorInput): Promise<any> {
  if (typeof input.valor !== "number" || isNaN(input.valor) || input.valor < 0) {
    throw new Error("Valor inválido para pagamento");
  }
  if (!input.prestador_id && !input.prestador_nome) {
    throw new Error("Prestador é obrigatório");
  }

  const valor = arredondar2(input.valor);
  const valorLiquido = input.valor_liquido !== undefined ? arredondar2(input.valor_liquido) : valor;
  const competencia = input.data_competencia || input.competencia || hoje();
  const previsao = input.data_prevista_pagamento || em30Dias();
  const observacao = montarObservacao(input.observacao, input.conta_pagamento, input.arquivo);

  // Idempotência: retry não duplica (mesmo prestador+OS / mesmo prestador+os_numero+origem)
  const duplicado = await buscarPagamentoDuplicado({
    prestador_id: input.prestador_id,
    os_id: input.os_id,
    os_numero: input.os_numero,
    origem_lancamento: input.origem_lancamento || "manual",
    valor_liquido: valorLiquido,
  });
  if (duplicado) return duplicado;

  const payload = {
    prestador_id: input.prestador_id || null,
    prestador_nome: input.prestador_nome || "Não informado",
    prestador_documento: input.prestador_documento || null,
    os_id: input.os_id || null,
    os_numero: input.os_numero || null,
    valor_liquido: valorLiquido,
    valor_servicos: input.valor_servicos !== undefined ? arredondar2(input.valor_servicos) : valor,
    valor_reembolsos: input.valor_reembolsos !== undefined ? arredondar2(input.valor_reembolsos) : 0,
    valor_bonus: input.valor_bonus !== undefined ? arredondar2(input.valor_bonus) : 0,
    valor_descontos: input.valor_descontos !== undefined ? arredondar2(input.valor_descontos) : 0,
    valor_adiantamentos: input.valor_adiantamentos !== undefined ? arredondar2(input.valor_adiantamentos) : 0,
    pedagio: input.pedagio !== undefined ? arredondar2(input.pedagio) : 0,
    reembolsos: input.reembolsos !== undefined ? arredondar2(input.reembolsos) : 0,
    adicionais: input.adicionais !== undefined ? arredondar2(input.adicionais) : 0,
    descontos: input.descontos !== undefined ? arredondar2(input.descontos) : 0,
    adiantamentos: input.adiantamentos !== undefined ? arredondar2(input.adiantamentos) : 0,
    multas: input.multas !== undefined ? arredondar2(input.multas) : 0,
    ajustes: input.ajustes !== undefined ? arredondar2(input.ajustes) : 0,
    data_competencia: competencia,
    competencia: input.competencia || competencia,
    data_prevista_pagamento: previsao,
    tipo_lancamento: input.tipo_lancamento || "Serviço",
    tipo_pagamento: input.tipo_pagamento || null,
    natureza: input.natureza || "credito",
    origem_lancamento: input.origem_lancamento || "manual",
    quantidade_os: input.quantidade_os ?? 1,
    periodo_inicio: input.periodo_inicio || competencia,
    periodo_fim: input.periodo_fim || competencia,
    categoria_financeira: input.categoria_financeira || "Custo Logístico",
    centro_custo: input.centro_custo || null,
    conta_contabil: input.conta_contabil || null,
    status_conferencia: input.status_conferencia || "em_aberto",
    status_aprovacao: input.status_aprovacao || "aguardando_aprovacao",
    status_pagamento: input.status_pagamento || "pendente",
    elegivel_lote: input.elegivel_lote ?? false,
    lote_id: input.lote_id || null,
    impacto_dre: input.impacto_dre ?? true,
    impacto_fluxo_caixa: input.impacto_fluxo_caixa ?? true,
    observacao: observacao || null,
  };

  const { data, error } = await supabase
    .from("pagamentos_prestadores")
    .insert([payload])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar pagamento: ${error.message}`);
  return data;
}

// ───────────────────────────────────────────────────────────────────────────────
// FIN-PP-FUNC-01 — NOVO LANÇAMENTO (obrigação manual de prestador)
// UI → service → RPC f_criar_lancamento_manual_prestador.
// A RPC cria PP (workflow) + FP (obrigação contábil) de forma atômica.
// Sem INSERT direto do frontend; sem duplicar OS/Programação (os_id sempre NULL).
// ───────────────────────────────────────────────────────────────────────────────
export interface CriarLancamentoManualInput {
  prestador_id: string;
  tipo_lancamento: string;
  data: string;
  valor: number;
  descricao: string;
  forma_pagamento?: string;
  conta_pagamento?: string;
  idempotencyKey?: string;
}

export interface CriarLancamentoManualResult {
  sucesso: boolean;
  mensagem: string;
  pagamento_prestador_id: string | null;
  financeiro_pagar_id: string | null;
  idempotente: boolean;
}

export async function criarLancamentoManualPrestador(
  input: CriarLancamentoManualInput,
  client: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }> } = supabase as any
): Promise<CriarLancamentoManualResult> {
  if (!input.prestador_id) throw new Error("Prestador é obrigatório");
  if (!input.tipo_lancamento) throw new Error("Tipo do lançamento é obrigatório");
  if (!input.data) throw new Error("Data é obrigatória");
  if (!(Number(input.valor) > 0)) throw new Error("Valor deve ser maior que zero");
  if (!input.descricao || !input.descricao.trim()) throw new Error("Descrição é obrigatória");

  const { data, error } = await client.rpc("f_criar_lancamento_manual_prestador", {
    p_prestador_id: input.prestador_id,
    p_tipo_lancamento: input.tipo_lancamento,
    p_data: input.data,
    p_valor: Number(input.valor),
    p_descricao: input.descricao.trim(),
    p_forma_pagamento: input.forma_pagamento || null,
    p_conta_pagamento: input.conta_pagamento || null,
    p_idempotency_key: input.idempotencyKey || null,
  });
  if (error) throw new Error(`Erro ao criar lançamento: ${error.message}`);
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) throw new Error("Resposta vazia da RPC de lançamento.");
  if (!r.sucesso) throw new Error(r.mensagem || "Não foi possível criar o lançamento.");
  return r as CriarLancamentoManualResult;
}

// ───────────────────────────────────────────────────────────────────────────────
// Atualizar status — SOMENTE colunas reais de status/datas.
// Campos desconhecidos (ex.: liberado_com_justificativa) NÃO são gravados.
// ───────────────────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────────
// Aprovar/Conferir pagamentos — UNICA autoridade: RPC f_aprovar_pagamento_prestadores.
// 05D.7B.1 (S2): a UI nao escreve status diretamente.
// ───────────────────────────────────────────────────────────────────────────────
export interface AprovarResult {
  solicitados: number;
  aprovados: number;
  ja_aprovados: number;
  bloqueados: number;
  detalhes: unknown;
}

export async function aprovarPagamentos(
  ids: string[],
  client: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }> } = supabase as any
): Promise<AprovarResult> {
  const { data, error } = await client.rpc("f_aprovar_pagamento_prestadores", { p_ids: ids });
  if (error) throw new Error(error.message || "Erro ao aprovar pagamento");
  const r = Array.isArray(data) ? data[0] : data;
  return r as AprovarResult;
}

// ───────────────────────────────────────────────────────────────────────────────
// Atualizar status — SOMENTE via RPCs oficiais (S1 bloqueou UPDATE direto).
//   - pago            -> f_confirmar_pagamento_prestador (baixa)
//   - aprovado/conferido -> f_aprovar_pagamento_prestadores
//   - reprovar/cancelar  -> SEM RPC oficial: NAO permitido (pendencia S2)
// NAO ha mais .update() direto em pagamentos_prestadores nesta funcao.
// ───────────────────────────────────────────────────────────────────────────────
export async function atualizarStatusPagamento(
  id: string,
  status: PagamentoPrestadorUpdate,
  _motivo?: string
): Promise<any> {
  if (status.status_pagamento === "pago" || status.status === "pago") {
    return confirmarPagamento(id, status.data_pagamento);
  }

  const querAprovar = status.status_aprovacao === "aprovado" || status.status_conferencia === "conferido";
  if (querAprovar) {
    const r = await aprovarPagamentos([id]);
    if (r.aprovados === 0 && r.ja_aprovados === 0) {
      const motivos = Array.isArray(r.detalhes)
        ? (r.detalhes as any[]).map((d) => d?.motivo).filter(Boolean)
        : [];
      throw new Error(motivos[0] || "Pagamento nao elegivel para aprovacao.");
    }
    return r;
  }

  throw new Error("Acao indisponivel: reprovacao/cancelamento de pagamento aguarda RPC oficial (S2).");
}


export interface GerarLoteResult {
  lote_id: string | null;
  solicitados: number;
  incluidos: number;
  ja_em_lote: number;
  bloqueados: number;
  detalhes: unknown;
}

// 05D.7B.2 — UNICA autoridade para formar lote (RPC homologada 05D.7B.1).
// A UI NUNCA gera UUID nem grava lote_id/status_pagamento diretamente.
export async function gerarLotePagamentos(
  ids: string[],
  client: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }> } = supabase as any
): Promise<GerarLoteResult> {
  const { data, error } = await client.rpc("f_gerar_lote_pagamentos", { p_ids: ids });
  if (error) throw new Error(error.message || "Erro ao gerar lote");
  const r = Array.isArray(data) ? data[0] : data;
  return r as GerarLoteResult;
}

// ───────────────────────────────────────────────────────────────────────────────
// Confirmar pagamento — FIN-362.3E.
// A RPC concilia o titulo e grava baixa + status do pagamento na mesma transacao.
// Nao existe fallback para baixa avulsa nem confirmacao sem origem financeira.
// ───────────────────────────────────────────────────────────────────────────────
export async function confirmarPagamento(
  id: string,
  dataPagamento?: string,
  client: any = supabase
): Promise<any> {
  const { data: atual, error: buscaError } = await client
    .from("pagamentos_prestadores")
    .select("id, status_pagamento, prestador_id, prestador_nome, os_id, valor_liquido, observacao")
    .eq("id", id)
    .single();

  if (buscaError || !atual) throw new Error("Pagamento não encontrado");
  if (atual.status_pagamento === "pago") throw new Error("Pagamento já foi confirmado como pago");
  if (atual.status_pagamento === "cancelado") throw new Error("Pagamento cancelado não pode ser confirmado");

  const { data, error } = await client.rpc("f_confirmar_pagamento_prestador", {
    p_pagamento_id: id,
    p_data_pagamento: dataPagamento || hoje(),
  });

  if (error) throw new Error(`Erro ao confirmar pagamento: ${error.message}`);

  const resultado = Array.isArray(data) ? data[0] : data;
  if (!resultado?.sucesso) {
    throw new Error(resultado?.mensagem || "Pagamento nao conciliado financeiramente");
  }

  return { ...atual, ...resultado };
}

// ───────────────────────────────────────────────────────────────────────────────
// REFORMULACAO-UI-PAGAMENTOS — "Liberar Pagamento" (Fila de Liquidação).
// Orquestra o fluxo OFICIAL de liberação financeira SEM DML direto:
//   1) aprova (f_aprovar_pagamento_prestadores) quando ainda não aprovado;
//   2) baixa financeira atômica (f_confirmar_pagamento_prestador).
// A RPC continua sendo a autoridade; aqui só encadeamos as chamadas oficiais.
// ───────────────────────────────────────────────────────────────────────────────
export interface LiberarPagamentoResult {
  pagamento_id: string;
  ja_pago: boolean;
  aprovado: boolean;
  pago: boolean;
  mensagem: string;
}

export async function liberarPagamentoPrestador(
  id: string,
  dataPagamento?: string,
  client: any = supabase
): Promise<LiberarPagamentoResult> {
  if (!id) throw new Error("Pagamento é obrigatório");

  const { data: atual, error } = await client
    .from("pagamentos_prestadores")
    .select("id, status, status_pagamento, status_conferencia, status_aprovacao, valor_liquido")
    .eq("id", id)
    .single();

  if (error || !atual) throw new Error("Pagamento não encontrado");

  const statusPag = String(atual.status_pagamento || atual.status || "");
  if (statusPag === "pago") {
    return { pagamento_id: id, ja_pago: true, aprovado: true, pago: true, mensagem: "Pagamento já liberado." };
  }
  if (statusPag === "cancelado") {
    throw new Error("Pagamento cancelado não pode ser liberado.");
  }

  const jaAprovado = atual.status_aprovacao === "aprovado" && atual.status_conferencia === "conferido";
  if (!jaAprovado) {
    const r = await aprovarPagamentos([id], client);
    if (r.aprovados === 0 && r.ja_aprovados === 0) {
      const motivos = Array.isArray(r.detalhes)
        ? (r.detalhes as any[]).map((d) => d?.motivo).filter(Boolean)
        : [];
      throw new Error(motivos[0] || "Pagamento não elegível para liberação.");
    }
  }

  await confirmarPagamento(id, dataPagamento, client);

  return { pagamento_id: id, ja_pago: false, aprovado: true, pago: true, mensagem: "Pagamento liberado e baixado." };
}

// ───────────────────────────────────────────────────────────────────────────────
// Fechamento — SOMENTE colunas reais + anti-duplicidade por
// (prestador, período, tipo 'fechamento'). Retry retorna o registro existente.
// ───────────────────────────────────────────────────────────────────────────────
export async function criarFechamento(
  prestadorId: string,
  dados: DadosFechamento
): Promise<any> {
  const valor = arredondar2(dados.valor_total);

  const duplicado = await buscarPagamentoDuplicado({
    prestador_id: prestadorId,
    origem_lancamento: dados.origem_lancamento || "fechamento",
    valor_liquido: valor,
    periodo_inicio: dados.periodo_inicio,
    periodo_fim: dados.periodo_fim,
    tipo_pagamento: "fechamento",
  });
  if (duplicado) return duplicado;

  const payload = {
    prestador_id: prestadorId,
    prestador_nome: dados.prestador_nome || "Não informado",
    prestador_documento: dados.prestador_documento || null,
    valor_liquido: valor,
    valor_servicos: dados.valor_servicos !== undefined ? arredondar2(dados.valor_servicos) : valor,
    valor_reembolsos: dados.valor_reembolsos !== undefined ? arredondar2(dados.valor_reembolsos) : 0,
    valor_bonus: dados.valor_bonus !== undefined ? arredondar2(dados.valor_bonus) : 0,
    valor_descontos: dados.valor_descontos !== undefined ? arredondar2(dados.valor_descontos) : 0,
    valor_adiantamentos: dados.valor_adiantamentos !== undefined ? arredondar2(dados.valor_adiantamentos) : 0,
    qtd_os: dados.qtd_os ?? (dados.itens_ids?.length || 0),
    quantidade_os: dados.qtd_os ?? (dados.itens_ids?.length || 0),
    tipo_lancamento: "Fechamento",
    tipo_pagamento: "fechamento",
    natureza: "credito",
    origem_lancamento: dados.origem_lancamento || "fechamento",
    data_competencia: dados.data_competencia || dados.periodo_fim,
    competencia: dados.data_competencia || dados.periodo_fim,
    data_prevista_pagamento: em30Dias(),
    periodo_inicio: dados.periodo_inicio,
    periodo_fim: dados.periodo_fim,
    status_conferencia: "em_aberto",
    status_aprovacao: dados.status_aprovacao || "aguardando_aprovacao",
    status_pagamento: "pendente",
    impacto_dre: dados.impacto_dre ?? true,
    impacto_fluxo_caixa: dados.impacto_fluxo_caixa ?? true,
    observacao: dados.observacao || `Fechamento de ${dados.periodo_inicio} a ${dados.periodo_fim}`,
  };

  const { data, error } = await supabase
    .from("pagamentos_prestadores")
    .insert([payload])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar fechamento: ${error.message}`);
  return data;
}

// ───────────────────────────────────────────────────────────────────────────────
// Atualizar fechamento — SOMENTE colunas reais (valores + período + qtd)
// ───────────────────────────────────────────────────────────────────────────────
export async function atualizarFechamento(
  id: string,
  dados: AtualizarFechamento
): Promise<any> {
  const update: any = {};
  if (dados.valor_total !== undefined) {
    update.valor_liquido = arredondar2(dados.valor_total);
  }
  if (dados.valor_servicos !== undefined) update.valor_servicos = arredondar2(dados.valor_servicos);
  if (dados.valor_reembolsos !== undefined) update.valor_reembolsos = arredondar2(dados.valor_reembolsos);
  if (dados.valor_bonus !== undefined) update.valor_bonus = arredondar2(dados.valor_bonus);
  if (dados.valor_descontos !== undefined) update.valor_descontos = arredondar2(dados.valor_descontos);
  if (dados.valor_adiantamentos !== undefined) update.valor_adiantamentos = arredondar2(dados.valor_adiantamentos);
  if (dados.periodo_inicio) update.periodo_inicio = dados.periodo_inicio;
  if (dados.periodo_fim) update.periodo_fim = dados.periodo_fim;
  if (dados.qtd_os !== undefined) {
    update.qtd_os = dados.qtd_os;
    update.quantidade_os = dados.qtd_os;
  }
  if (dados.observacao !== undefined) update.observacao = dados.observacao;

  if (Object.keys(update).length === 0) {
    const { data: atual } = await supabase.from("pagamentos_prestadores").select("*").eq("id", id).single();
    return atual;
  }

  const { data, error } = await supabase
    .from("pagamentos_prestadores")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar fechamento: ${error.message}`);
  return data;
}

// ───────────────────────────────────────────────────────────────────────────────
// Vínculo de itens (OS) do fechamento — tabela pagamentos_prestadores_itens.
// SOMENTE colunas reais da tabela de itens. Escrita via serviço (fora da UI).
// ───────────────────────────────────────────────────────────────────────────────
export async function vincularItensFechamento(
  pagamentoId: string,
  itens: Array<{
    os_id: string;
    os_numero?: string;
    valor_servico?: number;
    pedagio?: number;
    adicional?: number;
  }>
): Promise<void> {
  if (!itens.length) return;

  const linhas = itens.map((item) => ({
    pagamento_id: pagamentoId,
    os_id: item.os_id,
    os_numero: item.os_numero || null,
    valor_servico: item.valor_servico !== undefined ? arredondar2(item.valor_servico) : 0,
    pedagio: item.pedagio !== undefined ? arredondar2(item.pedagio) : 0,
    adicional: item.adicional !== undefined ? arredondar2(item.adicional) : 0,
    status: "pendente",
  }));

  const { error } = await supabase
    .from("pagamentos_prestadores_itens")
    .insert(linhas);

  if (error) throw new Error(`Erro ao vincular itens do fechamento: ${error.message}`);
}

// ───────────────────────────────────────────────────────────────────────────────
// PP-UX-02C1C — Ações oficiais de prestador (S2).
// reprovar / cancelar-nao-pago / estornar-integral via RPCs homologadas em
// PP-UX-02C1B. ZERO DML direto em pagamentos_prestadores (somente supabase.rpc).
// Mensagens de negócio retornadas por `mensagem` (codigos estaveis):
//   NECESSARIO_ESTORNO | BLOCKED_PAGAMENTO_PARCIAL | PAGAMENTO_JA_PAGO |
//   ESTADO_NAO_PERMITE_* | NAO_AUTORIZADO* | USUARIO_NAO_AUTENTICADO | etc.
// ───────────────────────────────────────────────────────────────────────────────
export interface AcaoPagamentoPrestadorResult {
  sucesso: boolean;
  mensagem: string;
  pagamento_id?: string;
  status_aprovacao?: string;
  titulo_id?: string | null;
  status_pagamento?: string;
  baixa_id?: string | null;
  fp_status?: string | null;
}

type AcoesPagamentoRpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

async function chamarAcaoPagamentoPrestador(
  fn: string,
  args: Record<string, unknown>,
  client: AcoesPagamentoRpcClient
): Promise<AcaoPagamentoPrestadorResult> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message || `Erro ao executar ${fn}`);
  const r = Array.isArray(data) ? data[0] : data;
  if (!r || typeof r.sucesso !== "boolean") {
    throw new Error(`Resposta invalida de ${fn}`);
  }
  return r as AcaoPagamentoPrestadorResult;
}

export async function reprovarPagamento(
  pagamentoId: string,
  motivo?: string,
  client: AcoesPagamentoRpcClient = supabase as any
): Promise<AcaoPagamentoPrestadorResult> {
  return chamarAcaoPagamentoPrestador(
    "f_reprovar_pagamento_prestador",
    { p_pagamento_id: pagamentoId, p_motivo: motivo ?? null },
    client
  );
}

export async function cancelarPagamento(
  pagamentoId: string,
  motivo?: string,
  client: AcoesPagamentoRpcClient = supabase as any
): Promise<AcaoPagamentoPrestadorResult> {
  return chamarAcaoPagamentoPrestador(
    "f_cancelar_pagamento_prestador",
    { p_pagamento_id: pagamentoId, p_motivo: motivo ?? null },
    client
  );
}

export async function estornarPagamento(
  pagamentoId: string,
  motivo: string,
  client: AcoesPagamentoRpcClient = supabase as any
): Promise<AcaoPagamentoPrestadorResult> {
  return chamarAcaoPagamentoPrestador(
    "f_estornar_pagamento_prestador",
    { p_pagamento_id: pagamentoId, p_motivo: motivo },
    client
  );
}
