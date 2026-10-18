/**
 * FIN-P0-01 — Helper canônico de status efetivo por vencimento.
 *
 * Calcula o status visual de um título financeiro considerando:
 *   - status persistido no banco
 *   - data_vencimento
 *   - data de pagamento/recebimento (data_pagamento, data_baixa)
 *   - cancelamento
 *   - data civil atual em America/Sao_Paulo
 *
 * NÃO faz UPDATE no banco. Apenas retorna o status que a TELA deve exibir.
 */

export type StatusPersistido =
  | "pendente" | "aberto" | "a vencer" | "a_vencer"
  | "vencido" | "vencida" | "atrasado"
  | "pago" | "paga" | "recebido"
  | "parcial"
  | "provisao"
  | "cancelado" | "cancelada"
  | "renegociado"
  | null
  | undefined;

export type StatusEfetivo =
  | "atrasado"
  | "vence_hoje"
  | "a_vencer"
  | "pago"
  | "parcial"
  | "provisao"
  | "cancelado"
  | "renegociado"
  | "desconhecido";

/**
 * Retorna a data civil atual em America/Sao_Paulo no formato YYYY-MM-DD.
 * Evita problemas de offset UTC que mudam o dia.
 */
export function hojeSP(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/**
 * Converte string YYYY-MM-DD paraYYYY-MM-DD sem offset UTC.
 * Preserva o dia civil correto.
 */
export function parseDataLocal(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return null;
  return `${parts[0]}-${parts[1]}-${parts[2]}`;
}

/**
 * Compara duas datas YYYY-MM-DD por dia civil.
 * Retorna: -1 (a < b), 0 (a == b), 1 (a > b)
 */
export function compararDatas(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Calcula o status efetivo de um título financeiro.
 *
 * @param params.statusPersistido - status gravado no banco
 * @param params.dataVencimento - data de vencimento YYYY-MM-DD
 * @param params.dataPagamento - data de pagamento/baixa (null se não pago)
 * @param params.valorPago - valor já pago (null se não pago)
 * @param params.valorTotal - valor total do título
 * @param params.hoje - data atual YYYY-MM-DD (opcional, usa hojeSP() se omitido)
 * @returns StatusEfetivo
 */
export function calcularStatusEfetivo(params: {
  statusPersistido: StatusPersistido;
  dataVencimento: string | null | undefined;
  dataPagamento?: string | null | undefined;
  valorPago?: number | null | undefined;
  valorTotal?: number | null | undefined;
  hoje?: string;
}): StatusEfetivo {
  const {
    statusPersistido,
    dataVencimento,
    dataPagamento,
    valorPago,
    valorTotal,
    hoje: hojeParam,
  } = params;

  const hoje = hojeParam || hojeSP();
  const st = (statusPersistido || "").toLowerCase().trim();

  // ── Estados finais que NUNCA mudam por vencimento ──
  if (st === "cancelado" || st === "cancelada") return "cancelado";
  if (st === "renegociado") return "renegociado";

  // ── PAGO: se tem data_pagamento OU status é pago/paga/recebido ──
  if (st === "pago" || st === "paga" || st === "recebido") return "pago";
  if (dataPagamento) return "pago";

  // ── PARCIAL: se pagou parcialmente ──
  if (st === "parcial") {
    if (valorPago != null && valorTotal != null && valorPago > 0 && valorPago < valorTotal) {
      return "parcial";
    }
    return "parcial";
  }

  // ── PROVISÃO: sem data de vencimento ou provisão explícita ──
  if (st === "provisao") return "provisao";

  // ── Sem data de vencimento: manter status original ──
  if (!dataVencimento) {
    if (st === "pago" || st === "paga") return "pago";
    return "desconhecido";
  }

  const venc = parseDataLocal(dataVencimento);
  if (!venc) return "desconhecido";

  // ── Lógica por data de vencimento ──
  const diff = compararDatas(venc, hoje);

  if (diff < 0) {
    // vencimento < hoje → ATRASADO (qualquer status aberto/pendente)
    return "atrasado";
  }

  if (diff === 0) {
    // vencimento == hoje → VENCE HOJE
    return "vence_hoje";
  }

  // diff > 0 → vencimento futuro
  return "a_vencer";
}

/**
 * Label legível para exibição.
 */
export function statusEfetivoLabel(status: StatusEfetivo): string {
  const labels: Record<StatusEfetivo, string> = {
    atrasado: "Atrasado",
    vence_hoje: "Vence Hoje",
    a_vencer: "A Vencer",
    pago: "Pago",
    parcial: "Parcial",
    provisao: "Provisão",
    cancelado: "Cancelado",
    renegociado: "Renegociado",
    desconhecido: "—",
  };
  return labels[status] || "—";
}

/**
 * Classes CSS para badge de status efetivo.
 */
export function statusEfetivoClasses(status: StatusEfetivo): string {
  const classes: Record<StatusEfetivo, string> = {
    atrasado:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300",
    vence_hoje:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
    a_vencer:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
    pago:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
    parcial:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
    provisao:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300",
    cancelado:
      "bg-gray-100 text-gray-500 border-gray-200",
    renegociado:
      "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
    desconhecido:
      "bg-slate-100 text-slate-500 border-slate-200",
  };
  return classes[status] || classes.desconhecido;
}
