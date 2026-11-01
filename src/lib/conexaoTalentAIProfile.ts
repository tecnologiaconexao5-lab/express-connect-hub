/**
 * Conexão Talent AI — Perfil Operacional Automático (Etapa 7).
 *
 * Processa preferências operacionais (perfil de talento + disponibilidade)
 * e respostas situacionais (avaliações + treinamentos) para gerar um
 * resumo operacional automático estruturado com insights, competências,
 * restrições e recomendações — tudo baseado em dados reais, sem mock.
 */
import { calcularCategoriaPerformance, type CategoriaPerformance } from "./performancePrestador";
import { MODALIDADE_LABEL, type JanelaDisponibilidadeResumo } from "./talentResumo";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface PerfilOperacionalInput {
  veiculo?: string | null;
  regiao?: string | null;
  modalidades?: string[] | null;
  distanciaMaxColetaKm?: string | number | null;
  aceitaViagens?: boolean | null;
  restricoesOperacionais?: string | null;
  statusDisponibilidade?: string | null;
}

export type DisponibilidadeInput = JanelaDisponibilidadeResumo;

export interface AvaliacaoSituacionalInput {
  competencia?: string | null;
  pontuacao?: number | null;
  cenarioTitulo?: string | null;
}

export interface TreinamentoInput {
  curso?: string | null;
  dataConclusao?: string | null;
  validade?: string | null;
}

export interface PerformanceInput {
  totalEntregas?: number | null;
  pontualidade?: number | null;
  ocorrencias?: number | null;
  isCandidato?: boolean | null;
}

export interface InsightOperacional {
  icone: string;
  label: string;
  valor: string;
  tom: "positivo" | "neutro" | "atencao" | "critico";
}

export interface CompetenciaAvaliada {
  nome: string;
  nivel: "forte" | "adequado" | "desenvolver" | "nao_avaliado";
  pontuacao: number | null;
}

export interface ResumoOperacionalAutomatico {
  /** Uma linha consolidada para exibição rápida (substitui montarResumoTalent). */
  resumoLinha: string;
  /** Frase de recomendação gerada pela IA baseada nos dados. */
  recomendacao: string;
  /** Indicadores estruturados para cards. */
  insights: InsightOperacional[];
  /** Competências avaliadas nos cenários situacionais. */
  competencias: CompetenciaAvaliada[];
  /** Restrições operacionais extraídas do JSON. */
  restricoes: string[];
  /** Alertas operacionais gerados automaticamente. */
  alertas: string[];
  /** Categoria de performance da Regra 12. */
  performance: CategoriaPerformance;
  /** Score de performance (null = amostra insuficiente). */
  performanceScore: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NIVEIS_COMPETENCIA = {
  forte: { min: 8, label: "Forte" },
  adequado: { min: 5, label: "Adequado" },
  desenvolver: { min: 0, label: "Desenvolver" },
} as const;

function classificarCompetencia(pontuacao: number | null): CompetenciaAvaliada["nivel"] {
  if (pontuacao === null || pontuacao === undefined || !Number.isFinite(pontuacao)) return "nao_avaliado";
  if (pontuacao >= NIVEIS_COMPETENCIA.forte.min) return "forte";
  if (pontuacao >= NIVEIS_COMPETENCIA.adequado.min) return "adequado";
  return "desenvolver";
}

function parseRestricoes(json: string | null | undefined): string[] {
  if (!json || !json.trim()) return [];
  try {
    const obj = JSON.parse(json);
    if (typeof obj !== "object" || obj === null) return [];
    return Object.entries(obj)
      .filter(([, v]) => v === true || v === "true" || (typeof v === "string" && v.trim()))
      .map(([k, v]) => {
        const chave = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        if (v === true || v === "true") return chave;
        return `${chave}: ${String(v)}`;
      });
  } catch {
    return [json.trim()];
  }
}

function formatarJanelasDisponibilidade(janelas: DisponibilidadeInput[]): string {
  const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const ativas = janelas.filter((j) => j?.disponivel !== false);
  const dias = [...new Set(ativas.map((j) => Number(j?.dia_semana)).filter((d) => Number.isFinite(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  const horas = new Set<string>();
  for (const j of ativas) {
    const ini = String(j?.hora_inicio || "").slice(0, 5);
    const fim = String(j?.hora_fim || "").slice(0, 5);
    if (ini && fim) horas.add(`${ini}-${fim}`);
  }
  const diasTxt = dias.length === 7 ? "Todos os dias" : dias.map((d) => DIAS[d]).join(", ");
  const horasTxt = [...horas].join(" / ");
  return [diasTxt, horasTxt].filter(Boolean).join(" ");
}

// ─── Função principal ────────────────────────────────────────────────────────

export function gerarResumoOperacionalAutomatico(input: {
  perfil: PerfilOperacionalInput;
  disponibilidade?: DisponibilidadeInput[] | null;
  avaliacoes?: AvaliacaoSituacionalInput[] | null;
  treinamentos?: TreinamentoInput[] | null;
  performance?: PerformanceInput | null;
}): ResumoOperacionalAutomatico {
  const { perfil, disponibilidade = [], avaliacoes = [], treinamentos = [], performance: perfInput = {} } = input;

  // Performance (Regra 12)
  const perf = calcularCategoriaPerformance(perfInput || {});

  // Insights operacionais
  const insights: InsightOperacional[] = [];

  // Veículo
  const veiculo = String(perfil.veiculo || "").trim();
  if (veiculo) {
    insights.push({ icone: "truck", label: "Veículo", valor: veiculo, tom: "neutro" });
  }

  // Região
  const regiao = String(perfil.regiao || "").trim();
  if (regiao) {
    insights.push({ icone: "map-pin", label: "Região", valor: regiao, tom: "neutro" });
  }

  // Modalidades
  const modalidades = (perfil.modalidades || []).map((m) => MODALIDADE_LABEL[m] || m).filter(Boolean);
  if (modalidades.length > 0) {
    insights.push({ icone: "layers", label: "Modalidades", valor: modalidades.join(", "), tom: "positivo" });
  }

  // Distância máxima
  const distKm = perfil.distanciaMaxColetaKm !== null && perfil.distanciaMaxColetaKm !== undefined && String(perfil.distanciaMaxColetaKm).trim() !== ""
    ? Number(perfil.distanciaMaxColetaKm)
    : null;
  if (distKm !== null && Number.isFinite(distKm) && distKm > 0) {
    insights.push({ icone: "navigation", label: "Distância máx.", valor: `${distKm} km`, tom: "neutro" });
  }

  // Viagens
  if (perfil.aceitaViagens === true) {
    insights.push({ icone: "plane", label: "Viagens", valor: "Aceita fora da região", tom: "positivo" });
  } else if (perfil.aceitaViagens === false) {
    insights.push({ icone: "plane", label: "Viagens", valor: "Somente região base", tom: "atencao" });
  }

  // Disponibilidade
  const janelasTexto = formatarJanelasDisponibilidade(disponibilidade || []);
  if (janelasTexto) {
    insights.push({ icone: "clock", label: "Disponibilidade", valor: janelasTexto, tom: "positivo" });
  }

  // Status disponibilidade
  const STATUS_LABEL: Record<string, string> = {
    disponivel: "Disponível",
    em_operacao: "Em Operação",
    indisponivel: "Indisponível",
  };
  const statusDisp = perfil.statusDisponibilidade ? STATUS_LABEL[perfil.statusDisponibilidade] || perfil.statusDisponibilidade : null;
  if (statusDisp) {
    const tom: InsightOperacional["tom"] = perfil.statusDisponibilidade === "disponivel" ? "positivo" : perfil.statusDisponibilidade === "indisponivel" ? "critico" : "neutro";
    insights.push({ icone: "radio", label: "Status App", valor: statusDisp, tom });
  }

  // Performance (Regra 12)
  insights.push({
    icone: "award",
    label: "Performance",
    valor: perf.categoria + (perf.score !== null ? ` (${perf.score})` : ""),
    tom: perf.amostraInsuficiente ? "atencao" : perf.categoria === "Diamante" || perf.categoria === "Ouro" ? "positivo" : "neutro",
  });

  // Entregas reais
  if (perf.totalEntregas > 0) {
    insights.push({ icone: "package", label: "Entregas", valor: `${perf.totalEntregas}`, tom: "positivo" });
  }

  // Treinamentos
  const treinamentosValidos = (treinamentos || []).filter((t) => t?.curso);
  if (treinamentosValidos.length > 0) {
    insights.push({ icone: "graduation-cap", label: "Treinamentos", valor: `${treinamentosValidos.length} concluído(s)`, tom: "positivo" });
  }

  // Competências avaliadas
  const competencias: CompetenciaAvaliada[] = (avaliacoes || []).map((av) => ({
    nome: String(av?.competencia || av?.cenarioTitulo || "Competência"),
    nivel: classificarCompetencia(av?.pontuacao ?? null),
    pontuacao: av?.pontuacao ?? null,
  }));

  // Restrições
  const restricoes = parseRestricoes(perfil.restricoesOperacionais);

  // Alertas automáticos
  const alertas: string[] = [];
  if (perf.amostraInsuficiente) {
    alertas.push("Sem amostra operacional real — performance em desenvolvimento (Regra 12).");
  }
  if (perfil.statusDisponibilidade === "indisponivel") {
    alertas.push("Prestador marcado como indisponível no App.");
  }
  if (competencias.some((c) => c.nivel === "desenvolver")) {
    const fortes = competencias.filter((c) => c.nivel === "desenvolver").map((c) => c.nome);
    alertas.push(`Competências a desenvolver: ${fortes.join(", ")}.`);
  }
  if (restricoes.length > 0) {
    alertas.push(`${restricoes.length} restrição(ões) operacional(is) ativa(s).`);
  }

  // Resumo linha
  const partesResumo = [veiculo, regiao, modalidades.join("/"), janelasTexto].filter(Boolean);
  const resumoLinha = partesResumo.length > 0 ? partesResumo.join(" • ") : "Perfil operacional em construção";

  // Recomendação
  let recomendacao: string;
  if (perf.amostraInsuficiente && competencias.length === 0 && treinamentosValidos.length === 0) {
    recomendacao = "Candidato em avaliação inicial. Completar cadastro e aguardar primeiras operações para gerar score de performance.";
  } else if (perf.amostraInsuficiente && (competencias.length > 0 || treinamentosValidos.length > 0)) {
    recomendacao = "Perfil com qualificações iniciais. Liberar para operações supervisionadas e reavaliar após 5 entregas.";
  } else if (perf.categoria === "Diamante" || perf.categoria === "Ouro") {
    recomendacao = "Alta performance operacional. Priorizar para rotas de alta prioridade e contratos exclusivos.";
  } else if (perf.categoria === "Prata") {
    recomendacao = "Performance consistente. Aptos para operações regulares com monitoramento contínuo.";
  } else if (perf.categoria === "Bronze") {
    recomendacao = "Performance em desenvolvimento. Recomendado treinamento complementar e rotas mais simples.";
  } else {
    recomendacao = "Perfil em construção. Coletar mais dados operacionais antes de definir rota recomendada.";
  }

  return {
    resumoLinha,
    recomendacao,
    insights,
    competencias,
    restricoes,
    alertas,
    performance: perf.categoria,
    performanceScore: perf.score,
  };
}
