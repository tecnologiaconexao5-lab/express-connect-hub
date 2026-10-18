// F0-H — Contas & Caixas: saldo real/projetado (funções puras e testáveis).
//   Saldo Real      = Saldo Inicial + Entradas Realizadas − Saídas Realizadas
//   Entradas/Saídas = financeiro_baixas (estornada = false) vinculadas à conta
//   Saldo Projetado = Saldo Real + Recebimentos Futuros − Pagamentos Futuros
// Vínculo: conta_financeira_id (ID real) com fallback textual (conta_financeira,
// conta_entrada, conta_pagadora) — compatível com registros antigos.

export interface ContaCaixaBase {
  id: string;
  nome: string;
  banco?: string | null;
  tipo?: string | null;
  saldo_inicial?: number | null;
  saldo_inicial_data?: string | null;
  ativa?: boolean;
  principal?: boolean;
}

export interface BaixaConta {
  conta_financeira_id?: string | null;
  conta_financeira?: string | null;
  valor_baixado: number;
  titulo_tabela: "financeiro_receber" | "financeiro_pagar";
  estornada: boolean;
}

export interface TituloFuturo {
  conta?: string | null; // conta_entrada (receber) / conta_pagadora (pagar)
  valor: number;
}

export interface SaldosConta {
  saldoInicial: number;
  entradasRealizadas: number;
  saidasRealizadas: number;
  saldoReal: number;
  saldoProjetado: number;
}

/** Vincula baixa/título à conta por ID real ou referência textual (nome/banco/tipo). */
export function contaCorresponde(
  conta: ContaCaixaBase,
  referenciaId?: string | null,
  referenciaTexto?: string | null
): boolean {
  if (referenciaId && referenciaId === conta.id) return true;
  const txt = (referenciaTexto || "").trim().toLowerCase();
  if (!txt) return false;
  const alvo = `${conta.nome} ${conta.banco || ""} ${conta.tipo || ""}`.toLowerCase();
  const nomeConta = conta.nome.toLowerCase();
  return alvo.includes(txt) || (nomeConta.length > 0 && txt.includes(nomeConta));
}

export function calcularSaldosConta(
  conta: ContaCaixaBase,
  baixasReceber: BaixaConta[],
  baixasPagar: BaixaConta[],
  recebimentosFuturos: TituloFuturo[],
  pagamentosFuturos: TituloFuturo[]
): SaldosConta {
  const saldoInicial = Number(conta.saldo_inicial) || 0;

  const somaBaixas = (baixas: BaixaConta[]) =>
    baixas
      .filter((b) => !b.estornada && contaCorresponde(conta, b.conta_financeira_id, b.conta_financeira))
      .reduce((acc, b) => acc + (Number(b.valor_baixado) || 0), 0);

  const entradasRealizadas = somaBaixas(baixasReceber);
  const saidasRealizadas = somaBaixas(baixasPagar);
  const saldoReal = saldoInicial + entradasRealizadas - saidasRealizadas;

  const somaFuturos = (titulos: TituloFuturo[]) =>
    titulos
      .filter((t) => contaCorresponde(conta, null, t.conta))
      .reduce((acc, t) => acc + (Number(t.valor) || 0), 0);

  const recebimentosFuturosSoma = somaFuturos(recebimentosFuturos);
  const pagamentosFuturosSoma = somaFuturos(pagamentosFuturos);
  const saldoProjetado = saldoReal + recebimentosFuturosSoma - pagamentosFuturosSoma;

  return {
    saldoInicial,
    entradasRealizadas,
    saidasRealizadas,
    saldoReal,
    saldoProjetado,
  };
}
