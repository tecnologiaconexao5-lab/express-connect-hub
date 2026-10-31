/**
 * Metadados de OS originadas pela Cotação Express:
 * - agendamento solicitado pelo cliente (data + janela de horário);
 * - nome do cliente quando a linha traz apenas o uuid/observação.
 */
export interface AgendamentoClienteOS {
  agendada: boolean;
  data: string;
  hora: string;
  /** Início da janela em HH:MM (vazio quando o cliente informou só um horário). */
  janelaInicio: string;
  /** Fim da janela em HH:MM. */
  janelaFim: string;
  /** "Das 14h às 16h" (vazio quando não há janela). */
  janela: string;
  /** "15/11/2026 · Das 14h às 16h" (ou "30/10/2026 às 14:30"). */
  dataHora: string;
}

const formatarData = (valor: string): string => {
  const texto = valor.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return texto;
};

const horaCurta = (valor: string): string => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(valor.trim());
  if (!m) return valor.trim();
  const h = Number(m[1]);
  const min = m[2];
  return min === "00" ? `${h}h` : `${h}h${min}`;
};

/** "09:00 às 11:00" / "Das 09:00 às 11:00" → { inicio: "09:00", fim: "11:00" }. */
export const extrairJanelaHorario = (
  texto: string | null | undefined,
): { inicio: string; fim: string } => {
  const valor = String(texto || "");
  const m = /(\d{1,2}):(\d{2})\s*(?:às|as|-|–|—)\s*(\d{1,2}):(\d{2})/i.exec(valor);
  if (!m) return { inicio: "", fim: "" };
  return {
    inicio: `${m[1].padStart(2, "0")}:${m[2]}`,
    fim: `${m[3].padStart(2, "0")}:${m[4]}`,
  };
};

/** "Das 14h às 16h" quando há início e fim. */
const montarJanela = (inicio: string, fim: string): string => {
  if (inicio && fim) return `Das ${horaCurta(inicio)} às ${horaCurta(fim)}`;
  if (inicio) return `A partir das ${horaCurta(inicio)}`;
  return "";
};

export function obterAgendamentoClienteOS(entrada: {
  carga?: unknown;
  observacoes?: string | null;
  /** Campo `observacao_agendamento` da OS (fallback legado). */
  observacaoAgendamento?: string | null;
}): AgendamentoClienteOS {
  const carga =
    entrada.carga && typeof entrada.carga === "object"
      ? (entrada.carga as Record<string, unknown>)
      : {};

  let data = String(carga.data_desejada || carga.dataDesejada || "").trim();
  let hora = String(carga.hora_desejada || carga.horaDesejada || "").trim();
  let janelaInicio = String(carga.janela_inicio || carga.janelaInicio || "").trim();
  let janelaFim = String(carga.janela_fim || carga.janelaFim || "").trim();
  const janelaTexto = String(carga.janela_horario || carga.janelaHorario || "").trim();

  // Janela gravada explicitamente pelo RPC (carga.janela_inicio/janela_fim).
  const janelaCarga = extrairJanelaHorario(janelaTexto || hora);
  if (!janelaInicio && janelaCarga.inicio) janelaInicio = janelaCarga.inicio;
  if (!janelaFim && janelaCarga.fim) janelaFim = janelaCarga.fim;

  let agendada =
    Boolean(carga.agendado) || Boolean(data) || Boolean(hora) || Boolean(janelaInicio);

  if (!data || (!hora && !janelaInicio)) {
    const obs = String(entrada.observacoes || "");
    const dataObs = obs.match(/Data desejada:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
    const horarioObs = obs.match(/(?:Hor[áa]rio|Agendamento):\s*([^·|\n]+)/i);
    if (!data && dataObs?.[1]) data = dataObs[1];
    if (!janelaInicio && horarioObs?.[1]) {
      const janelaObs = extrairJanelaHorario(horarioObs[1]);
      if (janelaObs.inicio) {
        janelaInicio = janelaObs.inicio;
        janelaFim = janelaFim || janelaObs.fim;
      } else if (!hora) {
        hora = horarioObs[1].trim();
      }
    }
    if (data || hora || janelaInicio) agendada = true;
  }

  // Fallback legado: observação de agendamento da OS.
  if (!janelaInicio && !hora && entrada.observacaoAgendamento) {
    const janelaLegado = extrairJanelaHorario(entrada.observacaoAgendamento);
    if (janelaLegado.inicio) {
      janelaInicio = janelaLegado.inicio;
      janelaFim = janelaLegado.fim;
      agendada = true;
    }
  }

  if (data) data = formatarData(data);
  const janela = montarJanela(janelaInicio, janelaFim);

  const dataHora = (() => {
    if (data && janela) return `${data} · ${janela}`;
    if (data && hora) return `${data} às ${hora}`;
    if (janela) return janela;
    if (hora) return data ? `${data} às ${hora}` : hora;
    return agendada ? "Horário a confirmar" : "";
  })();

  return {
    agendada,
    data,
    hora,
    janelaInicio,
    janelaFim,
    janela,
    dataHora,
  };
}

/** Nome do cliente da cotação extraído de `observacoes_gerais` (fallback). */
export function clienteNomeDaCotacaoOS(observacoes?: string | null): string {
  const match = String(observacoes || "").match(/cliente\s+([^·|]+)/i);
  return match?.[1]?.trim() || "";
}
