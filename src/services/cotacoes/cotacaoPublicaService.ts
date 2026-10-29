// ============================================================
// MISSÃO COTACAO-EXPRESS — service público de cotações
// Fonte única de leitura/escrita de `cotacoes_publicas`.
//
// Fluxo em 2 fases (CRO: preço na hora → dados completos depois da
// aprovação do próprio cliente na tela):
//   FASE 1 (/cotacao-express)              → 'Pendente de Aprovação pelo Cliente'
//                                             (com rota + preço em metadata)
//   aprovação do cliente (botão verde)     → 'Aguardando Detalhes' + valor_aprovado
//   FASE 2 (/cotacao-express/detalhes/:id) → 'Pronto para OS'
//   legado 'Pendente' continua aceito (cotações antigas sem preço)
//
// REGRA DE OURO: toda escrita/anonima passa por aqui e SEMPRE
// filtra por .eq("id", id) — nunca varre a tabela inteira.
// ============================================================
import { supabase } from "@/lib/supabase";
import { toClienteInsert } from "@/lib/dbMappers";
import type { Orcamento, EnderecoOrcamento } from "@/components/comercial/types";
import type { PrecificacaoCotacao, PontoRotaCotacao } from "./cotacaoCalculoService";

export const TABELA_COTACOES = "cotacoes_publicas";
export const MAX_PARADAS_COTACAO = 8;

export type StatusCotacao =
  | "Pendente"
  | "Pendente de Aprovação pelo Cliente"
  | "Aguardando Detalhes"
  | "Pronto para OS";

export const STATUS_PENDENTE = "Pendente";
export const STATUS_AGUARDANDO_APROVACAO = "Pendente de Aprovação pelo Cliente";
export const STATUS_AGUARDANDO_DETALHES = "Aguardando Detalhes";
export const STATUS_PRONTO_PARA_OS = "Pronto para OS";

export interface MetadataCotacao {
  precificacao?: PrecificacaoCotacao | null;
  rota?: { pontos: PontoRotaCotacao[]; km?: number; duracao_min?: number } | null;
  origem?: string;
}

export interface ParadaCotacao {
  sequencia: number;
  /** "retirada_entrega" = parada que serve como retirada E entrega no mesmo ponto. */
  tipo: "retirada" | "entrega" | "retirada_entrega";
  endereco: string;
}

export interface DetalheParadaCotacao {
  sequencia: number;
  numero: string;
  complemento: string;
  contato: string;
  observacoes: string;
}

export interface CotacaoPublica {
  id: string;
  status: StatusCotacao;
  nome_cliente: string | null;
  telefone: string | null;
  carga_descricao: string | null;
  carga_peso: number | null;
  carga_dimensoes: string | null;
  carga_volumes: number | null;
  paradas: ParadaCotacao[];
  data_desejada: string | null;
  hora_desejada: string | null;
  detalhes: DetalheParadaCotacao[];
  orcamento_id: string | null;
  valor_aprovado: number | null;
  /** Precificação + rota gravadas na Fase 1 V2 (opcional em linhas antigas). */
  metadata?: MetadataCotacao;
  created_at?: string;
}

export interface ResultadoCotacao<T> {
  ok: boolean;
  erro?: string;
  dado?: T;
}

export interface CriarCotacaoFase1Input {
  nome_cliente: string;
  telefone: string;
  carga_descricao: string;
  carga_peso: number | null;
  carga_dimensoes: string;
  paradas: string[];
  /**
   * Tipos explícitos por parada (retirada/entrega/retirada_entrega). Alinha com o array
   * `paradas` ANTES do filtro de vazias. Se omitido, o default é
   * 1ª = retirada, demais = entrega (comportamento legado).
   */
  paradasTipos?: Array<"retirada" | "entrega" | "retirada_entrega">;
  data_desejada: string;
  hora_desejada: string;
  /** Status inicial (default legado 'Pendente'). */
  status?: StatusCotacao;
  /** Precificação calculada em tempo real (Fase 1 V2). */
  precificacao?: PrecificacaoCotacao | null;
  /** Coordenadas das paradas usadas no cálculo da rota. */
  pontosRota?: PontoRotaCotacao[] | null;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** Monta as paradas da Fase 1 (default: 1ª = retirada, demais = entrega; tipos opcionais). */
export function montarParadasFase1(
  enderecos: string[],
  tipos?: Array<"retirada" | "entrega" | "retirada_entrega">,
): ParadaCotacao[] {
  return enderecos
    .map((endereco, idx) => ({
      sequencia: idx + 1,
      tipo: (tipos?.[idx] ?? (idx === 0 ? "retirada" : "entrega")) as ParadaCotacao["tipo"],
      endereco: endereco.trim(),
    }))
    .filter((p) => p.endereco.length > 0);
}

/** Extrai um CEP (8 dígitos) da referência quando houver. */
export function extrairCep(texto: string): string {
  const m = texto.match(/\d{5}-?\d{3}/);
  return m ? m[0] : "";
}

/** Gera o número do orçamento no padrão ORC-YYYYMM-XXXX. */
export function gerarNumeroOrcamento(): string {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `ORC-${ano}${mes}-${seq}`;
}

/** URL pública da Fase 2 (o comercial cola no WhatsApp). */
export function gerarLinkFase2(cotacaoId: string): string {
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://tms.conexaoexpress.com.br";
  return `${base}/cotacao-express/detalhes/${cotacaoId}`;
}

const erroDe = (mensagem: string): string => mensagem;

/** Monta o `metadata` (precificação + rota) persistido junto da Fase 1. */
export function montarMetadataCotacao(
  input: Pick<CriarCotacaoFase1Input, "precificacao" | "pontosRota">,
): MetadataCotacao {
  const metadata: MetadataCotacao = { origem: "cotacao-express" };
  if (input.precificacao) metadata.precificacao = input.precificacao;
  if (input.pontosRota && input.pontosRota.length >= 2) {
    metadata.rota = {
      pontos: input.pontosRota,
      km: input.precificacao?.distancia_km ?? null,
      duracao_min: input.precificacao?.duracao_min ?? null,
    };
  }
  return metadata;
}

// ------------------------------------------------------------
// FASE 1 — criação (INSERT anônimo)
// ------------------------------------------------------------

export async function criarCotacaoFase1(
  input: CriarCotacaoFase1Input,
): Promise<ResultadoCotacao<string>> {
  const paradas = montarParadasFase1(input.paradas, input.paradasTipos);
  if (paradas.length < 2) {
    return { ok: false, erro: erroDe("Informe ao menos a retirada e 1 entrega.") };
  }
  if (paradas.length > MAX_PARADAS_COTACAO) {
    return { ok: false, erro: erroDe(`Limite de ${MAX_PARADAS_COTACAO} paradas.`) };
  }

  const { data, error } = await supabase
    .from(TABELA_COTACOES)
    .insert([
      {
        status: input.status || STATUS_PENDENTE,
        nome_cliente: input.nome_cliente.trim(),
        telefone: input.telefone.trim(),
        carga_descricao: input.carga_descricao.trim(),
        carga_peso: input.carga_peso,
        carga_dimensoes: input.carga_dimensoes.trim() || null,
        paradas,
        data_desejada: input.data_desejada || null,
        hora_desejada: input.hora_desejada || null,
        detalhes: [],
        metadata: montarMetadataCotacao(input),
      },
    ])
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, erro: error?.message || erroDe("Não foi possível enviar a cotação.") };
  }
  return { ok: true, dado: String((data as { id: unknown }).id) };
}

// ------------------------------------------------------------
// APROVAÇÃO PELO CLIENTE (Fase 1 → Fase 2)
// ------------------------------------------------------------

export interface AprovarCotacaoInput {
  valor: number;
  dataDesejada?: string;
  horaDesejada?: string;
}

/**
 * Cliente aprovou o valor na tela → grava `valor_aprovado` e libera a
 * Fase 2 (`Aguardando Detalhes`). Só escreve pela linha do id.
 */
export async function aprovarCotacao(
  cotacaoId: string,
  input: AprovarCotacaoInput,
): Promise<ResultadoCotacao<void>> {
  if (!cotacaoId) return { ok: false, erro: erroDe("Cotação não informada.") };
  if (!Number.isFinite(input.valor) || input.valor <= 0) {
    return { ok: false, erro: erroDe("Valor da cotação inválido.") };
  }

  const payload: Record<string, unknown> = {
    status: STATUS_AGUARDANDO_DETALHES,
    valor_aprovado: Math.round(input.valor * 100) / 100,
  };
  if (input.dataDesejada) payload.data_desejada = input.dataDesejada;
  if (input.horaDesejada) payload.hora_desejada = input.horaDesejada;

  const { error } = await supabase
    .from(TABELA_COTACOES)
    .update(payload)
    .eq("id", cotacaoId);

  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

// ------------------------------------------------------------
// LEITURA
// ------------------------------------------------------------

export async function buscarCotacao(
  id: string,
): Promise<ResultadoCotacao<CotacaoPublica>> {
  if (!id) return { ok: false, erro: erroDe("Cotação não informada.") };

  const { data, error } = await supabase
    .from(TABELA_COTACOES)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return { ok: false, erro: error.message };
  if (!data) return { ok: false, erro: erroDe("Cotação não encontrada.") };
  return { ok: true, dado: normalizarCotacao(data) };
}

export async function buscarCotacaoPorOrcamento(
  orcamentoId: string,
): Promise<ResultadoCotacao<CotacaoPublica>> {
  if (!orcamentoId) return { ok: false, erro: erroDe("Orçamento não informado.") };

  const { data, error } = await supabase
    .from(TABELA_COTACOES)
    .select("*")
    .eq("orcamento_id", orcamentoId)
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, erro: error.message };
  if (!data) return { ok: false, erro: erroDe("Cotação não encontrada.") };
  return { ok: true, dado: normalizarCotacao(data) };
}

export interface ConversaoCotacaoOS {
  cotacaoId: string;
  clienteId: string | null;
  orcamentoId: string;
  orcamentoNumero: string;
  osId: string | null;
  osNumero: string | null;
  criado: boolean;
}

/**
 * FASE 2 → TMS: cria (uma única vez) o Orçamento na Gestão Comercial e a
 * OS solicitada pelo cliente. Roda em RPC `SECURITY DEFINER` porque a
 * página é pública; a função é idempotente por cotação.
 */
export async function converterCotacaoEmOrcamentoEOS(
  cotacaoId: string,
): Promise<ResultadoCotacao<ConversaoCotacaoOS>> {
  if (!cotacaoId) return { ok: false, erro: erroDe("Cotação não informada.") };

  const { data, error } = await supabase.rpc("f_cotacao_detalhes_para_os", {
    p_cotacao_id: cotacaoId,
  });

  if (error) return { ok: false, erro: error.message };

  const payload = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (!payload.success) {
    return {
      ok: false,
      erro: String(payload.message || "Não foi possível gerar o orçamento e a OS da cotação."),
    };
  }

  return {
    ok: true,
    dado: {
      cotacaoId: String(payload.cotacao_id || cotacaoId),
      clienteId: payload.cliente_id ? String(payload.cliente_id) : null,
      orcamentoId: String(payload.orcamento_id || ""),
      orcamentoNumero: String(payload.orcamento_numero || ""),
      osId: payload.os_id ? String(payload.os_id) : null,
      osNumero: payload.os_numero ? String(payload.os_numero) : null,
      criado: Boolean(payload.created),
    },
  };
}

function normalizarCotacao(row: Record<string, unknown>): CotacaoPublica {
  const paradas = Array.isArray(row.paradas) ? (row.paradas as ParadaCotacao[]) : [];
  const detalhes = Array.isArray(row.detalhes) ? (row.detalhes as DetalheParadaCotacao[]) : [];
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as MetadataCotacao)
      : {};
  return {
    id: String(row.id),
    status: (row.status as StatusCotacao) || STATUS_PENDENTE,
    nome_cliente: (row.nome_cliente as string) || null,
    telefone: (row.telefone as string) || null,
    carga_descricao: (row.carga_descricao as string) || null,
    carga_peso: row.carga_peso === null || row.carga_peso === undefined ? null : Number(row.carga_peso),
    carga_dimensoes: (row.carga_dimensoes as string) || null,
    carga_volumes:
      row.carga_volumes === null || row.carga_volumes === undefined ? null : Number(row.carga_volumes),
    paradas,
    data_desejada: (row.data_desejada as string) || null,
    hora_desejada: (row.hora_desejada as string) || null,
    detalhes,
    orcamento_id: (row.orcamento_id as string) || null,
    valor_aprovado:
      row.valor_aprovado === null || row.valor_aprovado === undefined
        ? null
        : Number(row.valor_aprovado),
    metadata,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

// ------------------------------------------------------------
// FASE 2 — detalhes (UPDATE anônimo pelo id)
// ------------------------------------------------------------

export async function salvarDetalhesFase2(
  id: string,
  detalhes: DetalheParadaCotacao[],
): Promise<ResultadoCotacao<CotacaoPublica>> {
  if (!id) return { ok: false, erro: erroDe("Cotação não informada.") };

  const { data, error } = await supabase
    .from(TABELA_COTACOES)
    .update({ status: "Pronto para OS", detalhes })
    .eq("id", id) // ← sempre pelo id da cotação (nunca varredura)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, erro: error.message };
  if (!data) return { ok: false, erro: erroDe("Cotação não encontrada.") };
  return { ok: true, dado: normalizarCotacao(data) };
}

// ------------------------------------------------------------
// INTEGRAÇÃO COMERCIAL (Torre de Controle)
// ------------------------------------------------------------

/** Orçamento criado a partir da cotação → guarda o vínculo no lado da cotação. */
export async function vincularCotacaoAoOrcamento(
  cotacaoId: string,
  orcamentoId: string,
): Promise<ResultadoCotacao<void>> {
  if (!cotacaoId || !orcamentoId) {
    return { ok: false, erro: erroDe("Cotação/Orçamento não informado.") };
  }
  const { error } = await supabase
    .from(TABELA_COTACOES)
    .update({ orcamento_id: orcamentoId })
    .eq("id", cotacaoId);
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

/**
 * Gera o link da Fase 2 e move a cotação para
 * 'Aguardando Detalhes' (orçamento aprovado → cliente completa o endereço).
 */
export async function gerarLinkFase2EAtualizarStatus(
  cotacaoId: string,
): Promise<ResultadoCotacao<string>> {
  if (!cotacaoId) return { ok: false, erro: erroDe("Cotação não informada.") };

  const { error } = await supabase
    .from(TABELA_COTACOES)
    .update({ status: "Aguardando Detalhes" })
    .eq("id", cotacaoId);

  if (error) return { ok: false, erro: error.message };
  return { ok: true, dado: gerarLinkFase2(cotacaoId) };
}

/** Orçamento aprovado com cotação vinculada → status 'Aguardando Detalhes'. */
export async function marcarCotacaoAguardandoDetalhes(
  cotacaoId: string,
): Promise<ResultadoCotacao<void>> {
  const { error } = await supabase
    .from(TABELA_COTACOES)
    .update({ status: "Aguardando Detalhes" })
    .eq("id", cotacaoId);
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

// ------------------------------------------------------------
// TRIAGEM COMERCIAL — leads vindos do site (Gestão Comercial)
// ------------------------------------------------------------

/**
 * Status que aparecem na fila de triagem do comercial:
 * leads abertos (aguardando proposta/aprovação) e os que já têm
 * preço aprovado mas ainda não viraram OS.
 */
export const STATUS_LEADS_TRIAGEM: StatusCotacao[] = [
  STATUS_PENDENTE,
  STATUS_AGUARDANDO_APROVACAO,
  STATUS_AGUARDANDO_DETALHES,
  STATUS_PRONTO_PARA_OS,
];

/** Lista os leads públicos em aberto para a aba "Leads / Cotações Site". */
export async function buscarLeadsCotacoes(): Promise<ResultadoCotacao<CotacaoPublica[]>> {
  const { data, error } = await supabase
    .from(TABELA_COTACOES)
    .select("*")
    .in("status", STATUS_LEADS_TRIAGEM)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { ok: false, erro: error.message };
  return { ok: true, dado: ((data as Record<string, unknown>[]) || []).map(normalizarCotacao) };
}

/**
 * Valor exibido ao comercial: aprovado tem prioridade sobre o
 * estimado na Fase 1. `null` quando não há preço calculado (lead legado).
 */
export function valorExibidoCotacao(cotacao: CotacaoPublica): number | null {
  if (cotacao.valor_aprovado !== null && cotacao.valor_aprovado !== undefined) {
    return cotacao.valor_aprovado;
  }
  const estimado = cotacao.metadata?.precificacao?.valor;
  return typeof estimado === "number" && Number.isFinite(estimado) ? estimado : null;
}

/** "Origem → Destino" derivado das paradas (1ª = retirada, última = entrega). */
export function resumoRotaCotacao(cotacao: CotacaoPublica): string {
  const paradas = cotacao.paradas.filter((p) => p.endereco.trim().length > 0);
  if (paradas.length === 0) return "—";
  const origem = paradas[0].endereco;
  if (paradas.length === 1) return origem;
  const destino = paradas[paradas.length - 1].endereco;
  return `${origem} → ${destino}`;
}

/** Veículo sugerido pelo motor de carga da Fase 1 (quando houver). */
export function veiculoSugeridoCotacao(cotacao: CotacaoPublica): string {
  return cotacao.metadata?.precificacao?.rotulo_veiculo || "—";
}

/** Rótulos exibidos na triagem (legado + V2). */
export const STATUS_LEAD_LABEL: Record<StatusCotacao, string> = {
  [STATUS_PENDENTE]: "Pendente",
  [STATUS_AGUARDANDO_APROVACAO]: "Aguardando aprovação",
  [STATUS_AGUARDANDO_DETALHES]: "Aprovada pelo Cliente",
  [STATUS_PRONTO_PARA_OS]: "Pronto para OS",
};

/** Cores dos badges de status na triagem. */
export const STATUS_LEAD_COR: Record<StatusCotacao, string> = {
  [STATUS_PENDENTE]: "bg-slate-100 text-slate-700",
  [STATUS_AGUARDANDO_APROVACAO]: "bg-amber-100 text-amber-800",
  [STATUS_AGUARDANDO_DETALHES]: "bg-blue-100 text-blue-800",
  [STATUS_PRONTO_PARA_OS]: "bg-emerald-100 text-emerald-800",
};

// ------------------------------------------------------------
// PRÉ-PREENCHIMENTO DO ORÇAMENTO (Fase 1 → Novo Orçamento)
// ------------------------------------------------------------

const enderecoVazio = (): EnderecoOrcamento => ({
  tipo: "coleta",
  sequencia: 1,
  endereco: "",
  cidade: "",
  uf: "",
  cep: "",
  contato: "",
  telefone: "",
  instrucoes: "",
  janelaInicio: "",
  janelaFim: "",
});

/**
 * Converte uma cotação (Fase 1) em um `Orcamento` completo e válido
 * para abrir o "Novo Orçamento Comercial" já pré-preenchido.
 */
export function montarOrcamentoDaCotacao(cotacao: CotacaoPublica): Orcamento {
  const dataEmissao = new Date().toISOString().split("T")[0];
  const detalhesMap = new Map(cotacao.detalhes.map((d) => [d.sequencia, d]));

  const enderecos: EnderecoOrcamento[] = cotacao.paradas.map((parada, idx) => {
    const detalhe = detalhesMap.get(parada.sequencia);
    const base = enderecoVazio();
    return {
      ...base,
      tipo: idx === 0 ? "coleta" : "entrega",
      sequencia: parada.sequencia,
      endereco: parada.endereco,
      cep: extrairCep(parada.endereco),
      contato: detalhe?.contato || "",
      telefone: "",
      instrucoes: detalhe
        ? [detalhe.numero ? `Nº ${detalhe.numero}` : "", detalhe.complemento, detalhe.observacoes]
            .filter(Boolean)
            .join(" · ")
        : "",
    };
  });

  if (enderecos.length === 0) enderecos.push(enderecoVazio());

  const janela = [
    cotacao.data_desejada
      ? `Data desejada: ${new Date(`${cotacao.data_desejada}T12:00:00`).toLocaleDateString("pt-BR")}`
      : "",
    cotacao.hora_desejada ? `Horário: ${cotacao.hora_desejada}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const preco = cotacao.metadata?.precificacao || null;
  const km = preco?.distancia_km ?? null;

  const observacoes = [
    `Cotação web (Fase 1) — cliente ${cotacao.nome_cliente || "não informado"}`,
    cotacao.telefone ? `WhatsApp: ${cotacao.telefone}` : "",
    preco ? `Valor calculado na cotação: R$ ${preco.valor.toFixed(2).replace(".", ",")}` : "",
    km ? `Distância estimada: ${km} km (${preco?.paradas || cotacao.paradas.length} paradas)` : "",
    preco?.rotulo_veiculo ? `Veículo sugerido: ${preco.rotulo_veiculo}` : "",
    janela,
    `ID da cotação: ${cotacao.id}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    id: String(Date.now()),
    numero: gerarNumeroOrcamento(),
    cliente: cotacao.nome_cliente || "",
    clienteCnpj: "",
    unidade: "São Paulo - Matriz",
    centroCusto: "",
    responsavel: "",
    dataEmissao,
    validade: "",
    tipoOperacao: "",
    modalidade: "esporadico",
    prioridade: "normal",
    pedidoInterno: cotacao.id,
    observacoesGerais: observacoes,
    status: "em_analise",
    enderecos,
    carga: {
      descricao: cotacao.carga_descricao || "",
      volumes: cotacao.carga_volumes ?? 0,
      peso: cotacao.carga_peso ?? 0,
      cubagem: 0,
      pallets: 0,
      valorDeclarado: 0,
      refrigerado: false,
      ajudante: false,
      fragil: false,
      empilhavel: false,
      risco: false,
      perigosa: false,
      controlada: false,
      observacoes: cotacao.carga_dimensoes
        ? `Dimensões estimadas: ${cotacao.carga_dimensoes}`
        : "",
      dimensoes: [],
    },
    veiculo: {
      tipo: preco?.tipo_veiculo || "",
      subcategoria: preco?.rotulo_veiculo || "",
      carroceria: "",
    },
    valores: {
      tabelaVinculada: preco?.tabela || "",
      valorBase: preco?.valor || 0,
      adicionais: 0,
      pedagio: 0,
      kmExcedente: preco?.formula?.kmExcedente || 0,
      ajudante: 0,
      devolucao: 0,
      reentrega: 0,
      descontos: 0,
      valorFinal: preco?.valor || 0,
      custoEstimado: 0,
      margemEstimada: 0,
      lucroEstimado: 0,
    },
    historico: [
      {
        data: new Date().toLocaleString("pt-BR"),
        acao: "Orçamento criado a partir de cotação pública (Fase 1)",
        usuario: "Site /cotacao-express",
      },
    ],
  };
}

// ------------------------------------------------------------
// CLIENTE AVULSO / MOBILE (cadastro automático cotação → OS)
// ------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `true` quando o valor é um UUID válido (a coluna `clientes.id`/`ordens_servico.cliente` é uuid). */
export function ehUuid(valor: string | null | undefined): boolean {
  return Boolean(valor && UUID_REGEX.test(valor.trim()));
}

const uidCliente = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/** Resolve o tenant do usuário autenticado (padrão OsMobile.resolverTenantId). */
async function resolverTenantIdCliente(): Promise<string | undefined> {
  try {
    const { data } = await supabase.rpc("current_tenant_id_safe");
    if (typeof data === "string" && data) return data;
  } catch {
    // segue para o fallback
  }
  try {
    const { data: authData } = await supabase.auth.getUser();
    const authUserId = authData?.user?.id;
    if (!authUserId) return undefined;
    const { data: vinculo } = await supabase
      .from("tenant_usuarios")
      .select("tenant_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    const tenantId = (vinculo as Record<string, unknown> | null)?.tenant_id;
    return typeof tenantId === "string" && tenantId ? tenantId : undefined;
  } catch {
    return undefined;
  }
}

export interface ResultadoClienteAvulso {
  clienteId: string | null;
  criado: boolean;
  erro?: string;
}

/**
 * Garante um cadastro de cliente a partir do Nome + WhatsApp da cotação
 * (Etapa 1 do wizard "Como posso te chamar?").
 *
 * 1) dedup por nome (`nome_fantasia`/`razao_social` ilike) → reusa;
 * 2) dedup por telefone/whatsapp → reusa;
 * 3) cria `clientes` no padrão OsMobile: id gerado no cliente, `status:
 *    "pre-cadastro"`, insert SEM `.select()` (RLS de SELECT pode ocultar a
 *    linha recém-criada) e tenant via `current_tenant_id_safe`.
 *
 * Nunca lança: em falha devolve `erro` com `clienteId: null` para o chamador
 * decidir se bloqueia ou segue com aviso.
 */
export async function garantirClienteAvulsoCotacao(input: {
  nome: string;
  telefone?: string | null;
  origem?: string;
}): Promise<ResultadoClienteAvulso> {
  const nome = (input.nome || "").trim();
  const telefone = (input.telefone || "").trim();
  const origem = input.origem || "Cotação Express";

  if (!nome) {
    return {
      clienteId: null,
      criado: false,
      erro: "Informe o nome do cliente para o cadastro automático.",
    };
  }

  // 1) Dedup por nome (ilike exato, um filtro por coluna — evita `.or()` com
  // vírgulas no valor).
  for (const coluna of ["nome_fantasia", "razao_social"] as const) {
    try {
      const { data } = await supabase
        .from("clientes")
        .select("id")
        .ilike(coluna, nome)
        .limit(1);
      const existente = Array.isArray(data) ? (data[0] as { id?: unknown } | undefined) : null;
      if (existente && ehUuid(String(existente.id))) {
        return { clienteId: String(existente.id), criado: false };
      }
    } catch {
      // segue para o próximo critério
    }
  }

  // 2) Dedup por telefone/whatsapp (mesmo número da cotação).
  if (telefone) {
    for (const coluna of ["telefone", "whatsapp"] as const) {
      try {
        const { data } = await supabase
          .from("clientes")
          .select("id")
          .eq(coluna, telefone)
          .limit(1);
        const existente = Array.isArray(data) ? (data[0] as { id?: unknown } | undefined) : null;
        if (existente && ehUuid(String(existente.id))) {
          return { clienteId: String(existente.id), criado: false };
        }
      } catch {
        // segue para o próximo critério
      }
    }
  }

  // 3) Criação — padrão OsMobile.salvarClienteRapido.
  try {
    const tenantId = await resolverTenantIdCliente();
    const novoId = uidCliente();
    const payload = toClienteInsert({
      razaoSocial: nome,
      nomeFantasia: nome,
      telefone: telefone || undefined,
      whatsapp: telefone || undefined,
      status: "pre-cadastro",
      origemComercial: origem,
      observacoes: `Cadastro automático via ${origem} - Requer Validação`,
      tenantId,
    });
    payload.id = novoId;

    const { error } = await supabase.from("clientes").insert([payload]);
    if (error) throw error;

    return { clienteId: novoId, criado: true };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return {
      clienteId: null,
      criado: false,
      erro: `Não foi possível cadastrar o cliente "${nome}": ${mensagem}`,
    };
  }
}
