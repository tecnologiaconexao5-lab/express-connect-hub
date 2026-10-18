import { supabase } from "@/lib/supabase";

export interface RecebivelInput {
  descricao?: string;
  valor?: number;
  cliente?: string;
  cliente_id?: string;
  cliente_nome?: string;
  cliente_documento?: string;
  data_vencimento: string;
  data_emissao?: string;
  data_previsao_recebimento?: string;
  data_pagamento?: string;
  status?: string;
  os_id?: string;
  os_vinculadas?: string;
  fatura_id?: string;
  fatura?: string;
  serie?: string;
  numero?: string;
  contrato_vinculado?: string;
  proposta_vinculada?: string;
  categoria?: string;
  centro_resultado?: string;
  plano_conta?: string;
  conta_entrada?: string;
  valor_bruto?: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  abatimento?: number;
  valor_liquido?: number;
  recorrente?: boolean;
  recorrencia?: string;
  quantidade_parcelas?: number;
  parcela_atual?: number;
  observacoes?: string;
  forma_recebimento?: string;
  /** TMS-FIN-SEC-02-A6 — chave de idempotência do contrato oficial (RPC). */
  idempotency_key?: string;
  // Campos legados aceitos apenas para compatibilidade de chamadas —
  // NUNCA enviados ao banco (colunas inexistentes em financeiro_receber).
  origem?: string;
  origem_id?: string;
  observacao?: string;
  centro_custo?: string;
  parcela?: number;
  total_parcelas?: number;
  tenant_id?: string;
  competencia?: string;
}

export interface RecebivelUpdate {
  descricao?: string;
  valor?: number;
  cliente?: string;
  cliente_id?: string;
  cliente_nome?: string;
  cliente_documento?: string;
  data_vencimento?: string;
  data_emissao?: string;
  data_previsao_recebimento?: string;
  data_pagamento?: string;
  status?: string;
  categoria?: string;
  observacoes?: string;
  observacao?: string;
  centro_custo?: string;
  os_id?: string;
  os_vinculadas?: string;
  fatura_id?: string;
  fatura?: string;
  serie?: string;
  numero?: string;
  contrato_vinculado?: string;
  proposta_vinculada?: string;
  centro_resultado?: string;
  plano_conta?: string;
  conta_entrada?: string;
  valor_bruto?: number;
  valor_liquido?: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  abatimento?: number;
  recorrente?: boolean;
  recorrencia?: string;
  quantidade_parcelas?: number;
  parcela_atual?: number;
  valor_pago?: number;
  origem?: string;
  competencia?: string;
  tenant_id?: string;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  aberto: ["aberto", "pago", "parcial", "cancelado", "renegociado", "pendente", "vencido", "a vencer"],
  pendente: ["pendente", "pago", "parcial", "cancelado", "renegociado", "aberto", "vencido", "a vencer"],
  "a vencer": ["a vencer", "pago", "parcial", "cancelado", "renegociado", "pendente", "vencido", "aberto"],
  vencido: ["vencido", "pago", "parcial", "cancelado", "renegociado", "pendente", "aberto", "a vencer"],
  parcial: ["parcial", "pago", "cancelado", "renegociado"],
  pago: ["pago"],
  cancelado: ["cancelado"],
  renegociado: ["renegociado"],
};

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
  const permitidos = STATUS_TRANSITIONS[statusAtual];
  if (!permitidos) {
    throw new Error(`Status atual "${statusAtual}" não reconhecido`);
  }
  if (!permitidos.includes(novoStatus)) {
    throw new Error(`Transição inválida: "${statusAtual}" → "${novoStatus}". Permitidas: ${permitidos.join(", ")}`);
  }
}

/**
 * F0-D — WHITELIST de colunas REAIS de financeiro_receber (comprovadas em F0-A/F0-B).
 * Somente estas colunas podem ser gravadas. Campos legados (origem, origem_id,
 * observacao, centro_custo, parcela, total_parcelas, tenant_id, competencia,
 * valor_pago, saldo) são descartados ou mapeados — nunca enviados ao banco.
 */
const CAMPOS_REAIS_RECEBER = [
  "descricao", "valor", "cliente", "cliente_id", "cliente_nome", "cliente_documento",
  "data_vencimento", "data_emissao", "data_pagamento", "data_previsao_recebimento",
  "status", "os_id", "os_vinculadas", "fatura_id", "fatura", "serie", "numero",
  "contrato_vinculado", "proposta_vinculada", "categoria", "centro_resultado",
  "plano_conta", "conta_entrada", "valor_bruto", "valor_liquido", "desconto", "juros",
  "multa", "abatimento", "recorrente", "recorrencia", "quantidade_parcelas",
  "parcela_atual", "observacoes",
] as const;

function normalizarPayloadRecebivel(input: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const campo of CAMPOS_REAIS_RECEBER) {
    if (input[campo] !== undefined && input[campo] !== null) payload[campo] = input[campo];
  }
  // Compatibilidade com chamadas legadas (mapeamento 1:1 para colunas reais)
  if (payload["quantidade_parcelas"] === undefined && input["total_parcelas"] !== undefined && input["total_parcelas"] !== null) {
    payload["quantidade_parcelas"] = input["total_parcelas"];
  }
  if (payload["parcela_atual"] === undefined && input["parcela"] !== undefined && input["parcela"] !== null) {
    payload["parcela_atual"] = input["parcela"];
  }
  if (payload["observacoes"] === undefined && input["observacao"] !== undefined && input["observacao"] !== null) {
    payload["observacoes"] = input["observacao"];
  }
  return payload;
}

const arredondar2 = (v: number): number => Math.round(v * 100) / 100;

export async function listarRecebiveis(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  cliente_id?: string;
  data_inicio?: string;
  data_fim?: string;
  fatura_id?: string;
  search?: string;
}): Promise<{ data: any[]; total: number }> {
  let query = supabase
    .from("financeiro_receber")
    .select("*", { count: "exact" })
    .eq("is_teste", false);

  if (params.status) query = query.eq("status", params.status);
  if (params.cliente_id) query = query.eq("cliente_id", params.cliente_id);
  if (params.fatura_id) query = query.eq("fatura_id", params.fatura_id);
  if (params.data_inicio) query = query.gte("data_vencimento", params.data_inicio);
  if (params.data_fim) query = query.lte("data_vencimento", params.data_fim);
  if (params.search) {
    query = query.or(`descricao.ilike.%${params.search}%,cliente.ilike.%${params.search}%`);
  }

  const page = params.page || 1;
  const pageSize = params.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order("data_vencimento", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Erro ao listar recebíveis: ${error.message}`);
  return { data: data || [], total: count || 0 };
}

/**
 * TMS-FIN-PROG-05C.3B — Busca o CONJUNTO COMPLETO filtrado (sem paginação),
 * para que busca/filtros/ordenação e TOTAIS ocorram sobre todo o universo
 * (não apenas a página). Mantém PROG-05C.3A: is_teste=false na fonte.
 * Cancelados permanecem retornáveis (a listagem histórica pode exibi-los);
 * a exclusão de cancelados é aplicada apenas nos totais ativos pela tela.
 * `limite` de segurança evita varreduras ilimitadas.
 */
export async function buscarRecebiveisFiltrados(params: {
  cliente_id?: string;
  data_inicio?: string;
  data_fim?: string;
  search?: string;
  categoria?: string;
  centro_resultado?: string;
  limite?: number;
}): Promise<any[]> {
  let query = supabase
    .from("financeiro_receber")
    .select("*")
    .eq("is_teste", false);

  if (params.cliente_id) query = query.eq("cliente_id", params.cliente_id);
  if (params.categoria) query = query.eq("categoria", params.categoria);
  if (params.centro_resultado) query = query.eq("centro_resultado", params.centro_resultado);
  if (params.data_inicio) query = query.gte("data_vencimento", params.data_inicio);
  if (params.data_fim) query = query.lte("data_vencimento", params.data_fim);
  if (params.search) {
    query = query.or(`descricao.ilike.%${params.search}%,cliente.ilike.%${params.search}%`);
  }

  const { data, error } = await query
    .order("data_vencimento", { ascending: true })
    .limit(params.limite || 2000);

  if (error) throw new Error(`Erro ao buscar recebíveis filtrados: ${error.message}`);
  return data || [];
}

const STATUS_PAGO_SEM_BAIXA = ["pago", "recebido", "baixado"];

function validarStatusCriacao(status: string | undefined): string {
  if (status && STATUS_PAGO_SEM_BAIXA.includes(status.toLowerCase())) {
    throw new Error(`Não é permitido criar recebível diretamente com status '${status}'. Use o fluxo oficial de baixa.`);
  }
  return status || "aberto";
}

function validarStatusAtualizacao(statusAtual: string | null, novoStatus: string): void {
  if (!novoStatus) return;
  if (STATUS_PAGO_SEM_BAIXA.includes(novoStatus.toLowerCase())) {
    throw new Error(`Não é permitido alterar status para '${novoStatus}' diretamente. Use o fluxo oficial de baixa (baixarRecebivel).`);
  }
  validarTransicao(statusAtual, novoStatus);
}

/**
 * TMS-FIN-SEC-02-A6 — Gera chave de idempotência para o contrato oficial.
 * Reutilizada pela UI (uma chave por sessão do diálogo / por parcela do lote).
 */
export function gerarChaveIdempotencia(prefixo = "rec"): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `${prefixo}-${uuid}`;
}

function montarPayloadRecebivel(input: RecebivelInput): Record<string, unknown> {
  const valorBruto = Number(input.valor_bruto ?? input.valor ?? 0) || 0;
  const valorLiquido = Number(input.valor_liquido ?? valorBruto) || 0;
  validarValor(valorBruto);
  validarData(input.data_vencimento);

  const payload: Record<string, unknown> = normalizarPayloadRecebivel(input as unknown as Record<string, unknown>);
  payload.valor = arredondar2(valorLiquido);
  payload.valor_bruto = arredondar2(valorBruto);
  payload.valor_liquido = arredondar2(valorLiquido);
  payload.status = validarStatusCriacao(input.status);
  return payload;
}

function extrairResultadoRpc(data: unknown): { recebivel_id?: string; criado?: boolean } {
  return (Array.isArray(data) ? data[0] : data) ?? {};
}

/**
 * TMS-FIN-SEC-02-A6 — Criação manual de recebível SOMENTE via RPC oficial
 * `f_criar_recebivel_manual` (transacional + idempotente). ZERO INSERT direto.
 */
export async function criarRecebivel(input: RecebivelInput): Promise<any> {
  if (!input.cliente_id && !input.cliente) throw new Error("Cliente é obrigatório");
  if (!input.data_vencimento) throw new Error("Vencimento é obrigatório");

  const payload = montarPayloadRecebivel(input);
  const idempotencyKey = input.idempotency_key || gerarChaveIdempotencia("rec");

  const { data, error } = await supabase.rpc("f_criar_recebivel_manual", {
    p_payload: payload,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw new Error(`Erro ao criar recebível: ${error.message}`);

  const resultado = extrairResultadoRpc(data);
  if (!resultado.recebivel_id) throw new Error("Falha ao criar recebível: RPC não retornou ID");
  return resultado;
}

/**
 * TMS-FIN-SEC-02-A6 — Criação em lote via RPC oficial, com idempotência por
 * item (lote-key + índice). Nenhum INSERT direto. Retorna quantos foram criados.
 */
export async function criarRecebiveisEmLote(itens: RecebivelInput[]): Promise<number> {
  if (!itens.length) return 0;
  const loteKey = gerarChaveIdempotencia("lote");
  let criados = 0;

  for (let i = 0; i < itens.length; i++) {
    const input = itens[i];
    if (!input.cliente_id && !input.cliente) throw new Error("Cliente é obrigatório em todos os itens");
    if (!input.data_vencimento) throw new Error("Vencimento é obrigatório em todos os itens");

    const payload = montarPayloadRecebivel(input);
    const idempotencyKey = input.idempotency_key || `${loteKey}-${i + 1}`;

    const { data, error } = await supabase.rpc("f_criar_recebivel_manual", {
      p_payload: payload,
      p_idempotency_key: idempotencyKey,
    });

    if (error) throw new Error(`Erro ao criar recebíveis em lote: ${error.message}`);
    if (extrairResultadoRpc(data).criado) criados += 1;
  }

  return criados;
}

export async function atualizarRecebivel(id: string, update: RecebivelUpdate): Promise<any> {
  if (update.valor !== undefined) validarValor(update.valor);
  if (update.data_vencimento) validarData(update.data_vencimento);

  if (update.status) {
    const { data: atual } = await supabase
      .from("financeiro_receber")
      .select("status")
      .eq("id", id)
      .single();
    if (atual) validarStatusAtualizacao(atual.status, update.status);
  }

  const payload: Record<string, unknown> = normalizarPayloadRecebivel(update as unknown as Record<string, unknown>);

  // Consistência de valores: sempre manter valor/valor_bruto/valor_liquido coerentes
  if (update.valor !== undefined) {
    const v = arredondar2(update.valor);
    payload.valor = v;
    if (payload.valor_bruto === undefined) payload.valor_bruto = v;
    if (payload.valor_liquido === undefined) payload.valor_liquido = v;
  }
  if (update.valor_bruto !== undefined && payload.valor_liquido === undefined) {
    const v = arredondar2(update.valor_bruto);
    payload.valor = v;
    payload.valor_liquido = v;
  }

  if (Object.keys(payload).length === 0) throw new Error("Nenhum campo válido para atualizar");

  const { data, error } = await supabase
    .from("financeiro_receber")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar recebível: ${error.message}`);
  return data;
}

export interface ParamsBaixaRecebivel {
  forma?: string;
  conta?: string;
  contaFinanceiraId?: string;
  referencia?: string;
  observacao?: string;
  usuarioId?: string;
  usuarioNome?: string;
}

export async function baixarRecebivel(
  id: string,
  valorPago: number,
  dataPagamento?: string,
  extras?: ParamsBaixaRecebivel
): Promise<any> {
  validarValor(valorPago);

  const { data: authUser } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc("f_registrar_baixa_financeira", {
    p_titulo_tabela: "financeiro_receber",
    p_titulo_id: id,
    p_valor_baixado: Math.round(valorPago * 100) / 100,
    p_data_baixa: dataPagamento || new Date().toISOString().split("T")[0],
    p_forma_pagamento: extras?.forma || null,
    p_conta_financeira: extras?.conta || null,
    p_conta_financeira_id: extras?.contaFinanceiraId || null,
    p_referencia_bancaria: extras?.referencia || null,
    p_observacao: extras?.observacao || null,
    p_usuario_id: extras?.usuarioId ?? (authUser?.user?.id || null),
    p_usuario_nome: extras?.usuarioNome ?? (authUser?.user?.email || null),
  });

  if (error) throw new Error(`Erro ao baixar recebível: ${error.message}`);

  const resultado = (Array.isArray(data) ? data[0] : data) as { sucesso?: boolean; mensagem?: string } | undefined;
  if (!resultado?.sucesso) throw new Error(resultado?.mensagem || "Falha ao registrar baixa");
  return resultado;
}

export async function cancelarRecebivel(id: string, motivo?: string): Promise<any> {
  const { data: atual } = await supabase
    .from("financeiro_receber")
    .select("status")
    .eq("id", id)
    .single();

  if (!atual) throw new Error("Recebível não encontrado");
  validarTransicao(atual.status, "cancelado");

  const { data, error } = await supabase
    .from("financeiro_receber")
    .update({ status: "cancelado", observacoes: motivo || "Cancelado manualmente" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao cancelar recebível: ${error.message}`);
  return data;
}

export async function excluirRecebivel(id: string): Promise<void> {
  const { data: atual, error: errBusca } = await supabase
    .from("financeiro_receber")
    .select("status, data_pagamento, fatura_id")
    .eq("id", id)
    .single();

  if (errBusca || !atual) throw new Error("Recebível não encontrado");
  if (atual.status === "pago" || atual.status === "parcial") {
    throw new Error("Recebível pago ou com baixa parcial não pode ser excluído");
  }
  if (atual.fatura_id) {
    throw new Error("Recebível vinculado a uma fatura não pode ser excluído");
  }

  const { data: baixa } = await supabase
    .from("financeiro_baixas")
    .select("id")
    .eq("titulo_tabela", "financeiro_receber")
    .eq("titulo_id", id)
    .eq("estornada", false)
    .limit(1)
    .maybeSingle();
  if (baixa) throw new Error("Recebível com baixa registrada não pode ser excluído");

  const { error } = await supabase
    .from("financeiro_receber")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Erro ao excluir recebível: ${error.message}`);
}

export async function renegociarRecebivel(
  id: string,
  novosValores: { valor?: number; data_vencimento?: string; observacao?: string; observacoes?: string }
): Promise<any> {
  if (novosValores.valor !== undefined) validarValor(novosValores.valor);
  if (novosValores.data_vencimento) validarData(novosValores.data_vencimento);

  const { data: atual } = await supabase
    .from("financeiro_receber")
    .select("status")
    .eq("id", id)
    .single();

  if (!atual) throw new Error("Recebível não encontrado");
  validarTransicao(atual.status, "renegociado");

  const update: any = { status: "renegociado" };
  if (novosValores.valor !== undefined) update.valor = arredondar2(novosValores.valor);
  if (novosValores.data_vencimento) update.data_vencimento = novosValores.data_vencimento;
  const obs = novosValores.observacoes ?? novosValores.observacao;
  if (obs) update.observacoes = obs;

  const { data, error } = await supabase
    .from("financeiro_receber")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao renegociar recebível: ${error.message}`);
  return data;
}

export async function buscarClientesLista(): Promise<any[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, razao_social, nome_fantasia, cnpj, status")
    .order("razao_social");
  if (error) throw new Error(`Erro ao buscar clientes: ${error.message}`);
  return data || [];
}

export async function verificarDuplicataEscala(alocacaoId: string): Promise<boolean> {
  const { data: aloc } = await supabase
    .from("alocacoes_escala")
    .select("ordem_servico_id")
    .eq("id", alocacaoId)
    .maybeSingle();
  if (!aloc?.ordem_servico_id) return false;
  const { data } = await supabase
    .from("financeiro_receber")
    .select("id")
    .eq("os_id", aloc.ordem_servico_id)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function buscarEscalaFaturamento(params: {
  cliente_id?: string;
  data_inicio?: string;
  data_fim?: string;
}): Promise<any[]> {
  let query = supabase
    .from("alocacoes_escala")
    .select(`*, clientes:cliente_id(id, nome_fantasia), ordens_servico:ordem_servico_id(id, numero)`);

  if (params.cliente_id) query = query.eq("cliente_id", params.cliente_id);
  if (params.data_inicio) query = query.gte("data_escala", params.data_inicio);
  if (params.data_fim) query = query.lte("data_escala", params.data_fim);

  const { data, error } = await query.order("data_escala", { ascending: false });
  if (error) throw new Error(`Erro ao buscar programação faturamento: ${error.message}`);
  return data || [];
}

export async function listarItensFaturaveis(params: {
  cliente_id?: string;
  data_inicio?: string;
  data_fim?: string;
}): Promise<{ escalas: any[]; ordensServico: any[]; manuais: any[] }> {
  const [escalasRes, ossRes, manuaisRes] = await Promise.all([
    supabase
      .from("alocacoes_escala")
      .select(`id, data_escala, valor_frete, cliente_id, cliente_nome, origem, destino, placa`)
      .eq("status", "concluida")
      .gte("data_escala", params.data_inicio || "2000-01-01")
      .lte("data_escala", params.data_fim || "2099-12-31"),
    supabase
      .from("ordens_servico")
      .select(`id, numero, status, created_at, cliente, valor_cliente, origem, destino`)
      .eq("status", "finalizada")
      .gte("created_at", params.data_inicio || "2000-01-01")
      .lte("created_at", params.data_fim || "2099-12-31"),
    supabase
      .from("financeiro_receber")
      .select(`*`)
      .is("fatura_id", null)
      .eq("origem", "manual"),
  ]);

  return {
    escalas: escalasRes.data || [],
    ordensServico: ossRes.data || [],
    manuais: manuaisRes.data || [],
  };
}

export async function criarRecebivelDeEscala(item: {
  clienteId: string;
  clienteNome: string;
  os?: string;
  alocacaoId: string;
  valorFrete: number;
  data?: string;
}): Promise<any> {
  // F0-D — fluxo legado descontinuado. Faturamento oficial: Financeiro > Conferência.
  throw new Error("Fluxo legado descontinuado (F0-D). Utilize Financeiro > Conferência para faturar serviços da programação.");
}

export async function verificarDuplicatasEmLote(alocacaoIds: string[]): Promise<Set<string>> {
  if (!alocacaoIds.length) return new Set();
  const { data: alocs } = await supabase
    .from("alocacoes_escala")
    .select("id, ordem_servico_id")
    .in("id", alocacaoIds);
  const osIds = (alocs || []).map(a => a.ordem_servico_id).filter(Boolean) as string[];
  if (!osIds.length) return new Set();
  const { data } = await supabase
    .from("financeiro_receber")
    .select("os_id")
    .in("os_id", osIds);
  const osIdsFaturados = new Set((data || []).map((r: any) => r.os_id).filter(Boolean));
  return new Set((alocs || []).filter(a => a.ordem_servico_id && osIdsFaturados.has(a.ordem_servico_id)).map(a => a.id));
}

export async function criarRecebiveisEscalaEmLote(itens: {
  clienteId: string;
  clienteNome: string;
  os?: string;
  alocacaoId: string;
  valorFrete: number;
  data?: string;
}[]): Promise<{ gerados: number; erros: number }> {
  // F0-D — fluxo legado descontinuado. Faturamento oficial: Financeiro > Conferência.
  throw new Error("Fluxo legado descontinuado (F0-D). Utilize Financeiro > Conferência para faturar serviços da programação.");
}

export interface FaturaWizardItem {
  id: string;
  data: string;
  origem: string;
  origemId: string;
  os: string;
  clienteNome: string;
  descricao: string;
  valor: number;
  status: string;
  apto: boolean;
  bloqueio: string | null;
  tipo: string;
  prestador: string;
  veiculo: string;
}

export async function buscarItensFaturaveisWizard(params: {
  clienteId: string;
  dataInicio?: string;
  dataFim?: string;
  origemFiltro?: string;
  recebiveisExistentes?: { origem: string; origemId: string }[];
}): Promise<FaturaWizardItem[]> {
  const { clienteId, dataInicio, dataFim, origemFiltro, recebiveisExistentes } = params;
  const itens: FaturaWizardItem[] = [];

  const isFaturado = (origem: string, origemId: string): boolean => {
    return (recebiveisExistentes || []).some(
      r => r.origem === origem && r.origemId === origemId
    );
  };

  if (!origemFiltro || origemFiltro === "todas" || origemFiltro === "escala") {
    let qEscala = supabase
      .from("alocacoes_escala")
      .select(`*, clientes:cliente_id(id, nome_fantasia, razao_social, cnpj), ordens_servico:ordem_servico_id(id, numero)`)
      .eq("cliente_id", clienteId);
    if (dataInicio) qEscala = qEscala.gte("data_escala", dataInicio);
    if (dataFim) qEscala = qEscala.lte("data_escala", dataFim);
    const { data: escala } = await qEscala.order("data_escala", { ascending: false });

    if (escala) {
      for (const a of escala) {
        const prestNome = (a as any).clientes?.nome_fantasia || (a as any).clientes?.razao_social || "";
        const existente = isFaturado("escala_operacional", a.id);
        itens.push({
          id: `escala_${a.id}`,
          data: a.data_escala || "",
          origem: "Programação",
          origemId: a.id,
          os: (a as any).ordens_servico?.numero || "",
          clienteNome: prestNome,
          descricao: `Programação ${(a as any).ordens_servico?.numero || a.id}`,
          valor: Number(a.valor_frete || 0),
          status: a.status || "",
          apto: !!a.cliente_id && Number(a.valor_frete || 0) > 0 && !existente,
          bloqueio: !a.cliente_id ? "Sem cliente" : Number(a.valor_frete || 0) <= 0 ? "Valor inválido" : existente ? "Já faturado" : null,
          tipo: "escala",
          prestador: a.prestador_id || "",
          veiculo: a.placa || "",
        });
      }
    }
  }

  if (!origemFiltro || origemFiltro === "todas" || origemFiltro === "os") {
    let qOS = supabase
      .from("ordens_servico")
      .select("*, clientes:cliente_id(id, nome_fantasia, razao_social, cnpj)")
      .eq("cliente_id", clienteId);
    if (dataInicio) qOS = qOS.gte("data_os", dataInicio);
    if (dataFim) qOS = qOS.lte("data_os", dataFim);
    const { data: oss } = await qOS.order("data_os", { ascending: false });

    if (oss) {
      for (const os of oss) {
        const existente = isFaturado("ordem_servico", os.id);
        const cliNome = (os as any).clientes?.nome_fantasia || (os as any).clientes?.razao_social || "";
        const valorOS = Number(os.valor_total) || Number(os.valor_cliente) || 0;
        itens.push({
          id: `os_${os.id}`,
          data: os.data_os || os.created_at?.split("T")[0] || "",
          origem: "OS",
          origemId: os.id,
          os: os.numero || os.id,
          clienteNome: cliNome,
          descricao: `OS ${os.numero || os.id}`,
          valor: valorOS,
          status: os.status || "",
          apto: !!clienteId && valorOS > 0 && !existente,
          bloqueio: !clienteId ? "Sem cliente" : valorOS <= 0 ? "Valor inválido" : existente ? "Já faturado" : null,
          tipo: "os",
          prestador: "",
          veiculo: "",
        });
      }
    }
  }

  if (!origemFiltro || origemFiltro === "todas" || origemFiltro === "manual") {
    let qManual = supabase
      .from("financeiro_receber")
      .select("*")
      .eq("cliente_id", clienteId)
      .eq("origem", "manual")
      .is("fatura_id", null);
    if (dataInicio) qManual = qManual.gte("data_emissao", dataInicio);
    if (dataFim) qManual = qManual.lte("data_emissao", dataFim);
    const { data: manuais } = await qManual;

    if (manuais) {
      for (const r of manuais) {
        const valorManual = Number(r.valor_bruto) || Number(r.valor_liquido) || 0;
        itens.push({
          id: `manual_${r.id}`,
          data: r.data_emissao || r.created_at?.split("T")[0] || "",
          origem: "Manual",
          origemId: r.id,
          os: r.os_vinculadas || "",
          clienteNome: r.cliente_nome || "",
          descricao: r.fatura || r.observacoes || `Recebível ${r.id}`,
          valor: valorManual,
          status: r.status || "",
          apto: !!r.cliente_id && valorManual > 0,
          bloqueio: !r.cliente_id ? "Sem cliente" : valorManual <= 0 ? "Valor inválido" : null,
          tipo: "manual",
          prestador: "",
          veiculo: "",
        });
      }
    }
  }

  return itens;
}

export async function criarFaturaConsolidadaCompleta(params: {
  clienteId: string;
  clienteNome: string;
  clienteCnpj?: string;
  dataVencimento: string;
  competencia: string;
  dataInicio?: string;
  dataFim?: string;
  desconto: number;
  selecionados: {
    tipo: string;
    origemId: string;
    os?: string;
    data?: string;
    valor: number;
    clienteNome?: string;
    clienteId?: string;
  }[];
}): Promise<{ faturaId: string; numeroFatura: string }> {
  // F0-D — fluxo legado descontinuado. Faturamento oficial: Financeiro > Conferência.
  throw new Error("Fluxo legado descontinuado (F0-D). Utilize Financeiro > Conferência para faturar serviços da programação.");
}

export async function buscarDetalheFatura(faturaId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("financeiro_receber")
    .select("*")
    .eq("fatura_id", faturaId);

  if (error) throw new Error(`Erro ao buscar detalhe da fatura: ${error.message}`);
  return (data || []).map((i: any) => ({
    id: i.id,
    documento: i.fatura || "",
    origem: i.origem || "",
    os: i.os_vinculadas || "",
    descricao: i.observacoes || "",
    valor: Number(i.valor_bruto) || Number(i.valor_liquido) || 0,
    status: i.status || "",
  }));
}

export async function criarFaturaConsolidada(params: {
  cliente: string;
  cliente_id?: string;
  data_vencimento: string;
  itens: { tabela: string; id: string; valor: number; descricao: string }[];
}): Promise<{ faturaId: string }> {
  // F0-D — fluxo legado descontinuado. Faturamento oficial: Financeiro > Conferência.
  throw new Error("Fluxo legado descontinuado (F0-D). Utilize Financeiro > Conferência para faturar serviços da programação.");
}

/* ============================================================
 * MISSÃO A23 — FASE D — Capacidade de POD no faturamento
 * (preparação — NÃO implanta bloqueio definitivo)
 * Fonte oficial: entregas_protocolo
 * ============================================================ */

/**
 * Função pura — indica se o item de faturamento possui POD (usando
 * entregas_protocolo). `pod` é a linha do POD ou null.
 * NÃO bloqueia faturamento — apenas informa para alerta visual.
 */
export function podExisteParaFaturamento(pod: unknown): boolean {
  return !!pod;
}

export interface SituacaoPODFaturamento {
  alocacaoId: string;
  possuiPod: boolean;
  situacao: "completo" | "parcial" | "entregue_ressalva" | "nao_entregue" | "pendente";
  podId: string | null;
}

/**
 * Consulta read-only — retorna a situação do POD de uma alocação
 * (entregas_protocolo) para alerta visual antes do faturamento.
 */
export async function verificarPODParaFaturamento(alocacaoId: string): Promise<SituacaoPODFaturamento> {
  const fallback: SituacaoPODFaturamento = {
    alocacaoId,
    possuiPod: false,
    situacao: "pendente",
    podId: null,
  };
  if (!alocacaoId) return fallback;
  try {
    const { data, error } = await supabase
      .from("entregas_protocolo")
      .select("id, status, foto_entrega_url, foto_canhoto_url, assinatura_url, nome_recebedor")
      .eq("alocacao_id", alocacaoId)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[receberService] Erro ao verificar POD p/ faturamento:", error.message);
      return fallback;
    }
    if (!data) return fallback;

    const situacao =
      data.status === "nao_entregue" ? "nao_entregue"
      : data.status === "entregue_ressalva" || data.status === "entregue_com_ressalva" ? "entregue_ressalva"
      : (data.foto_entrega_url || data.foto_canhoto_url) && data.assinatura_url && data.nome_recebedor ? "completo"
      : "parcial";

    return { alocacaoId, possuiPod: true, situacao, podId: data.id || null };
  } catch (e) {
    console.error("[receberService] Exceção ao verificar POD p/ faturamento:", e);
    return fallback;
  }
}
