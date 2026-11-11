/**
 * Formatação de datas exibidas nas listagens e detalhes do sistema (pt-BR).
 *
 * Toda conversão visual é feita com `date-fns-tz` para America/Sao_Paulo.
 * Colunas `date` do Postgres chegam como "YYYY-MM-DD" e são formatadas por
 * string (nunca deslocam o dia). Timestamps (`with`/`without time zone`)
 * passam por `parseDataHoraSP` e são exibidos SEMPRE no fuso de São Paulo.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const FUSO_BR = "America/Sao_Paulo";

/**
 * Converte uma data/hora persistida num `Date` real no fuso America/Sao_Paulo.
 *
 * - `timestamp with time zone` (ISO com `Z`/offset) → instante preservado.
 * - `timestamp without time zone` (ex.: `ordens_servico.created_at`) → o valor
 *   É o horário local de São Paulo; interpretar como UTC deslocaria a exibição.
 * - data pura (`YYYY-MM-DD`) → meio-dia local (nunca desloca o dia).
 */
export function parseDataHoraSP(valor?: string | null): Date | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;

  const somenteData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (somenteData) {
    return fromZonedTime(
      `${somenteData[1]}-${somenteData[2]}-${somenteData[3]}T12:00:00`,
      FUSO_BR,
    );
  }

  // Datetime sem fuso (com espaço ou "T", fração de 1 a 6 dígitos).
  const naive = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.(\d{1,6}))?$/.exec(texto);
  if (naive) {
    const fracao = naive[3] ? `.${naive[3].slice(0, 3).padEnd(3, "0")}` : "";
    return fromZonedTime(`${naive[1]}T${naive[2]}${fracao}`, FUSO_BR);
  }

  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function formatarDataBR(valor?: string | null): string {
  if (valor === undefined || valor === null) return "";
  const texto = String(valor).trim();
  if (!texto) return "";

  const somenteData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (somenteData) {
    const [, ano, mes, dia] = somenteData;
    return `${dia}/${mes}/${ano}`;
  }

  const data = parseDataHoraSP(texto);
  if (!data) return "";
  return formatInTimeZone(data, FUSO_BR, "dd/MM/yyyy");
}

/** Hora (HH:mm) sempre no fuso America/Sao_Paulo. */
export function formatarHoraBR(valor?: string | null): string {
  const data = parseDataHoraSP(valor);
  if (!data) return "";
  return formatInTimeZone(data, FUSO_BR, "HH:mm");
}

/** Data + hora no fuso America/Sao_Paulo (timestamps UTC do Supabase). */
export function formatarDataHoraBR(valor?: string | null): string {
  const data = parseDataHoraSP(valor);
  if (!data) return "";
  return formatInTimeZone(data, FUSO_BR, "dd/MM/yyyy, HH:mm");
}

/**
 * Data + hora de uma solicitação, no padrão exibido na operação:
 * "01/11/2026 às 14h30" (timestamp vazio/inválido → "").
 */
export function formatarDataHoraSolicitacaoBR(valor?: string | null): string {
  const base = formatarDataHoraBR(valor);
  if (!base) return "";
  return base.replace(", ", " às ").replace(/:([0-9]{2})$/, "h$1");
}

/** Data + hora curta: "dd/MM · HH:mm" (hoje) ou "dd/MM · HH:mm" (sempre SP). */
export function formatarDataHoraCurtaSP(valor?: string | null): string {
  const data = parseDataHoraSP(valor);
  if (!data) return "";
  return formatInTimeZone(data, FUSO_BR, "dd/MM, HH:mm").replace(", ", " ·");
}

/**
 * Agora no fuso America/Sao_Paulo, como datetime NAIVE (`YYYY-MM-DDTHH:mm:ss`),
 * para gravar em colunas `timestamp without time zone` (ex.: `ordens_servico.created_at`).
 *
 * Gravar `new Date().toISOString()` (UTC) nessa coluna fazia a tela somar +3h
 * (17:37 local virava 20:37). Aqui o valor já sai no horário local de São Paulo.
 */
export function agoraSaoPauloISO(): string {
  return formatInTimeZone(new Date(), FUSO_BR, "yyyy-MM-dd'T'HH:mm:ss");
}

/** "Hoje" no fuso America/Sao_Paulo (YYYY-MM-DD) — comparações de colunas `date`. */
export function hojeISOSP(): string {
  return formatInTimeZone(new Date(), FUSO_BR, "yyyy-MM-dd");
}

/** "Hoje" no fuso America/Sao_Paulo — para campos <input type="date"> e colunas `date`. */
export function hojeISO(): string {
  return hojeISOSP();
}

/** Extrai apenas "YYYY-MM-DD" (no fuso SP) de uma data/timestamp, para <input type="date">. */
export function paraInputDate(valor?: string | null): string {
  if (!valor) return "";
  const texto = String(valor).trim();
  const somenteData = /^(\d{4}-\d{2}-\d{2})/.exec(texto);
  if (somenteData) return somenteData[1];

  const data = parseDataHoraSP(texto);
  if (!data) return "";
  return formatInTimeZone(data, FUSO_BR, "yyyy-MM-dd");
}
