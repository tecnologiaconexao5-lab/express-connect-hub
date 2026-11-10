/**
 * Formatação de datas exibidas nas listagens e detalhes do sistema (pt-BR).
 *
 * Colunas `date` do Postgres chegam como "YYYY-MM-DD". O construtor `new Date("YYYY-MM-DD")`
 * interpreta a string em UTC, então no fuso America/Sao_Paulo (UTC-3) a exibição via
 * `toLocaleDateString("pt-BR")` mostraria o DIA ANTERIOR. Datas puras são formatadas
 * aqui sem passar por Date; timestamps completos usam SEMPRE o fuso America/Sao_Paulo.
 */
export const FUSO_BR = "America/Sao_Paulo";

/** Offset fixo do Brasil (sem horário de verão desde 2019). */
const OFFSET_BR = "-03:00";

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
    return new Date(`${somenteData[1]}-${somenteData[2]}-${somenteData[3]}T12:00:00${OFFSET_BR}`);
  }

  // Datetime sem fuso (com espaço ou "T", fração de 1 a 6 dígitos).
  const naive = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.(\d{1,6}))?$/.exec(texto);
  if (naive) {
    const fracao = naive[3] ? `.${naive[3].slice(0, 3).padEnd(3, "0")}` : "";
    return new Date(`${naive[1]}T${naive[2]}${fracao}${OFFSET_BR}`);
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
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

/** Hora (HH:mm) sempre no fuso America/Sao_Paulo. */
export function formatarHoraBR(valor?: string | null): string {
  const data = parseDataHoraSP(valor);
  if (!data) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

/** Data + hora no fuso America/Sao_Paulo (timestamps UTC do Supabase). */
export function formatarDataHoraBR(valor?: string | null): string {
  const data = parseDataHoraSP(valor);
  if (!data) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
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
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(data)
    .replace(",", " ·");
}

/**
 * Agora no fuso America/Sao_Paulo, como datetime NAIVE (`YYYY-MM-DDTHH:mm:ss`),
 * para gravar em colunas `timestamp without time zone` (ex.: `ordens_servico.created_at`).
 *
 * Gravar `new Date().toISOString()` (UTC) nessa coluna fazia a tela somar +3h
 * (17:37 local virava 20:37). Aqui o valor já sai no horário local de São Paulo.
 */
export function agoraSaoPauloISO(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

/** "Hoje" no fuso America/Sao_Paulo (YYYY-MM-DD) — comparações de colunas `date`. */
export function hojeISOSP(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Data local (fuso do navegador) no formato "YYYY-MM-DD" — para campos <input type="date"> e colunas `date`. */
export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Extrai apenas "YYYY-MM-DD" de uma data/timestamp, para usar em <input type="date">. */
export function paraInputDate(valor?: string | null): string {
  if (!valor) return "";
  const texto = String(valor).trim();
  const somenteData = /^(\d{4}-\d{2}-\d{2})/.exec(texto);
  if (somenteData) return somenteData[1];

  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return "";
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
