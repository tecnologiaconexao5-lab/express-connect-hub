// ═══════════════════════════════════════════════════════════════════════════════
// FASE 2A — FUNDAÇÃO PROFISSIONAL DO FATURAMENTO
// faturaService.ts — Service oficial de Fatura
//
// Responsabilidades:
//   • criar rascunho / listar / buscar por id (com itens)
//   • adicionar / remover item (snapshot financeiro do cliente)
//   • recalcular total (o banco recalcula via trigger; aqui espelha o cálculo)
//   • atualizar vencimento/observação/status de aprovação
//   • emitir (RPC transacional f_emitir_fatura → gera número + Conta a Receber)
//   • cancelar (RPC transacional f_cancelar_fatura → libera serviços)
//   • verificar se OS já está faturada em fatura ativa
//   • gerar observação automática de romaneios
//
// Regras críticas (garantidas também no banco):
//   • snapshot imutável após emissão (trigger bloqueia itens de fatura emitida)
//   • mesmo serviço não pode entrar em duas faturas válidas (trigger anti-duplicidade)
//   • valores do PRESTADOR nunca entram na fatura (fatura é cobrança do cliente)
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";
import {
  type Fatura,
  type FaturaItem,
  type FaturaComItens,
  type CriarFaturaInput,
  type AdicionarItemFaturaInput,
  type ModeloFatura,
} from "./faturaTypes";
import {
  buscarRegrasFinanceirasCliente,
  calcularVencimentoPorRegra,
  type ContaBancariaFinanceira,
} from "./configFinanceiraService";
import type { PdfFaturaInput } from "@/utils/pdfFatura";

export type { Fatura, FaturaItem, FaturaComItens, FaturaStatus, ModeloFatura, CriarFaturaInput, AdicionarItemFaturaInput } from "./faturaTypes";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function mapFatura(row: Record<string, unknown>): Fatura {
  const metadata = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    numero: row.numero || null,
    numero_cliente: row.numero_cliente != null ? Number(row.numero_cliente) : null,
    cliente_id: row.cliente_id || null,
    modelo: ((row.modelo as ModeloFatura) || (metadata.modelo as ModeloFatura) || "conexao_express"),
    descricao: (row.descricao as string) || (metadata.descricao as string) || null,
    data_emissao: row.data_emissao || new Date().toISOString().split("T")[0],
    competencia_inicio: row.competencia_inicio || null,
    competencia_fim: row.competencia_fim || null,
    vencimento: row.vencimento || null,
    valor_bruto: num(row.valor_bruto),
    descontos: num(row.descontos),
    acrescimos: num(row.acrescimos),
    valor_total: num(row.valor_total),
    status: row.status || "rascunho",
    observacao: row.observacao || null,
    observacao_fiscal: row.observacao_fiscal || null,
    conta_receber_id: row.conta_receber_id || null,
    criado_por: row.criado_por || null,
    criado_em: row.criado_em || new Date().toISOString(),
    atualizado_por: row.atualizado_por || null,
    atualizado_em: row.atualizado_em || new Date().toISOString(),
    cancelado_em: row.cancelado_em || null,
    cancelado_por: row.cancelado_por || null,
    motivo_cancelamento: row.motivo_cancelamento || null,
    metadata: (row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
  };
}

function mapFaturaItem(row: Record<string, unknown>): FaturaItem {
  return {
    id: row.id,
    fatura_id: row.fatura_id,
    os_id: row.os_id || null,
    alocacao_id: row.alocacao_id || null,
    cliente_id: row.cliente_id || null,
    romaneio: row.romaneio || null,
    descricao: row.descricao || null,
    data_servico: row.data_servico || null,
    valor_base: num(row.valor_base),
    valor_adicionais: num(row.valor_adicionais),
    valor_descontos: num(row.valor_descontos),
    valor_total: num(row.valor_total),
    km_excedente: num(row.km_excedente),
    pedagio_cliente: num(row.pedagio_cliente),
    ajudante_cliente: num(row.ajudante_cliente),
    diaria_cliente: num(row.diaria_cliente),
    saidas_adicionais_cliente: num(row.saidas_adicionais_cliente),
    status: row.status || "ativo",
    criado_por: row.criado_por || null,
    criado_em: row.criado_em || new Date().toISOString(),
    atualizado_em: row.atualizado_em || new Date().toISOString(),
  };
}

/** Calcula o valor total de um item a partir dos componentes do cliente. */
export function calcularTotalItem(item: Pick<AdicionarItemFaturaInput, "valor_base" | "valor_adicionais" | "valor_descontos" | "km_excedente">): number {
  const base = num(item.valor_base);
  const kmExcedente = num(item.km_excedente);
  const adicionais = num(item.valor_adicionais);
  const descontos = num(item.valor_descontos);
  return Math.max(0, base + kmExcedente + adicionais - descontos);
}

/**
 * Observação automática: "Referente aos romaneios nº X, Y e Z."
 * Regras: ignora vazios, não repete, mantém ordem dos itens.
 */
export function montarObservacaoRomaneios(romaneios: Array<string | null | undefined>): string {
  const vistos = new Set<string>();
  const unicos: string[] = [];
  for (const r of romaneios) {
    const val = (r || "").trim();
    if (val && !vistos.has(val)) {
      vistos.add(val);
      unicos.push(val);
    }
  }
  if (unicos.length === 0) return "";
  if (unicos.length === 1) return `Referente ao romaneio nº ${unicos[0]}.`;
  const todosMenosUltimo = unicos.slice(0, -1).join(", ");
  return `Referente aos romaneios nº ${todosMenosUltimo} e ${unicos[unicos.length - 1]}.`;
}

/**
 * Descrição automática no estilo CALVO.
 * Consolida as referências externas (romaneio/OC do cliente) em uma frase única,
 * sem adicionar prestador, motorista, placa, origem/destino, OS interna ou
 * identificadores técnicos. Exemplo:
 *   "Receita de CT-e referente aos romaneios nº 343241, 343216, 343198, ... e serviços de devolução."
 */
export function montarDescricaoCalvo(
  itens: Array<{ romaneio?: string | null }>,
  opts: { semCobranca?: string[]; temDevolucao?: boolean } = {}
): string {
  const vistos = new Set<string>();
  const romaneios: string[] = [];
  for (const i of itens) {
    const val = (i.romaneio || "").trim();
    if (val && !vistos.has(val)) {
      vistos.add(val);
      romaneios.push(val);
    }
  }
  const semCobranca = (opts.semCobranca || []).filter((r) => r && !vistos.has(r));
  semCobranca.forEach((r) => {
    if (!vistos.has(r)) {
      vistos.add(r);
      romaneios.push(`${r} (sem cobrança)`);
    }
  });

  if (romaneios.length === 0) {
    return opts.temDevolucao ? "Receita referente a serviços de devolução." : "";
  }

  const lista = romaneios.length === 1 ? romaneios[0] : `${romaneios.slice(0, -1).join(", ")} e ${romaneios[romaneios.length - 1]}`;
  const devolucao = opts.temDevolucao ? " e serviços de devolução" : "";
  return `Receita de CT-e referente aos romaneios nº ${lista}${devolucao}.`;
}

/**
 * Sugere o modelo de fatura a partir da REGRA DO CLIENTE (configuração explícita).
 * A31: NÃO depende mais do nome "Calvo". Se o cliente não tiver regra configurada,
 * usa o padrão "conexao_express".
 */
export async function sugerirModeloFaturaParaCliente(clienteId: string, _razaoSocial?: string | null, _cnpj?: string | null): Promise<ModeloFatura> {
  if (!clienteId) return "conexao_express";
  const regras = await buscarRegrasFinanceirasCliente(clienteId);
  return regras.modeloFaturaPadrao || "conexao_express";
}

/** [DEPRECADO — A31] Sugestão por nome mantida apenas para compatibilidade de testes antigos. */
export function sugerirModeloFatura(razaoSocialCliente: string | null | undefined, cnpj?: string | null): ModeloFatura {
  const nome = (razaoSocialCliente || "").toLowerCase();
  if (nome.includes("calvo")) return "calvo";
  return "conexao_express";
}

/** Vencimento sugerido: regra atual = data de emissão + prazo (padrão 30 dias). */
export function sugerirVencimento(dataEmissao?: string, dias?: number | null): string {
  const base = dataEmissao || new Date().toISOString().split("T")[0];
  const prazo = (dias && dias > 0) ? dias : 30;
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + prazo);
  return d.toISOString().split("T")[0];
}

/**
 * Sugere o vencimento a partir da REGRA do cliente (A31):
 * prioridade: regra do cliente (prazo/dia fixo) → vencimento_padrao → emissão+30.
 */
export async function sugerirVencimentoParaCliente(clienteId: string, dataEmissao?: string): Promise<string> {
  if (clienteId) {
    const regras = await buscarRegrasFinanceirasCliente(clienteId);
    if (regras.prazoPagamentoDias || regras.diaFixo) {
      return calcularVencimentoPorRegra({
        dataEmissao,
        prazoDias: regras.prazoPagamentoDias,
        diaFixo: regras.diaFixo,
      });
    }
  }
  return sugerirVencimento(dataEmissao, 30);
}

/** Cria um rascunho de Fatura. */
export async function criarRascunhoFatura(input: CriarFaturaInput): Promise<{ success: boolean; fatura?: Fatura; error?: string }> {
  if (!input.cliente_id) return { success: false, error: "Cliente é obrigatório" };
  try {
    const payload: Record<string, unknown> = {
      cliente_id: input.cliente_id,
      data_emissao: input.data_emissao || new Date().toISOString().split("T")[0],
      status: "rascunho",
      metadata: { modelo: input.modelo || "conexao_express", descricao: input.descricao || "" },
    };
    if (input.competencia_inicio) payload.competencia_inicio = input.competencia_inicio;
    if (input.competencia_fim) payload.competencia_fim = input.competencia_fim;
    if (input.vencimento) payload.vencimento = input.vencimento;
    if (input.observacao) payload.observacao = input.observacao;
    if (input.observacao_fiscal) payload.observacao_fiscal = input.observacao_fiscal;

    const { data, error } = await supabase.from("faturas").insert([payload]).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, fatura: mapFatura(data) };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao criar fatura" };
  }
}

/** Lista faturas (opcional filtro por cliente/status). */
export async function listarFaturas(params: { cliente_id?: string; status?: string; limit?: number } = {}): Promise<Fatura[]> {
  try {
    let q = supabase.from("faturas").select("*");
    if (params.cliente_id) q = q.eq("cliente_id", params.cliente_id);
    if (params.status) q = q.eq("status", params.status);
    const { data, error } = await q.order("criado_em", { ascending: false }).limit(params.limit || 100);
    if (error) return [];
    return (data || []).map(mapFatura);
  } catch {
    return [];
  }
}

/** Busca fatura por id com seus itens. */
export async function buscarFaturaComItens(faturaId: string): Promise<FaturaComItens | null> {
  try {
    const { data, error } = await supabase.from("faturas").select("*").eq("id", faturaId).single();
    if (error || !data) return null;
    const itens = await listarItensFatura(faturaId);
    return { ...mapFatura(data), itens };
  } catch {
    return null;
  }
}

/** Lista os itens de uma fatura. */
export async function listarItensFatura(faturaId: string): Promise<FaturaItem[]> {
  try {
    const { data, error } = await supabase
      .from("fatura_itens")
      .select("*")
      .eq("fatura_id", faturaId)
      .order("criado_em", { ascending: true });
    if (error) return [];
    return (data || []).map(mapFaturaItem);
  } catch {
    return [];
  }
}

/** Adiciona item à fatura (valida anti-duplicidade; banco também protege). */
export async function adicionarItemFatura(input: AdicionarItemFaturaInput): Promise<{ success: boolean; item?: FaturaItem; error?: string }> {
  if (!input.fatura_id) return { success: false, error: "Fatura é obrigatória" };
  const valorTotal = calcularTotalItem(input);
  try {
    const payload = {
      fatura_id: input.fatura_id,
      os_id: input.os_id || null,
      alocacao_id: input.alocacao_id || null,
      cliente_id: input.cliente_id || null,
      romaneio: input.romaneio || null,
      descricao: input.descricao || null,
      data_servico: input.data_servico || null,
      valor_base: num(input.valor_base),
      valor_adicionais: num(input.valor_adicionais),
      valor_descontos: num(input.valor_descontos),
      valor_total: valorTotal,
      km_excedente: num(input.km_excedente),
      pedagio_cliente: num(input.pedagio_cliente),
      ajudante_cliente: num(input.ajudante_cliente),
      diaria_cliente: num(input.diaria_cliente),
      saidas_adicionais_cliente: num(input.saidas_adicionais_cliente),
    };
    const { data, error } = await supabase.from("fatura_itens").insert([payload]).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, item: mapFaturaItem(data) };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao adicionar item" };
  }
}

/** Remove item (apenas fatura em rascunho — banco bloqueia emitida). */
export async function removerItemFatura(itemId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("fatura_itens").delete().eq("id", itemId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao remover item" };
  }
}

/** Atualiza campos editáveis da fatura em rascunho. */
export async function atualizarFatura(
  faturaId: string,
  // TMS-FIN-PROG-04B — "status" REMOVIDO de propósito: a transição para 'emitida'
  // só pode ocorrer via RPC f_emitir_fatura (único caminho autorizado).
  updates: Partial<Pick<Fatura, "vencimento" | "observacao" | "observacao_fiscal" | "competencia_inicio" | "competencia_fim" | "modelo" | "descricao" | "data_emissao">>
): Promise<{ success: boolean; fatura?: Fatura; error?: string }> {
  try {
    // Busca metadata atual para mesclar modelo/descricao (sem colunas novas)
    const { data: atual } = await supabase.from("faturas").select("metadata").eq("id", faturaId).maybeSingle();
    const metadataBase = (atual?.metadata && typeof atual.metadata === "object" ? atual.metadata : {}) as Record<string, unknown>;

    // FIN-01.1 BUG-1 FIX: modelo e descricao NÃO existem como colunas em faturas.
    // Extrair antes de spreadar no payload SQL para evitar:
    //   ERROR: column "descricao" of relation "faturas" does not exist
    const { modelo: _modeloUpd, descricao: _descricaoUpd, ...sqlUpdates } = updates;
    const payload: Record<string, unknown> = {
      ...sqlUpdates,
      atualizado_em: new Date().toISOString(),
    };

    // Sempre mesclar modelo/descricao em metadata (nunca em coluna SQL)
    if (_modeloUpd !== undefined || _descricaoUpd !== undefined) {
      payload.metadata = {
        ...metadataBase,
        modelo: _modeloUpd ?? (metadataBase.modelo as string) ?? "conexao_express",
        descricao: _descricaoUpd ?? (metadataBase.descricao as string) ?? "",
      };
    }
    const { data, error } = await supabase.from("faturas").update(payload).eq("id", faturaId).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, fatura: mapFatura(data) };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao atualizar fatura" };
  }
}

/** Emite a fatura via RPC transacional (gera número + Conta a Receber). */
export async function emitirFatura(faturaId: string): Promise<{ success: boolean; numero?: string; numeroCliente?: number; contaReceberId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("f_emitir_fatura", { p_fatura_id: faturaId });
    if (error) return { success: false, error: error.message };
    const r = data as { success?: boolean; error?: string; numero?: string; numero_cliente?: number; conta_receber_id?: string; valor_total?: number; vencimento?: string };
    if (!r || r.success !== true) return { success: false, error: r?.error || "Falha ao emitir fatura" };
    return { success: true, numero: r.numero, numeroCliente: r.numero_cliente, contaReceberId: r.conta_receber_id };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao emitir fatura" };
  }
}

/** Cancela a fatura via RPC transacional (libera serviços + cancela título). */
export async function cancelarFatura(faturaId: string, motivo?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("f_cancelar_fatura", { p_fatura_id: faturaId, p_motivo: motivo || null });
    if (error) return { success: false, error: error.message };
    const r = data as { success?: boolean; error?: string };
    if (!r || r.success !== true) return { success: false, error: r?.error || "Falha ao cancelar fatura" };
    return { success: true };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao cancelar fatura" };
  }
}

// ── TMS-FAT-URG-02 — Validação/autorização da fatura (pré-emissão) ──────────
export type FaturaStatusPreEmissao = "rascunho" | "aguardando_aprovacao" | "aprovada";

export interface MoverStatusFaturaResultado {
  success: boolean;
  status?: string;
  statusAnterior?: string;
  idempotente?: boolean;
  error?: string;
}

/**
 * Move o status PRÉ-EMISSÃO da fatura via RPC oficial `f_mover_fatura_status`.
 * REGRA: validar/aprovar NÃO é receber — NÃO cria financeiro_receber.
 * Transições permitidas no banco:
 *   rascunho -> aguardando_aprovacao; aguardando_aprovacao -> aprovada;
 *   aguardando_aprovacao -> rascunho (devolver).
 */
export async function moverStatusFatura(
  faturaId: string,
  novoStatus: FaturaStatusPreEmissao
): Promise<MoverStatusFaturaResultado> {
  if (!faturaId) return { success: false, error: "Fatura é obrigatória" };
  if (!["rascunho", "aguardando_aprovacao", "aprovada"].includes(novoStatus)) {
    return { success: false, error: "Status inválido" };
  }
  try {
    const { data, error } = await supabase.rpc("f_mover_fatura_status", {
      p_fatura_id: faturaId,
      p_novo_status: novoStatus,
    });
    if (error) return { success: false, error: error.message };
    const r = data as { success?: boolean; error?: string; status?: string; status_anterior?: string; idempotente?: boolean };
    if (!r || r.success !== true) return { success: false, error: r?.error || "Falha ao mover status da fatura" };
    return { success: true, status: r.status, statusAnterior: r.status_anterior, idempotente: !!r.idempotente };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao mover status da fatura" };
  }
}

/** Envia o rascunho para validação/aprovação (NÃO emite, NÃO cria AR). */
export function enviarFaturaParaValidacao(faturaId: string): Promise<MoverStatusFaturaResultado> {
  return moverStatusFatura(faturaId, "aguardando_aprovacao");
}

/** Aprova a fatura (NÃO emite, NÃO cria AR). */
export function aprovarFatura(faturaId: string): Promise<MoverStatusFaturaResultado> {
  return moverStatusFatura(faturaId, "aprovada");
}

/** Devolve a fatura em validação para rascunho (reabre edição). */
export function devolverFaturaParaRascunho(faturaId: string): Promise<MoverStatusFaturaResultado> {
  return moverStatusFatura(faturaId, "rascunho");
}

interface FaturaItemComJoin {
  fatura_id: string;
  faturas?: { id: string; numero: string | null; status: string } | null;
}

/** Verifica se um serviço está bloqueado para faturamento por Romaneio/OC obrigatório do cliente. */
export async function verificarRomaneioObrigatorioBloqueio(clienteId: string | null, romaneioOC: string | null): Promise<{
  bloqueado: boolean;
  motivo: string | null;
  exige: boolean;
}> {
  if (!clienteId) return { bloqueado: false, motivo: null, exige: false };
  const regras = await buscarRegrasFinanceirasCliente(clienteId);
  if (regras.exigeRomaneioOC && !romaneioOC) {
    return {
      bloqueado: true,
      motivo: "Bloqueado para faturamento — Romaneio/OC obrigatório para este cliente.",
      exige: true,
    };
  }
  return { bloqueado: false, motivo: null, exige: regras.exigeRomaneioOC };
}

/** Verifica se uma OS já está faturada em fatura ativa (não cancelada). */
export async function verificarOSFaturada(osId: string): Promise<{ faturada: boolean; faturaId?: string; numero?: string }> {
  if (!osId) return { faturada: false };
  try {
    const { data, error } = await supabase
      .from("fatura_itens")
      .select("fatura_id, faturas!inner(id, numero, status)")
      .eq("os_id", osId)
      .eq("status", "ativo")
      .limit(10);
    if (error) return { faturada: false };
    const ativa = ((data || []) as FaturaItemComJoin[]).find((i) => i.faturas?.status !== "cancelada");
    if (!ativa) return { faturada: false };
    return { faturada: true, faturaId: ativa.fatura_id, numero: ativa.faturas?.numero || undefined };
  } catch {
    return { faturada: false };
  }
}

/** Consulta o status de faturamento de uma OS (para a Central Financeira). */
export async function obterStatusFaturamentoOS(osId: string): Promise<{ status: "nao_faturado" | "rascunho" | "faturado"; numero?: string; faturaId?: string }> {  if (!osId) return { status: "nao_faturado" };
  try {
    const { data, error } = await supabase
      .from("fatura_itens")
      .select("fatura_id, faturas!inner(id, numero, status)")
      .eq("os_id", osId)
      .limit(10);
    if (error) return { status: "nao_faturado" };
    const itens = (data || []) as FaturaItemComJoin[];
    if (itens.length === 0) return { status: "nao_faturado" };
    const emitida = itens.find((i) => i.faturas?.status === "emitida");
    if (emitida) return { status: "faturado", numero: emitida.faturas?.numero, faturaId: emitida.fatura_id };
    const rascunho = itens.find((i) => i.faturas?.status === "rascunho" || i.faturas?.status === "aguardando_aprovacao" || i.faturas?.status === "aprovada");
    if (rascunho) return { status: "rascunho", numero: rascunho.faturas?.numero, faturaId: rascunho.fatura_id };
    return { status: "nao_faturado" };
  } catch {
    return { status: "nao_faturado" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 2B — DADOS PARA PRÉVIA / PDF (empresa + cliente)
// ═══════════════════════════════════════════════════════════════════════════════

export interface DadosEmpresaFatura {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  inscricaoMunicipal: string | null;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  emailFinanceiro: string;
  banco: string;
  agencia: string;
  conta: string;
  pix: string;
  logoPath: string;
}

export interface DadosClienteFatura {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  ie: string | null;
  inscricaoMunicipal: string | null;
  endereco: string;
  cidade: string;
  uf: string;
  /** Prazo de pagamento em dias (clientes.vencimento_padrao) — fonte para sugestão de vencimento. */
  vencimentoPadraoDias: number | null;
  tipoCobranca: string | null;
  tabelaValoresPadraoId: string | null;
  /**
   * F38-MANUAL-3 — endereço COMPLETO para a fatura, montado a partir dos múltiplos
   * endereços do cliente (enderecos_clientes), priorizando cobrança/fiscal → Matriz →
   * primeiro endereço → fallback clientes.endereco. Formato único (logradouro, número,
   * complemento, bairro, CEP, cidade/UF) pronto para o PDF.
   */
  enderecoCompleto?: string | null;
}

/** Endereço estruturado do cliente (tabela enderecos_clientes). */
export interface DadosEnderecoCliente {
  tipo_endereco: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

/**
 * Monta o endereço completo em linha única (sem UUID, sem campos vazios):
 * "Logradouro, 123 - Complemento - Bairro - CEP: 00000-000 - Cidade/UF"
 */
export function montarEnderecoCompleto(end: DadosEnderecoCliente | null | undefined): string {
  if (!end) return "";
  const partes: string[] = [];
  const rua = [String(end.logradouro || "").trim(), String(end.numero || "").trim()].filter(Boolean).join(", ");
  if (rua) partes.push(rua);
  const comp = String(end.complemento || "").trim();
  if (comp) partes.push(comp);
  const bairro = String(end.bairro || "").trim();
  if (bairro) partes.push(bairro);
  const cep = String(end.cep || "").trim();
  if (cep) partes.push(`CEP: ${cep}`);
  const cidade = String(end.cidade || "").trim();
  const uf = String(end.uf || "").trim();
  if (cidade) partes.push(uf ? `${cidade}/${uf}` : cidade);
  else if (uf) partes.push(uf);
  return partes.join(" - ");
}

/**
 * F38-MANUAL-3 — busca o endereço do cliente mais adequado para a fatura.
 * Regra (sem inventar campo/schema):
 *   1. endereço de cobrança/fiscal, se houver conceito (tipo_endereco cobran/fiscal);
 *   2. endereço Matriz/principal (tipo_endereco matriz/principal);
 *   3. primeiro endereço cadastrado (enderecos_clientes).
 * Retorna null se não houver endereço em enderecos_clientes (fallback do cliente).
 */
export async function buscarEnderecoPrincipalCliente(clienteId: string): Promise<DadosEnderecoCliente | null> {
  if (!clienteId) return null;
  try {
    const { data, error } = await supabase
      .from("enderecos_clientes")
      .select("*")
      .eq("cliente_id", clienteId)
      .limit(100);
    if (error || !data || data.length === 0) return null;
    const map = (r: Record<string, unknown>): DadosEnderecoCliente => ({
      tipo_endereco: String(r.tipo_endereco || "").trim(),
      logradouro: String(r.logradouro || "").trim(),
      numero: String(r.numero || "").trim(),
      complemento: String(r.complemento || "").trim(),
      bairro: String(r.bairro || "").trim(),
      cidade: String(r.cidade || "").trim(),
      uf: String(r.uf || "").trim(),
      cep: String(r.cep || "").trim(),
    });
    const lista = (data as Record<string, unknown>[]).map(map);
    const ehCobranca = (t: string) => /cobran|fiscal/i.test(t);
    const ehMatriz = (t: string) => /matriz|principal/i.test(t);
    return (
      lista.find((e) => ehCobranca(e.tipo_endereco))
      || lista.find((e) => ehMatriz(e.tipo_endereco))
      || lista[0]
      || null
    );
  } catch {
    return null;
  }
}

/**
 * Busca os dados da empresa para a Fatura/PDF.
 * Fonte primária: config_financeira_empresa (Config. Financeiras — cadastro
 *   completo preenchido pelo usuário).
 * Fonte bancária: contas_financeiras (contas ativas, principal primeiro).
 * Fallback: configuracoes_fiscais (emitente fiscal) → empresaConfig (hardcoded).
 *
 * CORREÇÃO FIN-CONFIG-PDF-01: antes, esta função lia apenas configuracoes_fiscais
 * e fazia fallback para empresaConfig (CNPJ hardcoded 31.227.975/0001-80). O
 * formulário Config. Financeiras (chave config_financeira_empresa) nunca era lido
 * aqui — causando PDFs com dados desatualizados.
 */
export async function buscarDadosEmpresaParaFatura(): Promise<DadosEmpresaFatura> {
  let razaoSocial = "";
  let nomeFantasia = "";
  let cnpj = "";
  let ie = "";
  let inscricaoMunicipal: string | null = null;
  let endereco = "";
  let cidade = "";
  let uf = "";
  let cep = "";
  let telefone = "";
  let email = "";
  let emailFinanceiro = "";
  let banco = "";
  let agencia = "";
  let conta = "";
  let pix = "";

  // ── FONTE 1: config_financeira_empresa (Config. Financeiras — cadastro completo)
  try {
    const { buscarConfigFinanceiraEmpresa } = await import("@/services/financeiro/configFinanceiraService");
    const cfg = await buscarConfigFinanceiraEmpresa();
    if (cfg) {
      razaoSocial = cfg.razaoSocial || "";
      nomeFantasia = cfg.nomeFantasia || "";
      cnpj = cfg.cnpj || "";
      ie = cfg.ie || "";
      inscricaoMunicipal = cfg.inscricaoMunicipal || null;
      endereco = cfg.endereco || "";
      cidade = cfg.cidade || "";
      uf = cfg.uf || "";
      telefone = cfg.telefone || "";
      email = cfg.email || "";
      emailFinanceiro = cfg.emailFinanceiro || "";
      banco = cfg.banco || "";
      agencia = cfg.agencia || "";
      conta = cfg.conta || "";
      pix = cfg.pix || "";
    }
  } catch {
    // fallback abaixo
  }

  // ── FONTE 2: contas_financeiras (banco — prioriza conta principal/ativa)
  try {
    const { buscarContasBancariasConfig } = await import("@/services/financeiro/configFinanceiraService");
    const contasConfig = await buscarContasBancariasConfig();
    const contas = Array.isArray(contasConfig) ? contasConfig : [];
    const principal = contas.find((c) => c.ativa !== false && c.principal === true);
    const escolhida = principal || contas.find((c) => c.ativa !== false) || contas[0];
    if (escolhida) {
      const c = escolhida as unknown as Record<string, unknown>;
      banco = banco || String(c.banco || "");
      agencia = agencia || String(c.agencia || "");
      conta = conta || String(c.conta || "");
      pix = pix || String(c.pix || "");
    }
  } catch {
    // fallback abaixo
  }

  // ── FONTE 3: configuracoes_fiscais (emitente fiscal — complementa dados ausentes)
  try {
    const { data } = await supabase
      .from("configuracoes_fiscais")
      .select("*")
      .eq("ativo", true)
      .eq("padrao", true)
      .limit(1)
      .maybeSingle();
    if (data) {
      razaoSocial = razaoSocial || data.razao_social || "";
      nomeFantasia = nomeFantasia || data.nome_fantasia || "";
      cnpj = cnpj || data.cnpj || "";
      ie = ie || data.ie || "";
      inscricaoMunicipal = inscricaoMunicipal || data.inscricao_municipal || null;
      endereco = endereco || [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(", ");
      cidade = data.cidade || "";
      uf = data.uf || "";
      cep = data.cep || "";
      telefone = telefone || data.telefone || "";
      email = email || data.email || "";
    }
  } catch {
    // fallback abaixo
  }

  // ── FONTE 4: empresaConfig (hardcoded — último recurso)
  const { empresaConfig } = await import("@/utils/empresaConfig");
  return {
    razaoSocial: razaoSocial || empresaConfig.razaoSocial,
    nomeFantasia: nomeFantasia || empresaConfig.nomeFantasia,
    cnpj: cnpj || empresaConfig.cnpj,
    ie: ie || empresaConfig.inscricaoEstadual,
    inscricaoMunicipal,
    endereco: endereco || empresaConfig.endereco,
    cidade: cidade || empresaConfig.cidade,
    uf: uf || empresaConfig.uf,
    cep: cep || empresaConfig.cep,
    telefone: telefone || empresaConfig.telefone,
    email: email || empresaConfig.email,
    emailFinanceiro: emailFinanceiro || "financeiro@conexaoexpress.com.br",
    banco,
    agencia,
    conta,
    pix,
    logoPath: "/logos/logo-conexao-colorido.png",
  };
}

/** Busca dados do cliente para a Fatura/PDF. */
export async function buscarClienteParaFatura(clienteId: string): Promise<DadosClienteFatura | null> {
  if (!clienteId) return null;
  try {
    const [clienteQuery, enderecoPrincipal] = await Promise.all([
      supabase
        .from("clientes")
        // FIN-01.1 BUG-2 FIX: coluna "endereco" NÃO existe em clientes.
        // Usar colunas reais: logradouro, numero, complemento, bairro, cidade, uf, cep
        .select("razao_social, nome_fantasia, cnpj, ie, inscricao_municipal, logradouro, numero, complemento, bairro, cidade, uf, cep, vencimento_padrao, tipo_cobranca, tabela_valores_padrao_id")
        .eq("id", clienteId)
        .maybeSingle(),
      buscarEnderecoPrincipalCliente(clienteId),
    ]);
    const data = clienteQuery.data;
    if (!data) return null;

    // FIN-01.1 — montar endereço a partir das colunas reais do cadastro
    const logradouro = (typeof data.logradouro === "string" ? data.logradouro : "").trim();
    const numero = (typeof data.numero === "string" ? data.numero : "").trim();
    const complemento = (typeof data.complemento === "string" ? data.complemento : "").trim();
    const bairro = (typeof data.bairro === "string" ? data.bairro : "").trim();
    const cidade = (typeof data.cidade === "string" ? data.cidade : "").trim();
    const uf = (typeof data.uf === "string" ? data.uf : "").trim();
    const cep = (typeof data.cep === "string" ? data.cep : "").trim();

    // Montar string de endereço a partir do cadastro (fallback)
    const partesEndereco: string[] = [];
    const ruaNumero = [logradouro, numero].filter(Boolean).join(", ");
    if (ruaNumero) partesEndereco.push(ruaNumero);
    if (complemento) partesEndereco.push(complemento);
    if (bairro) partesEndereco.push(bairro);
    if (cep) partesEndereco.push(`CEP: ${cep}`);
    if (cidade) partesEndereco.push(uf ? `${cidade}/${uf}` : cidade);
    else if (uf) partesEndereco.push(uf);
    const enderecoBase = partesEndereco.join(" - ");

    // F38-MANUAL-3 — endereço completo: prioriza enderecos_clientes, fallback cadastro
    const enderecoCompleto = enderecoPrincipal
      ? montarEnderecoCompleto(enderecoPrincipal)
      : (enderecoBase || null);

    return {
      razaoSocial: data.razao_social || data.nome_fantasia || "Cliente",
      nomeFantasia: data.nome_fantasia || null,
      cnpj: data.cnpj || null,
      ie: data.ie || null,
      inscricaoMunicipal: data.inscricao_municipal || null,
      endereco: enderecoBase,
      cidade,
      uf,
      vencimentoPadraoDias: data.vencimento_padrao != null ? Number(data.vencimento_padrao) : null,
      tipoCobranca: data.tipo_cobranca || null,
      tabelaValoresPadraoId: data.tabela_valores_padrao_id || null,
      enderecoCompleto: enderecoCompleto || null,
    };
  } catch {
    return null;
  }
}

/** Converte uma Fatura + itens no modelo de prévia/PDF (sem consumir numeração). */
export function montarPreviaFatura(
  fatura: FaturaComItens,
  dadosEmpresa: DadosEmpresaFatura,
  dadosCliente: DadosClienteFatura | null
): {
  numero: string;
  descricao: string;
  cliente: string;
  data: string;
  vencimento: string;
  itens: {
    data: string; os: string; romaneio: string; descricao: string; valor: number;
    numeroOS: string; servicoTrajeto: string;
    valorBase: number; valorAdicionais: number; valorDescontos: number;
    kmExcedente: number; pedagioCliente: number; ajudanteCliente: number;
    diariaCliente: number; saidasAdicionaisCliente: number;
  }[];
  subtotal: number;
  acrescimos: number;
  descontos: number;
  total: number;
  observacao: string;
  empresa: DadosEmpresaFatura;
  dadosCliente: DadosClienteFatura | null;
  competenciaInicio: string | null;
  competenciaFim: string | null;
  statusComercial: string;
} {
  const itens = fatura.itens.map((i) => {
    // OS Conexão = número interno (snapshot em descricao "OS-XXXX — trajeto").
    // Nunca expor o UUID de fatura_itens.os_id no documento do cliente.
    const numeroOS = extrairNumeroOSItem(i);
    const servicoTrajeto = extrairTrajetoItem(i);
    return {
      data: i.data_servico || fatura.data_emissao,
      os: numeroOS || "—",
      romaneio: i.romaneio || "",
      descricao: i.descricao || "",
      valor: i.valor_total,
      numeroOS,
      servicoTrajeto: servicoTrajeto || i.descricao || "",
      valorBase: i.valor_base,
      valorAdicionais: i.valor_adicionais,
      valorDescontos: i.valor_descontos,
      kmExcedente: i.km_excedente,
      pedagioCliente: i.pedagio_cliente,
      ajudanteCliente: i.ajudante_cliente,
      diariaCliente: i.diaria_cliente,
      saidasAdicionaisCliente: i.saidas_adicionais_cliente,
    };
  });
  // F38-MANUAL — fatura manual usa número informado pelo usuário (metadata.numeroManual)
  // sem interferir no número oficial sequencial (FAT-2026-XXXXXX).
  const numeroManual = (fatura.metadata?.numeroManual && typeof fatura.metadata.numeroManual === "string")
    ? (fatura.metadata.numeroManual as string)
    : "";
  return {
    numero: fatura.numero || numeroManual || "Rascunho",
    descricao: fatura.descricao || "",
    cliente: dadosCliente?.razaoSocial || dadosCliente?.nomeFantasia || "",
    data: fatura.data_emissao,
    vencimento: fatura.vencimento || "",
    itens,
    subtotal: fatura.valor_bruto || fatura.itens.reduce((s, i) => s + i.valor_total, 0),
    acrescimos: fatura.acrescimos || 0,
    descontos: fatura.descontos || 0,
    total: fatura.valor_total,
    // F38-MANUAL — observação interna de fatura manual NÃO aparece no PDF
    // (a observação permanece na fatura para uso interno do time).
    observacao: fatura.metadata?.origem === "manual" ? "" : (fatura.observacao || ""),
    empresa: dadosEmpresa,
    dadosCliente,
    competenciaInicio: fatura.competencia_inicio || null,
    competenciaFim: fatura.competencia_fim || null,
    statusComercial: mapStatusComercialFatura(fatura.status),
  };
}

/** Extrai o número interno da OS/OC a partir do snapshot (descricao "OS-XXXX — trajeto"). */
function extrairNumeroOSItem(item: { os_id?: string | null; descricao?: string | null }): string {
  const desc = String(item.descricao || "").trim();
  const idx = acharSeparadorTrajeto(desc);
  const prefixo = idx >= 0 ? desc.slice(0, idx).trim() : "";
  if (/^[A-Za-z]{2,4}[-_ ]\S+$/.test(prefixo)) return prefixo;
  return "";
}

/** Extrai o trajeto/serviço natural (remove o prefixo "OS-XXXX — "). */
function extrairTrajetoItem(item: { descricao?: string | null }): string {
  const desc = String(item.descricao || "").trim();
  const idx = acharSeparadorTrajeto(desc);
  if (idx >= 0) {
    const resto = desc.slice(idx + 3).trim();
    if (resto) return resto;
  }
  return desc;
}

/** Localiza o separador " — " / " – " / " - " usado no snapshot da descrição. */
function acharSeparadorTrajeto(texto: string): number {
  for (const sep of [" — ", " – ", " - "]) {
    const idx = texto.indexOf(sep);
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Traduz o status interno para a linguagem comercial do documento do cliente. */
function mapStatusComercialFatura(status: string): string {
  switch (status) {
    case "rascunho": return "Rascunho";
    case "aguardando_aprovacao": return "Aguardando aprovação";
    case "aprovada": return "Aprovada";
    case "emitida": return "Emitida";
    case "cancelada": return "Cancelada";
    default: return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO F38-MANUAL — FATURA MANUAL PROFISSIONAL
// faturaService.ts — fluxo paralelo SEM alterar o fluxo automático existente.
//
// • Reutiliza a estrutura oficial `faturas` + `fatura_itens` (SEM tabela nova,
//   SEM migration nesta missão).
// • Origem diferenciada via `metadata.origem = "manual"` (coluna jsonb existente).
// • Número informado pelo usuário em `metadata.numeroManual` — NÃO interfere no
//   número oficial sequencial (FAT-2026-XXXXXX) gerado na emissão automática.
// • Conta bancária escolhida é SNAPSHOTADA em `metadata.contaBancaria` — alteração
//   futura de conta da empresa NÃO altera PDFs históricos desta fatura.
// • Observação interna vai para `faturas.observacao` (não sai no PDF — ver
//   montarPreviaFatura) e fica visível apenas internamente.
// ═══════════════════════════════════════════════════════════════════════════════

export interface ContaBancariaSnapshot {
  banco: string;
  agencia: string;
  conta: string;
  pix: string;
}

/** Monta o snapshot da conta bancária escolhida (para gravar na fatura/PDF). */
export function montarSnapshotConta(c: ContaBancariaFinanceira | null | undefined): ContaBancariaSnapshot | null {
  if (!c) return null;
  return {
    banco: String(c.banco || ""),
    agencia: String(c.agencia || ""),
    conta: String(c.conta || ""),
    pix: String(c.pix || ""),
  };
}

export interface CriarFaturaManualInput {
  /** Legado/opcional. O Nº Conexão e o Nº Cliente oficiais são gerados na EMISSÃO. */
  numero?: string;
  cliente_id: string;
  modelo?: ModeloFatura;
  data_emissao?: string;
  vencimento?: string;
  parcela?: string;
  descricao?: string;
  valor: number;
  conta?: ContaBancariaSnapshot | null;
  observacaoInterna?: string | null;
}

export interface AtualizarFaturaManualInput {
  numero?: string;
  vencimento?: string;
  data_emissao?: string;
  parcela?: string;
  descricao?: string;
  valor?: number;
  conta?: ContaBancariaSnapshot | null;
  observacaoInterna?: string | null;
}

/**
 * Verifica se um número de fatura manual já está em uso (coluna numero oficial OU
 * metadata.numeroManual). Escopo: tenant atual (RLS de faturas já isola o tenant).
 * `ignorarFaturaId` (opcional) permite reutilizar o número da PRÓPRIA fatura em edição.
 */
export async function verificarNumeroFaturaManualDisponivel(numero: string, ignorarFaturaId?: string | null): Promise<{ disponivel: boolean; message?: string }> {
  const num = (numero || "").trim();
  if (!num) return { disponivel: true };
  try {
    const [r1, r2] = await Promise.all([
      supabase.from("faturas").select("id").eq("numero", num).limit(100),
      supabase.from("faturas").select("id").eq("metadata->>numeroManual", num).limit(100),
    ]);
    // Não bloqueia por falha de consulta — a segurança de duplicidade é coberta
    // também pelo comportamento de exibição (bloqueio do botão).
    if (r1.error || r2.error) return { disponivel: true };
    const conflito = (rows: { id: string }[]) =>
      rows.some((r) => !ignorarFaturaId || r.id !== ignorarFaturaId);
    if (conflito((r1.data as { id: string }[]) || []) || conflito((r2.data as { id: string }[]) || [])) {
      return { disponivel: false, message: "Já existe uma fatura com este número." };
    }
    return { disponivel: true };
  } catch {
    return { disponivel: true };
  }
}

/**
 * Cria uma fatura MANUAL usando a estrutura oficial `faturas` + `fatura_itens`.
 * 1) valida número (obrigatório + sem duplicidade) e valor > 0;
 * 2) cria rascunho (status rascunho);
 * 3) adiciona 1 item (snapshot do valor informado — trigger recalcula totais);
 * 4) grava metadata { origem: "manual", numeroManual, parcela, contaBancaria }.
 * NÃO dispara NFS-e/CT-e e NÃO cria Conta a Receber (documentado).
 */
export async function criarFaturaManual(input: CriarFaturaManualInput): Promise<{ success: boolean; fatura?: FaturaComItens; error?: string }> {
  if (!input.cliente_id) return { success: false, error: "Cliente é obrigatório" };
  const valor = num(input.valor);
  if (valor <= 0) return { success: false, error: "Valor deve ser maior que zero" };
  // TMS-FIN-PROG-04B — o número manual deixou de ser obrigatório: rascunho não
  // recebe número oficial. Nº Conexão/Nº Cliente são gerados na EMISSÃO (RPC).
  const numeroManual = (input.numero || "").trim();
  if (numeroManual) {
    const dup = await verificarNumeroFaturaManualDisponivel(numeroManual);
    if (!dup.disponivel) return { success: false, error: dup.message || "Já existe uma fatura com este número." };
  }

  const modeloSugerido = input.modelo || "conexao_express";
  const dataEmissao = input.data_emissao || new Date().toISOString().split("T")[0];

  const res = await criarRascunhoFatura({
    cliente_id: input.cliente_id,
    modelo: modeloSugerido,
    descricao: input.descricao || "",
    data_emissao: dataEmissao,
    vencimento: input.vencimento || undefined,
    observacao: input.observacaoInterna || undefined,
  });
  if (!res.success || !res.fatura) return { success: false, error: res.error || "Erro ao criar fatura manual" };

  const itemRes = await adicionarItemFatura({
    fatura_id: res.fatura.id,
    cliente_id: input.cliente_id,
    descricao: input.descricao || "Fatura manual",
    data_servico: dataEmissao,
    valor_base: valor,
    valor_total: valor,
  });
  if (!itemRes.success) {
    // Rascunho recém-criado sem emissão — limpeza controlada é segura.
    await supabase.from("faturas").delete().eq("id", res.fatura.id);
    return { success: false, error: itemRes.error || "Erro ao registrar o valor da fatura" };
  }

  const metadata: Record<string, unknown> = {
    origem: "manual",
    parcela: (input.parcela && input.parcela.trim()) ? input.parcela.trim() : "1",
    contaBancaria: input.conta || null,
    modelo: modeloSugerido,
    descricao: input.descricao || "",
  };
  if (numeroManual) metadata.numeroManual = numeroManual;
  await supabase.from("faturas").update({ metadata }).eq("id", res.fatura.id);

  const f = await buscarFaturaComItens(res.fatura.id);
  if (!f) return { success: false, error: "Fatura criada, mas não foi possível recarregar" };
  return { success: true, fatura: f };
}

/**
 * Atualiza uma fatura manual (mesma estrutura oficial).
 * • status rascunho: permite editar inclusive o VALOR (atualiza o único item —
 *   trigger recalcula os totais da fatura).
 * • status emitida (F38-MANUAL-3, apenas sem vínculos): permite editar campos de
 *   cabeçalho (vencimento, emissão, descrição, observação, número, parcela, conta,
 *   modelo), mas o VALOR fica BLOQUEADO (trigger de emissão impede alteração de item).
 */
export async function atualizarFaturaManual(faturaId: string, input: AtualizarFaturaManualInput): Promise<{ success: boolean; fatura?: FaturaComItens; error?: string }> {
  try {
    const atual = await buscarFaturaComItens(faturaId);
    if (!atual) return { success: false, error: "Fatura não encontrada" };
    if (atual.status !== "rascunho" && atual.status !== "emitida") return { success: false, error: "Fatura não pode ser alterada neste status" };

    if (input.numero !== undefined) {
      const numeroManual = (input.numero || "").trim();
      if (!numeroManual) return { success: false, error: "Número da fatura é obrigatório" };
      const proprio = String(atual.metadata?.numeroManual || "").trim() === numeroManual;
      if (!proprio) {
        const dup = await verificarNumeroFaturaManualDisponivel(numeroManual, faturaId);
        if (!dup.disponivel) return { success: false, error: dup.message || "Já existe uma fatura com este número." };
      }
    }

    const metadataAtual = (atual.metadata && typeof atual.metadata === "object" ? atual.metadata : {}) as Record<string, unknown>;
    const metadata = { ...metadataAtual };
    if (input.numero !== undefined) metadata.numeroManual = (input.numero || "").trim();
    if (input.parcela !== undefined) metadata.parcela = input.parcela.trim() || "1";
    if (input.conta !== undefined) metadata.contaBancaria = input.conta || null;
    // FIN-01.1 — descricao é armazenada em metadata (coluna SQL não existe)
    if (input.descricao !== undefined) metadata.descricao = input.descricao || "";

    await supabase.from("faturas").update({ metadata }).eq("id", faturaId);

    const upd: Partial<Pick<Fatura, "vencimento" | "observacao" | "data_emissao">> = {};
    if (input.vencimento !== undefined) upd.vencimento = input.vencimento || null;
    if (input.data_emissao !== undefined) upd.data_emissao = input.data_emissao || undefined;
    if (input.observacaoInterna !== undefined) upd.observacao = input.observacaoInterna || null;
    await atualizarFatura(faturaId, upd);

    // Valor só é persistido em rascunho (trigger de emissão bloqueia item de emitida)
    if (input.valor !== undefined && Number.isFinite(input.valor) && input.valor > 0 && atual.status === "rascunho") {
      const item = atual.itens[0];
      if (item) {
        await supabase
          .from("fatura_itens")
          .update({
            valor_base: num(input.valor),
            valor_total: num(input.valor),
            descricao: input.descricao ?? item.descricao,
            data_servico: input.data_emissao ?? item.data_servico,
          })
          .eq("id", item.id);
      }
    }

    const f = await buscarFaturaComItens(faturaId);
    return { success: true, fatura: f || undefined };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao atualizar fatura manual" };
  }
}

// ── F38-MANUAL-3 — Exclusão/Cancelamento seguro de fatura manual ──────────────
export interface VinculosFatura {
  temContaReceber: boolean;
  contaReceberStatus: string | null;
  temRecebimento: boolean;
  temFiscal: boolean;
  motivo: string | null;
}

/**
 * Verifica vínculos financeiros/fiscais de uma fatura antes de exclusão/edição.
 * Não apaga nada — apenas diagnostica para proteger o histórico.
 */
export async function verificarVinculosFatura(faturaId: string): Promise<VinculosFatura> {
  const f = await buscarFaturaComItens(faturaId);
  if (!f) return { temContaReceber: false, contaReceberStatus: null, temRecebimento: false, temFiscal: false, motivo: "Fatura não encontrada" };
  const vinculos: VinculosFatura = {
    temContaReceber: !!f.conta_receber_id,
    contaReceberStatus: null,
    temRecebimento: false,
    temFiscal: false,
    motivo: null,
  };
  if (f.conta_receber_id) {
    try {
      const { data } = await supabase
        .from("financeiro_receber")
        .select("id, status")
        .eq("id", f.conta_receber_id)
        .maybeSingle();
      vinculos.contaReceberStatus = data?.status || null;
      vinculos.temRecebimento = ["pago", "parcial", "cancelado"].includes((data?.status || "").toLowerCase());
    } catch {
      vinculos.contaReceberStatus = "indefinido";
    }
  }
  // Fatura manual não vincula OS/fiscal, mas verifica por segurança
  if (!vinculos.temFiscal) {
    try {
      const { data: itensComOS } = await supabase
        .from("fatura_itens")
        .select("id")
        .eq("fatura_id", faturaId)
        .not("os_id", "is", null)
        .limit(1);
      vinculos.temFiscal = (itensComOS?.length || 0) > 0;
    } catch {
      vinculos.temFiscal = false;
    }
  }
  if (vinculos.temContaReceber || vinculos.temRecebimento || vinculos.temFiscal) {
    const partes: string[] = [];
    if (vinculos.temContaReceber) partes.push("Conta a Receber vinculada");
    if (vinculos.temRecebimento) partes.push(`título ${vinculos.contaReceberStatus || "com baixa"}`);
    if (vinculos.temFiscal) partes.push("serviço com documento fiscal vinculado");
    vinculos.motivo = `Fatura com vínculo financeiro/fiscal (${partes.join(", ")}). Exclusão bloqueada — trate o vínculo antes.`;
  }
  return vinculos;
}

/**
 * Exclui UMA FATURA MANUAL em rascunho SEM vínculos (histórico não é apagado em
 * cascata; fatura_itens apaga em cascata pela FK, segura para rascunho).
 * Faturas emitidas/canceladas/automáticas NÃO são excluídas aqui.
 */
export async function excluirFaturaManual(faturaId: string): Promise<{ success: boolean; error?: string }> {
  const f = await buscarFaturaComItens(faturaId);
  if (!f) return { success: false, error: "Fatura não encontrada" };
  if (f.metadata?.origem !== "manual") return { success: false, error: "Somente faturas manuais podem ser excluídas." };
  if (f.status !== "rascunho") return { success: false, error: "Somente fatura manual em rascunho pode ser excluída. Faturas emitidas usam cancelamento oficial." };
  const vinculos = await verificarVinculosFatura(faturaId);
  if (vinculos.temContaReceber || vinculos.temRecebimento || vinculos.temFiscal) {
    return { success: false, error: vinculos.motivo || "Fatura com vínculos. Exclusão bloqueada." };
  }
  try {
    const { error } = await supabase.from("faturas").delete().eq("id", faturaId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao excluir fatura" };
  }
}

/**
 * Cancela UMA FATURA MANUAL emitida via estrutura oficial (f_cancelar_fatura),
 * SEM apagar histórico. Bloqueado se existirem vínculos financeiros/fiscais.
 */
export async function cancelarFaturaManualEmitida(faturaId: string, motivo?: string): Promise<{ success: boolean; error?: string }> {
  const f = await buscarFaturaComItens(faturaId);
  if (!f) return { success: false, error: "Fatura não encontrada" };
  if (f.metadata?.origem !== "manual") return { success: false, error: "Somente faturas manuais." };
  if (f.status !== "emitida") return { success: false, error: "Fatura não está emitida." };
  const vinculos = await verificarVinculosFatura(faturaId);
  if (vinculos.temContaReceber || vinculos.temRecebimento || vinculos.temFiscal) {
    return { success: false, error: vinculos.motivo || "Fatura com vínculos. Cancelamento bloqueado — trate o título primeiro." };
  }
  return cancelarFatura(faturaId, motivo || "Cancelamento de fatura manual emitida");
}

/**
 * Monta o PdfFaturaInput completo de uma fatura (automática OU manual), aplicando:
 * • número manual (metadata.numeroManual) quando presente;
 * • snapshot da conta bancária (metadata.contaBancaria) — garante que PDFs
 *   históricos não mudem quando a conta da empresa for alterada.
 */export function montarInputPdfFatura(
  fatura: FaturaComItens,
  empresa: DadosEmpresaFatura,
  cliente: DadosClienteFatura | null
): PdfFaturaInput {
  const previa = montarPreviaFatura(fatura, empresa, cliente);
  const conta = (fatura.metadata?.contaBancaria && typeof fatura.metadata.contaBancaria === "object")
    ? (fatura.metadata.contaBancaria as ContaBancariaSnapshot)
    : null;
  const parcela = (fatura.metadata?.parcela && typeof fatura.metadata.parcela === "string" && (fatura.metadata.parcela as string).trim())
    ? (fatura.metadata.parcela as string).trim()
    : "1";
  return {
    modelo: fatura.modelo || "conexao_express",
    numero: previa.numero,
    numeroCliente: fatura.numero_cliente ?? null,
    descricao: previa.descricao || "",
    cliente: previa.cliente,
    clienteCnpj: cliente?.cnpj || null,
    // F38-MANUAL-2 — IE do cliente agora chega ao PDF (antes hardcoded null)
    clienteIe: cliente?.ie || null,
    data: previa.data,
    vencimento: previa.vencimento,
    itens: previa.itens.map((i) => ({ ...i })),
    subtotal: previa.subtotal,
    acrescimos: previa.acrescimos,
    descontos: previa.descontos,
    total: previa.total,
    observacao: previa.observacao,
    empresa: conta
      ? {
          ...previa.empresa,
          banco: conta.banco || previa.empresa.banco,
          agencia: conta.agencia || previa.empresa.agencia,
          conta: conta.conta || previa.empresa.conta,
          pix: conta.pix || previa.empresa.pix,
        }
      : previa.empresa,
    dadosCliente: previa.dadosCliente,
    parcela,
    // TMS-S04 — enriquecimento do documento do cliente
    competenciaInicio: previa.competenciaInicio,
    competenciaFim: previa.competenciaFim,
    statusComercial: previa.statusComercial,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO A31 — NOTAS FISCAIS TRANSPORTADAS (1:N via fiscal_documentos_vinculados)
// ═══════════════════════════════════════════════════════════════════════════════

export interface NFTransportada {
  id: string;
  ordem_servico_id: string | null;
  tipo_documento: string;
  numero: string | null;
  serie: string | null;
  chave_acesso: string | null;
  emitente_nome: string | null;
  emitente_cnpj: string | null;
  valor_total: number;
  peso_bruto: number;
  volumes: number;
  status: string;
  xml_storage_path: string | null;
  created_at: string;
}

function mapNF(row: Record<string, unknown>): NFTransportada {
  return {
    id: String(row.id),
    ordem_servico_id: row.ordem_servico_id ? String(row.ordem_servico_id) : null,
    tipo_documento: String(row.tipo_documento || "NFE"),
    numero: row.numero ? String(row.numero) : null,
    serie: row.serie ? String(row.serie) : null,
    chave_acesso: row.chave_acesso ? String(row.chave_acesso) : null,
    emitente_nome: row.emitente_nome ? String(row.emitente_nome) : null,
    emitente_cnpj: row.emitente_cnpj ? String(row.emitente_cnpj) : null,
    valor_total: num(row.valor_total),
    peso_bruto: num(row.peso_bruto),
    volumes: num(row.volumes),
    status: String(row.status || "vinculada"),
    xml_storage_path: row.xml_storage_path ? String(row.xml_storage_path) : null,
    created_at: row.created_at ? String(row.created_at) : new Date().toISOString(),
  };
}

/** Lista NFs transportadas vinculadas a uma OS (1:N). */
export async function listarNFsDaOS(osId: string): Promise<NFTransportada[]> {
  if (!osId) return [];
  try {
    const { data, error } = await supabase
      .from("fiscal_documentos_vinculados")
      .select("*")
      .eq("ordem_servico_id", osId)
      .order("created_at", { ascending: true });
    if (error) return [];
    return (data || []).map((r: Record<string, unknown>) => mapNF(r));
  } catch {
    return [];
  }
}

/**
 * A31F — Conjunto de números de NF já vinculados ao MESMO serviço (OS).
 * Usado para impedir duplicidade dentro do mesmo serviço sem afetar NFs de
 * outros serviços (isolamento por vínculo ordem_servico_id).
 */
export async function listarNumerosNFsDaOS(osId: string): Promise<Set<string>> {
  const lista = await listarNFsDaOS(osId);
  const numeros = new Set<string>();
  for (const nf of lista) {
    if (nf.numero) numeros.add(nf.numero.trim());
    if (nf.chave_acesso) numeros.add(nf.chave_acesso.trim());
  }
  return numeros;
}

export interface AdicionarNFInput {
  osId: string;
  numero?: string;
  serie?: string;
  chave_acesso?: string;
  valor_total?: number;
  emitente_nome?: string;
  emitente_cnpj?: string;
  peso_bruto?: number;
  volumes?: number;
}

/** Adiciona uma NF transportada vinculada à OS (fonte oficial fiscal_documentos_vinculados).
 * A31F — somente o Número da NF é obrigatório; série/chave/valor/emitente/peso/volumes são opcionais. */
export async function adicionarNFaOS(input: AdicionarNFInput): Promise<{ success: boolean; nf?: NFTransportada; error?: string }> {
  if (!input.osId) return { success: false, error: "OS é obrigatória" };
  const numero = (input.numero ?? "").trim();
  if (!numero) {
    return { success: false, error: "Informe o número da NF (obrigatório)" };
  }
  try {
    const payload: Record<string, unknown> = {
      ordem_servico_id: input.osId,
      tipo_documento: "NFE",
      numero: numero,
      serie: input.serie || null,
      chave_acesso: input.chave_acesso || null,
      emitente_nome: input.emitente_nome || null,
      emitente_cnpj: input.emitente_cnpj || null,
      valor_total: num(input.valor_total),
      peso_bruto: num(input.peso_bruto),
      volumes: num(input.volumes),
      status: "vinculada",
    };
    const { data, error } = await supabase.from("fiscal_documentos_vinculados").insert([payload]).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, nf: mapNF(data as Record<string, unknown>) };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao adicionar NF" };
  }
}

/** Remove/desvincula uma NF (não destrutivo: marca status 'desvinculada' se suportado, senão delete controlado). */
export async function removerNFdaOS(nfId: string): Promise<{ success: boolean; error?: string }> {
  if (!nfId) return { success: false, error: "NF inválida" };
  try {
    // A31B — BLOQUEIO: NF vinculada a documento fiscal emitido (CT-e/MDF-e) não pode ser removida.
    const { data: nf, error: nfErr } = await supabase
      .from("fiscal_documentos_vinculados")
      .select("id, cte_id, mdfe_id, status")
      .eq("id", nfId)
      .maybeSingle();
    if (nfErr) return { success: false, error: nfErr.message };
    if (!nf) return { success: false, error: "NF não encontrada" };
    if (nf.cte_id || nf.mdfe_id) {
      return {
        success: false,
        error: "NF vinculada a documento fiscal emitido (CT-e/MDF-e). Remoção bloqueada — desvincule o CT-e/MDF-e primeiro ou inative a NF por status.",
      };
    }
    // Não-destrutivo preferido: marca status 'desvinculada' preservando o histórico.
    if (nf.status && nf.status !== "desvinculada") {
      const { error } = await supabase
        .from("fiscal_documentos_vinculados")
        .update({ status: "desvinculada" })
        .eq("id", nfId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }
    // Fallback para NFs que não suportam status: delete controlado apenas de NFs não vinculadas a CT-e/MDF-e.
    const { error } = await supabase.from("fiscal_documentos_vinculados").delete().eq("id", nfId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao remover NF" };
  }
}

/** Edita uma NF transportada (fiscal_documentos_vinculados). Bloqueia se vinculada a CT-e/MDF-e. */
export async function atualizarNFdaOS(
  nfId: string,
  input: Partial<AdicionarNFInput>
): Promise<{ success: boolean; nf?: NFTransportada; error?: string }> {
  if (!nfId) return { success: false, error: "NF inválida" };
  try {
    const { data: nf, error: nfErr } = await supabase
      .from("fiscal_documentos_vinculados")
      .select("id, cte_id, mdfe_id")
      .eq("id", nfId)
      .maybeSingle();
    if (nfErr) return { success: false, error: nfErr.message };
    if (!nf) return { success: false, error: "NF não encontrada" };
    if (nf.cte_id || nf.mdfe_id) {
      return {
        success: false,
        error: "NF vinculada a documento fiscal emitido (CT-e/MDF-e). Edição bloqueada — desvincule o CT-e/MDF-e antes de alterar.",
      };
    }
    const payload: Record<string, unknown> = {
      tipo_documento: "NFE",
    };
    if (input.numero !== undefined) payload.numero = input.numero || null;
    if (input.serie !== undefined) payload.serie = input.serie || null;
    if (input.chave_acesso !== undefined) payload.chave_acesso = input.chave_acesso || null;
    if (input.valor_total !== undefined) payload.valor_total = num(input.valor_total);
    if (input.emitente_nome !== undefined) payload.emitente_nome = input.emitente_nome || null;
    if (input.emitente_cnpj !== undefined) payload.emitente_cnpj = input.emitente_cnpj || null;
    if (input.peso_bruto !== undefined) payload.peso_bruto = num(input.peso_bruto);
    if (input.volumes !== undefined) payload.volumes = num(input.volumes);
    const { data, error } = await supabase
      .from("fiscal_documentos_vinculados")
      .update(payload)
      .eq("id", nfId)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, nf: mapNF(data as Record<string, unknown>) };
  } catch (e) {
    return { success: false, error: (e instanceof Error ? e.message : "") || "Erro ao editar NF" };
  }
}
