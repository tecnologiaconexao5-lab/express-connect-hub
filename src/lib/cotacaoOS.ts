/**
 * Metadados de OS originadas pela Cotação Express:
 * - agendamento solicitado pelo cliente (data/hora da Fase 1);
 * - nome do cliente quando a linha traz apenas o uuid/observação.
 */
export interface AgendamentoClienteOS {
  agendada: boolean;
  data: string;
  hora: string;
  /** "30/10/2026 às 14:00" (ou "Horário a confirmar"). */
  dataHora: string;
}

const formatarData = (valor: string): string => {
  const texto = valor.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return texto;
};

export function obterAgendamentoClienteOS(entrada: {
  carga?: unknown;
  observacoes?: string | null;
}): AgendamentoClienteOS {
  const carga =
    entrada.carga && typeof entrada.carga === "object"
      ? (entrada.carga as Record<string, unknown>)
      : {};

  let data = String(carga.data_desejada || carga.dataDesejada || "").trim();
  let hora = String(carga.hora_desejada || carga.horaDesejada || "").trim();
  let agendada = Boolean(carga.agendado) || Boolean(data) || Boolean(hora);

  if (!data || !hora) {
    const obs = String(entrada.observacoes || "");
    const dataObs = obs.match(/Data desejada:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
    const horaObs = obs.match(
      /Hor[áa]rio:\s*([0-9]{2}:[0-9]{2}(?:\s*[àa]s\s*[0-9]{2}:[0-9]{2})?)/i,
    );
    if (!data && dataObs?.[1]) data = dataObs[1];
    if (!hora && horaObs?.[1]) hora = horaObs[1];
    if (data || hora) agendada = true;
  }

  if (data) data = formatarData(data);
  // Janela de horário ("09:00 às 11:00") não deve virar "às 09:00 às 11:00".
  const horarioEhJanela = /\d{1,2}:\d{2}\s*[àa]s\s*\d{1,2}:\d{2}/i.test(hora);
  const dataHora = [data, hora].filter(Boolean).join(horarioEhJanela ? " · " : " às ");

  return {
    agendada,
    data,
    hora,
    dataHora: dataHora || (agendada ? "Horário a confirmar" : ""),
  };
}

/** Nome do cliente da cotação extraído de `observacoes_gerais` (fallback). */
export function clienteNomeDaCotacaoOS(observacoes?: string | null): string {
  const match = String(observacoes || "").match(/cliente\s+([^·|]+)/i);
  return match?.[1]?.trim() || "";
}
