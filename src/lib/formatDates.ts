/**
 * Formatação de datas exibidas nas listagens e detalhes do sistema (pt-BR).
 *
 * Colunas `date` do Postgres chegam como "YYYY-MM-DD". O construtor `new Date("YYYY-MM-DD")`
 * interpreta a string em UTC, então no fuso America/Sao_Paulo (UTC-3) a exibição via
 * `toLocaleDateString("pt-BR")` mostraria o DIA ANTERIOR. Datas puras são formatadas
 * aqui sem passar por Date; timestamps completos usam SEMPRE o fuso America/Sao_Paulo.
 */
export const FUSO_BR = "America/Sao_Paulo";

export function formatarDataBR(valor?: string | null): string {
  if (valor === undefined || valor === null) return "";
  const texto = String(valor).trim();
  if (!texto) return "";

  const somenteData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (somenteData) {
    const [, ano, mes, dia] = somenteData;
    return `${dia}/${mes}/${ano}`;
  }

  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

/** Data + hora no fuso America/Sao_Paulo (timestamps UTC do Supabase). */
export function formatarDataHoraBR(valor?: string | null): string {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
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
