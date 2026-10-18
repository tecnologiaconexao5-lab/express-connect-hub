// ═══════════════════════════════════════════════════════════════════════════════
// FASE 2A — FUNDAÇÃO PROFISSIONAL DO FATURAMENTO
// faturaTypes.ts — Tipos TypeScript da entidade Fatura
// Espelham as tabelas `faturas` e `fatura_itens` (migration 20260816).
// ═══════════════════════════════════════════════════════════════════════════════

export type FaturaStatus =
  | "rascunho"
  | "aguardando_aprovacao"
  | "aprovada"
  | "emitida"
  | "cancelada";

export type ModeloFatura = "conexao_express" | "calvo";

export type FaturaItemStatus = "ativo" | "cancelado";

/** Fatura (cabeçalho) — documento comercial de cobrança ao cliente. */
export interface Fatura {
  id: string;
  tenant_id: string;
  /** Nº Conexão (global, FAT-YYYY-NNNNNN) — preenchido na emissão. */
  numero: string | null;
  /** Nº Cliente (sequencial histórico por cliente) — preenchido na emissão. */
  numero_cliente: number | null;
  cliente_id: string | null;
  modelo: ModeloFatura;
  descricao: string | null;
  data_emissao: string;
  competencia_inicio: string | null;
  competencia_fim: string | null;
  vencimento: string | null;
  valor_bruto: number;
  descontos: number;
  acrescimos: number;
  valor_total: number;
  status: FaturaStatus;
  observacao: string | null;
  observacao_fiscal: string | null;
  conta_receber_id: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_por: string | null;
  atualizado_em: string;
  cancelado_em: string | null;
  cancelado_por: string | null;
  motivo_cancelamento: string | null;
  metadata: Record<string, unknown>;
}

/** Item da Fatura — snapshot financeiro imutável do serviço (valores do CLIENTE). */
export interface FaturaItem {
  id: string;
  fatura_id: string;
  os_id: string | null;
  alocacao_id: string | null;
  cliente_id: string | null;
  romaneio: string | null;
  descricao: string | null;
  data_servico: string | null;
  valor_base: number;
  valor_adicionais: number;
  valor_descontos: number;
  valor_total: number;
  km_excedente: number;
  pedagio_cliente: number;
  ajudante_cliente: number;
  diaria_cliente: number;
  saidas_adicionais_cliente: number;
  status: FaturaItemStatus;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Input para criar um rascunho de Fatura. */
export interface CriarFaturaInput {
  cliente_id: string;
  modelo?: ModeloFatura;
  descricao?: string;
  data_emissao?: string;
  competencia_inicio?: string;
  competencia_fim?: string;
  vencimento?: string;
  observacao?: string;
  observacao_fiscal?: string;
}

/** Input para adicionar um item à Fatura (dados mínimos + snapshot do cliente). */
export interface AdicionarItemFaturaInput {
  fatura_id: string;
  os_id?: string | null;
  alocacao_id?: string | null;
  cliente_id?: string | null;
  romaneio?: string | null;
  descricao?: string | null;
  data_servico?: string | null;
  valor_base: number;
  valor_adicionais?: number;
  valor_descontos?: number;
  km_excedente?: number;
  pedagio_cliente?: number;
  ajudante_cliente?: number;
  diaria_cliente?: number;
  saidas_adicionais_cliente?: number;
}

export interface FaturaComItens extends Fatura {
  itens: FaturaItem[];
}
