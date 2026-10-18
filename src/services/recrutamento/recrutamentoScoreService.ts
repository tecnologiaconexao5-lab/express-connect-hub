export interface CandidatoScoreInput {
  tempoMedioRespostaHoras?: number | null
  statusDocumental?: string
  quantidadeCobrancas?: number
  stage?: string
  compareceuPrimeiroDia?: boolean
  completou30Dias?: boolean
  quantidadeReclamacoes?: number
  historicoDesistencias?: number
  possuiOutraOperacaoFixa?: boolean
  disponibilidadeRecrutamento?: string
  confirmouInteresse?: boolean
  confirmouPreInicio?: boolean
  questionarioRespostas?: Record<string, string> | null
}

export interface ParecerOperacional {
  parecer: string
  riscos: string[]
  pontosPositivos: string[]
  proximaAcao: string
}

function safeNum(val?: number | null): number {
  return val ?? 0
}

function safeBool(val?: boolean): boolean {
  return val ?? false
}

export function calcularScoreComprometimento(candidato: CandidatoScoreInput): number | null {
  // REC-06.2D.2F — estágio vazio comporta-se como contato_inicial (etapa inicial).
  const stage = candidato.stage || "contato_inicial"

  if (stage === "reprovado") return -1

  const aplicaveis: Record<string, string[]> = {
    // REC-06.2D.2F — cobertura completa dos estágios canônicos do Kanban,
    // reutilizando os mesmos conjuntos de fatores (sem fórmula nova).
    novo_cadastro: ["historicoDesistencias", "quantidadeReclamacoes"],
    contato_inicial: ["historicoDesistencias", "quantidadeReclamacoes"],
    prospeccao: ["historicoDesistencias", "quantidadeReclamacoes"],
    em_validacao: ["documentacao", "historicoDesistencias", "quantidadeReclamacoes"],
    em_analise: ["documentacao", "tempo", "confirmacao", "disponibilidade", "historicoDesistencias", "quantidadeReclamacoes"],
    em_treinamento: ["documentacao", "confirmacao", "disponibilidade", "tempo", "comparecimento", "historicoDesistencias", "quantidadeReclamacoes"],
    homologacao: ["documentacao", "confirmacao", "disponibilidade", "tempo", "comparecimento", "permanencia", "historicoDesistencias", "quantidadeReclamacoes"],
    aprovado: ["documentacao", "confirmacao", "disponibilidade", "tempo", "comparecimento", "permanencia", "historicoDesistencias", "quantidadeReclamacoes"],
    prestador_apto: ["documentacao", "confirmacao", "disponibilidade", "tempo", "comparecimento", "permanencia", "historicoDesistencias", "quantidadeReclamacoes"],
    ativo: ["documentacao", "confirmacao", "disponibilidade", "tempo", "comparecimento", "permanencia", "historicoDesistencias", "quantidadeReclamacoes"],
    operacao_ativa: ["documentacao", "confirmacao", "disponibilidade", "tempo", "comparecimento", "permanencia", "historicoDesistencias", "quantidadeReclamacoes"],
  }

  const fatores = aplicaveis[stage]
  if (!fatores) return null

  let pontosObtidos = 0
  let pontosAplicaveis = 0

  if (fatores.includes("documentacao")) {
    pontosAplicaveis += 25
    if (candidato.statusDocumental === "completo" && (candidato.quantidadeCobrancas ?? 0) === 0) pontosObtidos += 25
    else if (candidato.statusDocumental === "completo") pontosObtidos += 15
    else if (candidato.statusDocumental && candidato.statusDocumental !== "completo") pontosObtidos += 5
  }

  if (fatores.includes("confirmacao")) {
    pontosAplicaveis += 15
    if (candidato.confirmouInteresse) pontosObtidos += 15
  }

  if (fatores.includes("disponibilidade")) {
    pontosAplicaveis += 15
    if (candidato.disponibilidadeRecrutamento === "integral") pontosObtidos += 15
    else if (candidato.disponibilidadeRecrutamento === "parcial") pontosObtidos += 8
  }

  if (fatores.includes("tempo")) {
    pontosAplicaveis += 15
    const horas = candidato.tempoMedioRespostaHoras
    if (horas !== null && horas !== undefined && horas > 0) {
      if (horas <= 24) pontosObtidos += 15
      else if (horas <= 48) pontosObtidos += 10
      else if (horas <= 72) pontosObtidos += 5
    }
  }

  if (fatores.includes("comparecimento")) {
    pontosAplicaveis += 10
    if (candidato.compareceuPrimeiroDia) pontosObtidos += 10
  }

  if (fatores.includes("permanencia")) {
    pontosAplicaveis += 10
    if (candidato.completou30Dias) pontosObtidos += 10
  }

  if (fatores.includes("historicoDesistencias")) {
    pontosAplicaveis += 5
    if ((candidato.historicoDesistencias ?? 0) === 0) pontosObtidos += 5
  }

  if (fatores.includes("quantidadeReclamacoes")) {
    pontosAplicaveis += 5
    if ((candidato.quantidadeReclamacoes ?? 0) === 0) pontosObtidos += 5
  }

  if (pontosAplicaveis === 0) return null

  const score = Math.round((pontosObtidos / pontosAplicaveis) * 100)
  return Math.max(0, Math.min(100, score))
}

export function classificarComprometimento(score: number | null): string {
  if (score === null) return "Dados insuficientes"
  if (score === -1) return "Reprovado"
  if (score >= 80) return "Excelente"
  if (score >= 65) return "Bom"
  if (score >= 50) return "Regular"
  if (score >= 30) return "Baixo"
  return "Crítico"
}

export function getCorClassificacao(classificacao: string): string {
  switch (classificacao) {
    case "Excelente": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    case "Bom": return "text-blue-400 bg-blue-500/10 border-blue-500/30"
    case "Regular": return "text-amber-400 bg-amber-500/10 border-amber-500/30"
    case "Baixo": return "text-orange-400 bg-orange-500/10 border-orange-500/30"
    case "Crítico": return "text-rose-400 bg-rose-500/10 border-rose-500/30"
    case "Reprovado": return "text-rose-400 bg-rose-500/10 border-rose-500/30"
    case "Dados insuficientes": return "text-muted-foreground bg-muted/10 border-muted/30"
    default: return "text-muted-foreground bg-muted/10 border-muted/30"
  }
}

export function calcularRiscoDesistencia(_candidato: CandidatoScoreInput): string {
  const fatores: string[] = [];

  if (safeNum(_candidato.historicoDesistencias) > 0) fatores.push("historico_desistencia");

  return fatores.length >= 2 ? "Moderado" : "Baixo";
}

export function gerarEtiquetasAutomaticas(_candidato: CandidatoScoreInput): string[] {
  const etiquetas: string[] = [];

  if (_candidato.stage && ["em_treinamento", "homologacao", "aprovado", "ativo", "prestador_apto", "operacao_ativa"].includes(_candidato.stage)) {
    etiquetas.push("Em Processo");
  }
  if (safeBool(_candidato.confirmouInteresse)) {
    etiquetas.push("Interesse Confirmado");
  }

  return etiquetas;
}

export function gerarParecerOperacional(candidato: CandidatoScoreInput): ParecerOperacional {
  const riscos: string[] = [];
  const pontosPositivos: string[] = [];

  if (safeNum(candidato.historicoDesistencias) > 0) riscos.push("Histórico de desistências anteriores");
  if (safeNum(candidato.tempoMedioRespostaHoras) > 72) riscos.push("Tempo de resposta elevado");
  if (candidato.statusDocumental && candidato.statusDocumental !== "completo") riscos.push("Documentação não regularizada");
  if (!safeBool(candidato.confirmouInteresse)) riscos.push("Não confirmou interesse na vaga");

  if (safeNum(candidato.tempoMedioRespostaHoras) > 0 && safeNum(candidato.tempoMedioRespostaHoras) <= 24) pontosPositivos.push("Responde rapidamente às comunicações");
  if (candidato.statusDocumental === "completo") pontosPositivos.push("Documentação completa e regularizada");
  if (safeBool(candidato.completou30Dias)) pontosPositivos.push("Completou 30 dias de operação com sucesso");
  if (safeBool(candidato.compareceuPrimeiroDia)) pontosPositivos.push("Compareceu ao primeiro dia");
  if (candidato.disponibilidadeRecrutamento === "integral") pontosPositivos.push("Disponibilidade integral");
  if (safeBool(candidato.confirmouInteresse)) pontosPositivos.push("Interesse confirmado na vaga");

  let parecer = "Candidato em análise. Recomenda-se consultar a Central IA para recomendação detalhada baseada nas regras operacionais configuradas no painel administrativo.";

  let proximaAcao = "";
  if (!safeBool(candidato.confirmouInteresse)) proximaAcao = "Realizar contato para confirmação de interesse na vaga";
  else if (candidato.statusDocumental && candidato.statusDocumental !== "completo") proximaAcao = "Solicitar documentação pendente com urgência";
  else if (!safeBool(candidato.compareceuPrimeiroDia)) proximaAcao = "Agendar e confirmar data de início da operação";
  else if (!safeBool(candidato.completou30Dias)) proximaAcao = "Monitorar primeiros 30 dias de operação; realizar check-in semanal";
  else proximaAcao = "Manter acompanhamento padrão; candidato estabilizado na operação";

  return { parecer, riscos, pontosPositivos, proximaAcao };
}

export const recrutamentoScoreService = {
  calcularScoreComprometimento,
  classificarComprometimento,
  getCorClassificacao,
  calcularRiscoDesistencia,
  gerarEtiquetasAutomaticas,
  gerarParecerOperacional,
}
