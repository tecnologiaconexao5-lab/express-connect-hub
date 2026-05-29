export interface EventoTimeline {
  id: string;
  label: string;
  timestamp: string;
  done: boolean;
  icone: 'criada' | 'aceite' | 'recusa' | 'carregamento' | 'rota' | 'finalizada' | 'cancelada';
}

export interface DadosTimeline {
  status?: string;
  horarioInicio?: string;
  horarioFim?: string;
  tempoChegadaPatio?: string;
  tempoInicioCarregamento?: string;
  tempoFimCarregamento?: string;
  tempoSaidaRua?: string;
  tempoFinalizacaoEntregas?: string;
  observacao?: string;
}

const EVENTOS_FIXOS: { id: string; label: string; icone: EventoTimeline['icone']; verificar:
  (d: DadosTimeline) => { done: boolean; timestamp: string } }[] = [
  {
    id: 'criada',
    label: 'Alocação criada',
    icone: 'criada',
    verificar: () => ({ done: true, timestamp: '—' }),
  },
  {
    id: 'carregamento',
    label: 'Carregamento confirmado',
    icone: 'carregamento',
    verificar: (d) => {
      if (d.tempoInicioCarregamento && d.tempoFimCarregamento) {
        return { done: true, timestamp: `${d.tempoInicioCarregamento} - ${d.tempoFimCarregamento}` };
      }
      return { done: false, timestamp: '—' };
    },
  },
  {
    id: 'rota',
    label: 'Rota iniciada',
    icone: 'rota',
    verificar: (d) => {
      if (d.tempoSaidaRua) {
        return { done: true, timestamp: d.tempoSaidaRua };
      }
      return { done: false, timestamp: '—' };
    },
  },
  {
    id: 'finalizada',
    label: 'Finalizada',
    icone: 'finalizada',
    verificar: (d) => {
      if (d.tempoFinalizacaoEntregas) {
        return { done: true, timestamp: d.tempoFinalizacaoEntregas };
      }
      const statusFinal = d.status === 'concluida' || d.status === 'finalizada' || d.status === 'cancelada';
      return { done: statusFinal, timestamp: statusFinal ? '—' : '—' };
    },
  },
];

export function montarTimelineAlocacao(dados: DadosTimeline): EventoTimeline[] {
  const eventos: EventoTimeline[] = [];

  for (const evento of EVENTOS_FIXOS) {
    const { done, timestamp } = evento.verificar(dados);
    eventos.push({
      id: evento.id,
      label: evento.label,
      timestamp,
      done,
      icone: evento.icone,
    });
  }

  if (dados.status === 'cancelada' || dados.status === 'cancelado') {
    eventos.push({
      id: 'cancelada',
      label: 'Cancelada',
      timestamp: '—',
      done: true,
      icone: 'cancelada',
    });
  }

  return eventos;
}
