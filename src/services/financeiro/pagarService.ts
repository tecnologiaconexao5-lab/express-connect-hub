import { supabase } from "@/lib/supabase";

export interface PagavelInput {
  descricao: string;
  valor: number;
  prestador_id?: string; // mapeado -> fornecedor_id
  prestador_nome?: string; // mapeado -> fornecedor_nome
  fornecedor?: string;
  fornecedor_documento?: string;
  fornecedor_cadastro_id?: string;  // FIN-FORN-03: FK para fornecedores
  fornecedor_nome?: string;         // FIN-FORN-03: snapshot nome
  data_vencimento: string;
  status?: string;
  os_id?: string;
  os_vinculada?: string;
  observacoes?: string;
  observacao?: string; // compat — mapeado -> observacoes
  categoria?: string;
  competencia?: string;
  plano_contas?: string;
  centro_resultado?: string;
  unidade_filial?: string;
  despesa_fixa_base?: string;
  valor_bruto?: number;
  valor_liquido?: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  impostos_retidos?: number;
  data_emissao?: string;
  data_previsao_pagamento?: string;
  conta_pagadora?: string;
  codigo_barras?: string;
  chave_pix?: string;
  documento?: string;
  tipo_documento?: string;
  recorrente?: boolean;
  parcela?: number; // mapeado -> parcela_atual
  total_parcelas?: number; // mapeado -> quantidade_parcelas
}

export interface PagavelUpdate {
  descricao?: string;
  valor?: number;
  valor_bruto?: number;
  valor_liquido?: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  impostos_retidos?: number;
  prestador_id?: string; // mapeado -> fornecedor_id
  prestador_nome?: string; // mapeado -> fornecedor_nome
  fornecedor?: string;
  fornecedor_documento?: string;
  documento?: string;
  tipo_documento?: string;
  data_vencimento?: string;
  data_emissao?: string;
  data_previsao_pagamento?: string;
  status?: string;
  observacoes?: string;
  observacao?: string; // compat — mapeado -> observacoes
  categoria?: string;
  competencia?: string;
  plano_contas?: string;
  centro_resultado?: string;
  unidade_filial?: string;
  despesa_fixa_base?: string;
  conta_pagadora?: string;
  codigo_barras?: string;
  chave_pix?: string;
  recorrente?: boolean;
  recorrencia?: string; // mapeado -> recorrente (booleano)
  parcela?: number; // mapeado -> parcela_atual
  total_parcelas?: number; // mapeado -> quantidade_parcelas
  os_vinculada?: string;
  data_pagamento?: string;
}

// FIX-CRITICO-FINANCEIRO-E-COTACOES (C1/C2)
// Triggers M66/M80 gravam financeiro_pagar com status 'pendente' (serviço ainda
// em execução) — antes deste fix esse status não tinha transições e a UI de
// Contas a Pagar lançava "Status atual não reconhecido", deixando a conta
// ineditável. 'provisorio' (gravação legada/manual) é unificado a 'provisao'.
const STATUS_TRANSITIONS: Record<string, string[]> = {
  aberto: ["aberto", "pendente", "pago", "parcial", "cancelado"],
  pendente: ["pendente", "aberto", "a vencer", "a_vencer", "vencida", "vencido", "paga", "pago", "parcial", "provisao", "provisorio", "cancelada", "cancelado"],
  parcial: ["parcial", "pago", "cancelado"],
  pago: ["pago"],
  cancelado: ["cancelado"],
  // Status utilizados pelo módulo Contas a Pagar (mapeados da UI)
  "a vencer": ["a vencer", "a_vencer", "vencida", "vencido", "paga", "pago", "parcial", "provisao", "provisorio", "cancelada", "cancelado"],
  a_vencer: ["a vencer", "a_vencer", "vencida", "vencido", "paga", "pago", "parcial", "provisao", "provisorio", "cancelada", "cancelado"],
  vencida: ["vencida", "vencido", "paga", "pago", "parcial", "cancelada", "cancelado"],
  provisao: ["provisao", "provisorio", "a vencer", "a_vencer", "vencida", "paga", "parcial", "cancelada", "cancelado"],
  paga: ["paga"],
  cancelada: ["cancelada", "cancelado"],
};

// Aliases → chave canônica do STATUS_TRANSITIONS
const STATUS_ALIAS: Record<string, string> = {
  pendente: "pendente",
  provisorio: "provisao",
  vencido: "vencida",
  atrasado: "vencida",
  pago: "pago",
  paga: "paga",
  cancelado: "cancelado",
  cancelada: "cancelada",
  aberto: "aberto",
  parcial: "parcial",
  "a vencer": "a_vencer",
  a_vencer: "a_vencer",
  rascunho: "rascunho",
};

function normalizarStatus(status: string | null | undefined): string {
  if (!status) return "";
  return STATUS_ALIAS[status.toLowerCase().trim()] ?? status.toLowerCase().trim();
}

const STATUS_PAGO_SEM_BAIXA = ["pago", "paga", "baixado"];

function validarStatusCriacao(status: string | undefined): string {
  if (status && STATUS_PAGO_SEM_BAIXA.includes(status.toLowerCase())) {
    throw new Error(`Não é permitido criar conta a pagar diretamente com status '${status}'. Use o fluxo oficial de baixa.`);
  }
  return status || "aberto";
}

function validarStatusAtualizacao(statusAtual: string | null, novoStatus: string): void {
  if (!novoStatus) return;
  if (STATUS_PAGO_SEM_BAIXA.includes(novoStatus.toLowerCase())) {
    throw new Error(`Não é permitido alterar status para '${novoStatus}' diretamente. Use o fluxo oficial de baixa (baixarPagavel).`);
  }
  validarTransicao(statusAtual, novoStatus);
}

function validarValor(valor: number): void {
  if (typeof valor !== "number" || isNaN(valor) || valor < 0) {
    throw new Error("Valor inválido: deve ser um número positivo");
  }
}

function validarData(data: string): void {
  const d = new Date(data);
  if (isNaN(d.getTime())) {
    throw new Error(`Data inválida: ${data}`);
  }
}

function validarTransicao(statusAtual: string | null, novoStatus: string): void {
  if (!statusAtual || statusAtual === "rascunho") return;
  // FIX C1/C2: normaliza aliases (pendente, provisorio, vencido...) antes da checagem
  const atual = normalizarStatus(statusAtual);
  const novo = normalizarStatus(novoStatus) || novoStatus.toLowerCase().trim();
  if (!atual || atual === "rascunho") return;
  const permitidosRaw = STATUS_TRANSITIONS[atual];
  if (!permitidosRaw) {
    // Status não mapeado: não bloqueia edição (melhor esforço) — apenas loga
    console.warn(`[pagarService] Status atual "${statusAtual}" sem mapa de transição; editando sem bloqueio.`);
    return;
  }
  const permitidos = new Set(permitidosRaw.flatMap((s) => [s, normalizarStatus(s)]));
  if (!permitidos.has(novo)) {
    throw new Error(`Transição inválida: "${statusAtual}" → "${novoStatus}"`);
  }
}

export async function listarPagaveis(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  prestador_id?: string;
  data_inicio?: string;
  data_fim?: string;
  search?: string;
}): Promise<{ data: any[]; total: number }> {
  let query = supabase
    .from("financeiro_pagar")
    .select("*", { count: "exact" });

  if (params.status) query = query.eq("status", params.status);
  if (params.prestador_id) query = query.eq("prestador_id", params.prestador_id);
  if (params.data_inicio) query = query.gte("data_vencimento", params.data_inicio);
  if (params.data_fim) query = query.lte("data_vencimento", params.data_fim);
  if (params.search) {
    query = query.or(`descricao.ilike.%${params.search}%,fornecedor.ilike.%${params.search}%,prestador_nome.ilike.%${params.search}%`);
  }

  const page = params.page || 1;
  const pageSize = params.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order("data_vencimento", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Erro ao listar contas a pagar: ${error.message}`);
  return { data: data || [], total: count || 0 };
}

export async function criarPagavel(input: PagavelInput): Promise<any> {
  if (!input.descricao) throw new Error("Descrição é obrigatória");
  if (!input.fornecedor && !input.prestador_nome) {
    throw new Error("Fornecedor ou prestador é obrigatório");
  }
  if (!input.prestador_id && !input.fornecedor && !input.prestador_nome) {
    throw new Error("Prestador ou fornecedor é obrigatório");
  }
  validarValor(input.valor);
  validarData(input.data_vencimento);

  const valor = Math.round(input.valor * 100) / 100;
  const fornecedor = input.fornecedor || input.prestador_nome || "Não informado";

  const payload = {
    descricao: input.descricao,
    valor,
    valor_bruto: input.valor_bruto ?? valor,
    valor_liquido: input.valor_liquido ?? valor,
    desconto: input.desconto || 0,
    juros: input.juros || 0,
    multa: input.multa || 0,
    impostos_retidos: input.impostos_retidos || 0,
    fornecedor,
    fornecedor_id: input.prestador_id || null,
    fornecedor_nome: input.fornecedor_nome || input.prestador_nome || null,
    fornecedor_documento: input.fornecedor_documento || null,
    fornecedor_cadastro_id: input.fornecedor_cadastro_id || null,
    documento: input.documento || null,
    tipo_documento: input.tipo_documento || "NF",
    data_vencimento: input.data_vencimento,
    data_emissao: input.data_emissao || null,
    data_previsao_pagamento: input.data_previsao_pagamento || null,
    competencia: input.competencia || null,
    status: validarStatusCriacao(input.status),
    os_id: input.os_id || null,
    os_vinculada: input.os_vinculada || null,
    categoria: input.categoria || null,
    centro_resultado: input.centro_resultado || null,
    plano_contas: input.plano_contas || null,
    unidade_filial: input.unidade_filial || null,
    despesa_fixa_base: input.despesa_fixa_base || "Variável",
    conta_pagadora: input.conta_pagadora || "Conta Corrente Principal",
    codigo_barras: input.codigo_barras || null,
    chave_pix: input.chave_pix || null,
    recorrente: input.recorrente ?? false,
    quantidade_parcelas: input.total_parcelas ?? 1,
    parcela_atual: input.parcela ?? 1,
    observacoes: input.observacoes || input.observacao || null,
  };

  const { data, error } = await supabase
    .from("financeiro_pagar")
    .insert([payload])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar conta a pagar: ${error.message}`);
  return data;
}

export async function criarParcelasPagavel(pagavelId: string, parcelas: { valor: number; data_vencimento: string }[]): Promise<number> {
  const payloads = parcelas.map((p, idx) => {
    validarValor(p.valor);
    validarData(p.data_vencimento);
    const valor = Math.round(p.valor * 100) / 100;
    return {
      descricao: `Parcela - ${pagavelId.slice(0, 8)}`,
      valor,
      valor_bruto: valor,
      valor_liquido: valor,
      data_vencimento: p.data_vencimento,
      status: "aberto",
      parcela_atual: idx + 1,
      quantidade_parcelas: parcelas.length,
      recorrente: false,
    };
  });

  const { error, count } = await supabase
    .from("financeiro_pagar")
    .insert(payloads)
    .select("id", { count: "exact" });

  if (error) throw new Error(`Erro ao criar parcelas: ${error.message}`);
  return count || 0;
}

export async function atualizarPagavel(id: string, update: PagavelUpdate): Promise<any> {
  if (update.valor !== undefined) validarValor(update.valor);
  if (update.data_vencimento) validarData(update.data_vencimento);

  if (update.status) {
    const { data: atual } = await supabase
      .from("financeiro_pagar")
      .select("status")
      .eq("id", id)
      .single();
    if (atual && atual.status !== update.status) validarStatusAtualizacao(atual.status, update.status);
  }

  const valor = update.valor !== undefined ? Math.round(update.valor * 100) / 100 : undefined;

  // Sanitização contra o contrato real de financeiro_pagar (somente colunas existentes)
  const campos: Record<string, unknown> = {};
  const setCampo = (col: string, v: unknown) => {
    if (v !== undefined) campos[col] = v;
  };

  setCampo("descricao", update.descricao);
  setCampo("valor", valor);
  setCampo("valor_bruto", update.valor_bruto);
  setCampo("valor_liquido", update.valor_liquido);
  setCampo("desconto", update.desconto);
  setCampo("juros", update.juros);
  setCampo("multa", update.multa);
  setCampo("impostos_retidos", update.impostos_retidos);
  setCampo("fornecedor", update.fornecedor);
  setCampo("fornecedor_id", update.prestador_id);
  setCampo("fornecedor_nome", update.prestador_nome);
  setCampo("fornecedor_documento", update.fornecedor_documento);
  setCampo("documento", update.documento);
  setCampo("tipo_documento", update.tipo_documento);
  setCampo("data_vencimento", update.data_vencimento);
  setCampo("data_emissao", update.data_emissao);
  setCampo("data_previsao_pagamento", update.data_previsao_pagamento);
  setCampo("status", update.status);
  setCampo("observacoes", update.observacoes !== undefined ? update.observacoes : update.observacao);
  setCampo("categoria", update.categoria);
  setCampo("competencia", update.competencia);
  setCampo("plano_contas", update.plano_contas);
  setCampo("centro_resultado", update.centro_resultado);
  setCampo("unidade_filial", update.unidade_filial);
  setCampo("despesa_fixa_base", update.despesa_fixa_base);
  setCampo("conta_pagadora", update.conta_pagadora);
  setCampo("codigo_barras", update.codigo_barras);
  setCampo("chave_pix", update.chave_pix);
  setCampo(
    "recorrente",
    update.recorrente !== undefined
      ? update.recorrente
      : update.recorrencia !== undefined
        ? update.recorrencia !== "nenhuma"
        : undefined
  );
  setCampo("quantidade_parcelas", update.total_parcelas);
  setCampo("parcela_atual", update.parcela);
  setCampo("os_vinculada", update.os_vinculada);
  setCampo("data_pagamento", update.data_pagamento);

  const { data, error } = await supabase
    .from("financeiro_pagar")
    .update(campos)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar conta a pagar: ${error.message}`);
  return data;
}

const fmtValor = (v: number): string =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface ResultadoBaixa {
  sucesso: boolean;
  mensagem: string;
  baixa_id?: string;
  saldo_restante?: number;
  status_titulo?: string;
}

export interface BaixaFinanceira {
  id: string;
  created_at: string;
  titulo_tabela: string;
  titulo_id: string;
  valor_original: number;
  valor_baixado: number;
  saldo_restante: number;
  data_baixa: string;
  forma_pagamento: string | null;
  conta_financeira: string | null;
  referencia_bancaria: string | null;
  observacao: string | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  estornada: boolean;
  data_estorno: string | null;
  motivo_estorno: string | null;
}

const hojeISO = (): string => new Date().toISOString().split("T")[0];

export async function baixarPagavel(
  id: string,
  valorPago: number,
  dataPagamento?: string,
  contaPagadora?: string,
  observacaoBaixa?: string,
  formaPagamento?: string,
  referenciaBancaria?: string,
  contaFinanceiraId?: string
): Promise<ResultadoBaixa> {
  validarValor(valorPago);

  // FIN-01.1 — fail-closed: título com valor NULL não pode ser baixado via RPC
  const { data: tituloCheck, error: tituloErr } = await supabase
    .from("financeiro_pagar")
    .select("valor, valor_bruto")
    .eq("id", id)
    .maybeSingle();
  if (tituloErr || !tituloCheck) throw new Error("Conta a pagar não encontrada");
  const valorOriginal = tituloCheck.valor != null ? Number(tituloCheck.valor) : null;
  if (valorOriginal === null || !Number.isFinite(valorOriginal) || valorOriginal <= 0) {
    const fallback = tituloCheck.valor_bruto != null ? Number(tituloCheck.valor_bruto) : null;
    if (fallback !== null && Number.isFinite(fallback) && fallback > 0) {
      // Corrigir valor NULL usando valor_bruto como referência
      await supabase.from("financeiro_pagar").update({ valor: fallback }).eq("id", id);
    } else {
      throw new Error(`Título sem valor definido (valor=${tituloCheck.valor}). Corrija o cadastro antes de baixar.`);
    }
  }

  const { data: authUser } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("f_registrar_baixa_financeira", {
    p_titulo_tabela: "financeiro_pagar",
    p_titulo_id: id,
    p_valor_baixado: Math.round(valorPago * 100) / 100,
    p_data_baixa: dataPagamento || hojeISO(),
    p_forma_pagamento: formaPagamento || null,
    p_conta_financeira: contaPagadora || null,
    p_conta_financeira_id: contaFinanceiraId || null,
    p_referencia_bancaria: referenciaBancaria || null,
    p_observacao: observacaoBaixa || null,
    p_usuario_id: authUser?.user?.id || null,
    p_usuario_nome: authUser?.user?.email || null,
  });

  if (error) throw new Error(`Erro ao baixar conta a pagar: ${error.message}`);

  const resultado = (Array.isArray(data) ? data[0] : data) as ResultadoBaixa | undefined;
  if (!resultado?.sucesso) throw new Error(resultado?.mensagem || "Falha ao registrar baixa");

  return resultado;
}

export async function listarBaixasPagavel(pagavelId: string): Promise<BaixaFinanceira[]> {
  const { data, error } = await supabase
    .from("financeiro_baixas")
    .select("*")
    .eq("titulo_tabela", "financeiro_pagar")
    .eq("titulo_id", pagavelId)
    .order("data_baixa", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Erro ao listar baixas: ${error.message}`);
  return (data || []) as BaixaFinanceira[];
}

export async function estornarBaixa(baixaId: string, motivo?: string): Promise<ResultadoBaixa> {
  const { data, error } = await supabase.rpc("f_estornar_baixa_financeira", {
    p_baixa_id: baixaId,
    p_motivo_estorno: motivo || null,
  });

  if (error) throw new Error(`Erro ao estornar baixa: ${error.message}`);

  const resultado = Array.isArray(data) ? data[0] : (data as ResultadoBaixa | null);
  if (!resultado?.sucesso) throw new Error(resultado?.mensagem || "Falha ao estornar baixa");
  return resultado;
}

export async function cancelarPagavel(id: string, motivo?: string): Promise<any> {
  const { data: atual } = await supabase
    .from("financeiro_pagar")
    .select("status, observacoes")
    .eq("id", id)
    .single();

  if (!atual) throw new Error("Conta a pagar não encontrada");
  if (atual.status === "pago" || atual.status === "paga") {
    throw new Error("Conta já paga não pode ser cancelada");
  }
  validarTransicao(atual.status, "cancelado");

  const motivoCancelamento = motivo || "Cancelado manualmente";
  const novoHistorico = `Cancelado: ${motivoCancelamento}`;
  const observacoes = atual.observacoes
    ? `${atual.observacoes}\n${novoHistorico}`
    : novoHistorico;

  const { data, error } = await supabase
    .from("financeiro_pagar")
    .update({ status: "cancelado", observacoes })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao cancelar conta a pagar: ${error.message}`);
  return data;
}

export async function listarPrestadoresFornecedores(query?: string): Promise<any[]> {
  let q = supabase
    .from("prestadores")
    .select("id, nome_completo, cpf_cnpj")
    .eq("ativo", true)
    .order("nome_completo", { ascending: true })
    .limit(20);

  if (query) {
    q = q.or(`nome_completo.ilike.%${query}%,cpf_cnpj.ilike.%${query}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Erro ao buscar prestadores: ${error.message}`);
  return data || [];
}
