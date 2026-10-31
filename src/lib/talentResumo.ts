/**
 * Conexão Talent AI — resumo operacional do prestador.
 * Junta dados reais do cadastro + perfil de talento + disponibilidade em uma
 * única linha para leitura rápida no topo da ficha.
 */
export const MODALIDADE_LABEL: Record<string, string> = {
  esporadico: "Esporádico",
  contrato: "Contrato",
  rota_fixa: "Rota Fixa",
};

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface JanelaDisponibilidadeResumo {
  dia_semana?: number | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  disponivel?: boolean | null;
}

const formatarHora = (valor?: string | null): string => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(valor || "").trim());
  if (!m) return "";
  const h = String(Number(m[1])).padStart(2, "0");
  return m[2] === "00" ? `${h}h` : `${h}h${m[2]}`;
};

const formatarDias = (dias: number[]): string => {
  const ordenados = [...new Set(dias)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (ordenados.length === 0) return "";
  if (ordenados.length === 7) return "Todos os dias";
  const sequencia = ordenados.every((d, i) => i === 0 || d === ordenados[i - 1] + 1);
  if (sequencia && ordenados.length >= 3) {
    return `${DIAS_SEMANA[ordenados[0]]}-${DIAS_SEMANA[ordenados[ordenados.length - 1]]}`;
  }
  return ordenados.map((d) => DIAS_SEMANA[d]).join(", ");
};

const formatarJanelas = (janelas: JanelaDisponibilidadeResumo[]): string => {
  const intervalos = new Set<string>();
  for (const janela of janelas) {
    const inicio = formatarHora(janela.hora_inicio);
    const fim = formatarHora(janela.hora_fim);
    if (inicio && fim) intervalos.add(`${inicio}-${fim}`);
  }
  return [...intervalos].join(" / ");
};

export function montarResumoTalent(input: {
  veiculo?: string | null;
  regiao?: string | null;
  modalidades?: string[] | null;
  disponibilidade?: JanelaDisponibilidadeResumo[] | null;
}): string {
  const disponibilidade = Array.isArray(input.disponibilidade) ? input.disponibilidade : [];
  const ativas = disponibilidade.filter((d) => d?.disponivel !== false);

  const dias = ativas
    .map((d) => Number(d?.dia_semana))
    .filter((d) => Number.isFinite(d));

  const diasTexto = formatarDias(dias);
  const janelasTexto = formatarJanelas(ativas);
  const horarioTexto = [diasTexto, janelasTexto].filter(Boolean).join(" ");

  const modalidades = (input.modalidades || [])
    .map((m) => MODALIDADE_LABEL[m] || m)
    .filter(Boolean)
    .join("/");

  const partes = [
    String(input.veiculo || "").trim(),
    String(input.regiao || "").trim(),
    modalidades,
    horarioTexto,
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(" • ") : "Perfil operacional em construção";
}
