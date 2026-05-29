export interface KpisEscala {
  total: number;
  confirmadas: number;
  pendentes: number;
  emRota: number;
  finalizadas: number;
  canceladas: number;
}

const STATUS_CONFIRMADO = new Set(['confirmado', 'planejada', 'aceita', 'aguardando_aceite']);
const STATUS_PENDENTE = new Set(['pendente', 'aguardando', 'aguardando_aceite']);
const STATUS_ROTA = new Set(['operacao', 'em_rota', 'ocorrencia']);
const STATUS_FINALIZADA = new Set(['concluida']);
const STATUS_CANCELADO = new Set(['cancelado', 'cancelada', 'recusada']);

function normalizarStatus(status: unknown): string {
  if (!status || typeof status !== 'string') return 'pendente';
  const s = status.toLowerCase().trim();
  if (STATUS_CANCELADO.has(s)) return 'cancelado';
  if (s === 'concluida') return 'concluida';
  if (STATUS_ROTA.has(s)) return 'em_rota';
  if (STATUS_CONFIRMADO.has(s)) return 'confirmado';
  return 'pendente';
}

export function calcularKpisEscala(alocacoes: { status?: string }[]): KpisEscala {
  let confirmadas = 0;
  let pendentes = 0;
  let emRota = 0;
  let finalizadas = 0;
  let canceladas = 0;

  for (const aloc of alocacoes) {
    switch (normalizarStatus(aloc.status)) {
      case 'confirmado':
        confirmadas++;
        break;
      case 'pendente':
        pendentes++;
        break;
      case 'em_rota':
        emRota++;
        break;
      case 'concluida':
        finalizadas++;
        break;
      case 'cancelado':
        canceladas++;
        break;
    }
  }

  return {
    total: alocacoes.length,
    confirmadas,
    pendentes,
    emRota,
    finalizadas,
    canceladas,
  };
}
