// ───────────────────────────────────────────────────────────────────────────────
// PP-UX-02C1C — Regras de visibilidade das ações oficiais de prestador.
// Fonte única para a UI (PagamentoPrestadores) e para testes. Sem estado/IO.
//   reprovar   : status_conferencia=conferido e aguardando_aprovacao (e não pago/cancelado)
//   cancelar   : status_pagamento pendente | nao_vencido | em_lote
//   estornar   : status_pagamento pago (integral; parcial é bloqueado no backend)
// ───────────────────────────────────────────────────────────────────────────────
export interface EstadoAcoesPagamentoPrestador {
  status_conferencia?: string | null;
  status_aprovacao?: string | null;
  status_pagamento?: string | null;
}

const TERMINAIS = ["pago", "cancelado"];

export function podeReprovarPagamento(p: EstadoAcoesPagamentoPrestador): boolean {
  const conferido = p.status_conferencia === "conferido";
  const aguardando = p.status_aprovacao === "aguardando_aprovacao" || !p.status_aprovacao;
  const naoTerminal = !TERMINAIS.includes(p.status_pagamento ?? "");
  return conferido && aguardando && naoTerminal;
}

export function podeCancelarPagamento(p: EstadoAcoesPagamentoPrestador): boolean {
  return ["pendente", "nao_vencido", "em_lote"].includes(p.status_pagamento ?? "");
}

export function podeEstornarPagamento(p: EstadoAcoesPagamentoPrestador): boolean {
  return p.status_pagamento === "pago";
}
