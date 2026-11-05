/**
 * GD-08 — Indicador de frescor do cadastro/lead.
 * Regra: < 30 dias = Lead Quente (verde); 30–90 dias = Recente (azul);
 * > 90 dias = Cadastro Antigo - Verificar Disponibilidade (âmbar).
 */
export type FrescorStatus = "quente" | "recente" | "antigo" | "desconhecido";

export interface FrescorCadastro {
  status: FrescorStatus;
  dias: number | null;
  label: string;
  className: string;
  titulo: string;
}

const DIA_MS = 24 * 60 * 60 * 1000;

export function calcularFrescorCadastro(data?: string | null): FrescorCadastro {
  if (!data) {
    return {
      status: "desconhecido",
      dias: null,
      label: "Data não informada",
      className: "border-slate-200 bg-slate-50 text-slate-500",
      titulo: "Não foi possível calcular a idade do cadastro.",
    };
  }

  const timestamp = new Date(data).getTime();
  if (Number.isNaN(timestamp)) {
    return {
      status: "desconhecido",
      dias: null,
      label: "Data inválida",
      className: "border-slate-200 bg-slate-50 text-slate-500",
      titulo: "Data de cadastro inválida.",
    };
  }

  const dias = Math.max(0, Math.floor((Date.now() - timestamp) / DIA_MS));

  if (dias < 30) {
    return {
      status: "quente",
      dias,
      label: "Lead Quente",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      titulo: `Cadastro com ${dias} dia(s) — dentro da janela de 30 dias.`,
    };
  }

  if (dias <= 90) {
    return {
      status: "recente",
      dias,
      label: "Recente",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      titulo: `Cadastro com ${dias} dia(s) — atualizado nos últimos 90 dias.`,
    };
  }

  return {
    status: "antigo",
    dias,
    label: "Cadastro Antigo - Verificar Disponibilidade",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    titulo: `Cadastro com ${dias} dia(s) — acima de 90 dias. Confirme a disponibilidade.`,
  };
}
