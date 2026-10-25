// ============================================================
// MISSÃO COTACAO-EXPRESS — service público de cotações
// Fonte única de leitura/escrita de `cotacoes_publicas`.
//
// Fluxo em 2 fases (CRO: baixa fricção inicial → dados completos
// só depois da aprovação do valor no WhatsApp):
//   FASE 1 (/cotacao-express)             → status 'Pendente'
//   aprovação + "Gerar Link da Fase 2"    → status 'Aguardando Detalhes'
//   FASE 2 (/cotacao-express/detalhes/:id) → status 'Pronto para OS'
//
// REGRA DE OURO: toda escrita/anonima passa por aqui e SEMPRE
// filtra por .eq("id", id) — nunca varre a tabela inteira.
// ============================================================
import { supabase } from "@/lib/supabase";
import type { Orcamento, EnderecoOrcamento } from "@/components/comercial/types";

export const TABELA_COTACOES = "cotacoes_publicas";
export const MAX_PARADAS_COTACAO = 8;

export type StatusCotacao = "Pendente" | "Aguardando Detalhes" | "Pronto para OS";

export interface ParadaCotacao {
  sequencia: number;
  tipo: "retirada" | "entrega";
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
  data_desejada: string;
  hora_desejada: string;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** Monta as paradas da Fase 1 (1ª = retirada, demais = entrega). */
export function montarParadasFase1(enderecos: string[]): ParadaCotacao[] {
  return enderecos
    .map((endereco, idx) => ({
      sequencia: idx + 1,
      tipo: (idx === 0 ? "retirada" : "entrega") as ParadaCotacao["tipo"],
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

// ------------------------------------------------------------
// FASE 1 — criação (INSERT anônimo)
// ------------------------------------------------------------

export async function criarCotacaoFase1(
  input: CriarCotacaoFase1Input,
): Promise<ResultadoCotacao<string>> {
  const paradas = montarParadasFase1(input.paradas);
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
        status: "Pendente",
        nome_cliente: input.nome_cliente.trim(),
        telefone: input.telefone.trim(),
        carga_descricao: input.carga_descricao.trim(),
        carga_peso: input.carga_peso,
        carga_dimensoes: input.carga_dimensoes.trim() || null,
        paradas,
        data_desejada: input.data_desejada || null,
        hora_desejada: input.hora_desejada || null,
        detalhes: [],
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
  if (!data) return { ok: false, erro: erroDe("Nenhuma cotação vinculada.") };
  return { ok: true, dado: normalizarCotacao(data) };
}

function normalizarCotacao(row: Record<string, unknown>): CotacaoPublica {
  const paradas = Array.isArray(row.paradas) ? (row.paradas as ParadaCotacao[]) : [];
  const detalhes = Array.isArray(row.detalhes) ? (row.detalhes as DetalheParadaCotacao[]) : [];
  return {
    id: String(row.id),
    status: (row.status as StatusCotacao) || "Pendente",
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

  const observacoes = [
    `Cotação web (Fase 1) — cliente ${cotacao.nome_cliente || "não informado"}`,
    cotacao.telefone ? `WhatsApp: ${cotacao.telefone}` : "",
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
    veiculo: { tipo: "", subcategoria: "", carroceria: "" },
    valores: {
      tabelaVinculada: "",
      valorBase: 0,
      adicionais: 0,
      pedagio: 0,
      kmExcedente: 0,
      ajudante: 0,
      devolucao: 0,
      reentrega: 0,
      descontos: 0,
      valorFinal: 0,
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
