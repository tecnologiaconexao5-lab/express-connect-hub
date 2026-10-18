// ═══════════════════════════════════════════════════════════════════════════
// AG-REC04 — CONSTANTES DOCUMENTAIS CENTRALIZADAS
//
// Cada lista é semanticamente distinta e serve a uma finalidade específica.
// NÃO misturar listas de recrutamento com listas operacionais.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A. CHECKLIST DE RECRUTAMENTO (UI — AcompanhamentoDocs)
 *
 * Itens exibidos como progresso visual na tela de acompanhamento.
 * NÃO é gate de elegibilidade — é apenas informativo.
 * Status: "aprovado" | "pendente" | "analise" (UI only).
 *
 * CLASSIFICAÇÃO POR FINALIDADE:
 * - CNH: Gate de conversão (B) E gate operacional (C) — obrigatório em ambos.
 * - CRLV: Gate de conversão (B) — obrigatório. Gate operacional (C) — condicional por veículo.
 * - ANTT: Apenas checklist visual (A) e opcional na conversão (B). NUNCA gate operacional.
 *   ANTT/RNTRC é exigido apenas para transporte intermunicipal/interestadual de carga
 *   (conforme Resolução ANTT 594/2017). Não é condição universal de elegibilidade.
 * - Comprovante Residência: Gate de conversão (B) E gate operacional (C) — obrigatório.
 * - Dados Bancários: APENAS checklist visual (A). NÃO é gate de conversão nem operacional.
 *   É dado cadastral/financeiro coletado no onboarding (StepDocuments.tsx) para fins de
 *   pagamento. Ausência não bloqueia elegibilidade documental nem operacional.
 */
export const CHECKLIST_RECRUTAMENTO = [
  { key: "cnh", label: "CNH", icon: "📱" },
  { key: "crlv", label: "CRLV", icon: "🚗" },
  { key: "antt", label: "ANTT", icon: "📋" },
  { key: "residencia", label: "Comprovante Residência", icon: "🏠" },
  { key: "bancario", label: "Dados Bancários", icon: "💳" },
] as const;

/**
 * B. GATE DOCUMENTAL PARA CONVERSÃO (enterpriseKanbanService)
 *
 * Documentos que devem estar com status "ok" no JSONB documentos[]
 * para que o candidato seja convertido via conversaoCandidatoService.
 * Gate: statusDocumental === 'completo'.
 *
 * ANTT é OPCIONAL — não bloqueia conversão. Motivo: ANTT/RNTRC é
 * exigido apenas para operação de carga intermunicipal/interestadual.
 * Muitos prestadores operam apenas dentro do estado sem necessidade.
 *
 * "Foto Veículo" é obrigatório para conversão mas NÃO para operação
 * (Checklist de recrutamento e gate operacional não incluem este item).
 * É verificação de elegibilidade documental do veículo no cadastro.
 */
export const DOCS_CONVERSAO_OBRIGATORIOS = [
  "CNH",
  "CRLV",
  "Comprovante Residência",
  "Foto Veículo",
] as const;

export const DOCS_CONVERSAO_OPCIONAIS = ["ANTT"] as const;

/**
 * C. GATE OPERACIONAL PARA LIBERAÇÃO (eligibilidadeOperacionalService)
 *
 * Documentos verificados em documentos_prestadores antes de liberar
 * operação (escala/alocação). FAIL-CLOSED: sem doc → bloqueado.
 *
 * CNH: Obrigatória. Qualquer variant (CNH Frente, CNH Verso, CNH) conta.
 * Comprovante de Endereço/Residência: Obrigatório (aceita ambos os nomes).
 * CRLV: CONDICIONAL — exigido apenas quando o prestador possui veículo próprio.
 *   Sem veículo → não bloqueia. Com veículo sem CRLV → bloqueia.
 * Dados Bancários: NÃO é gate operacional (é dado cadastral/financeiro).
 * ANTT: NÃO é gate operacional (exigido apenas para carga inter/interestadual).
 */
export const DOCS_OPERACAO_OBRIGATORIOS = [
  "CNH",
  "Comprovante de Endereço",
  "Comprovante de Residência",
] as const;

export const DOCS_OPERACAO_CONDICIONAIS = [
  { tipo: "CRLV", condicao: "prestador_possui_veiculo" },
  { tipo: "Documento do Veículo", condicao: "prestador_possui_veiculo" },
] as const;

/**
 * D. STATUS DOCUMENTAIS — classificação de bloqueio
 *
 * Status que NÃO bloqueiam (documento aceito).
 * Usado por elegibilidadeOperacionalService.documentoBloqueia().
 */
export const STATUS_DOCUMENTAL_VALIDO = new Set<string>([
  "valido",
  "aprovado",
  "regular",
  "ativo",
  "ok",
]);

/**
 * Status que BLOQUEIAM (documento rejeitado/pendente/vencido).
 * FAIL-CLOSED: qualquer um desses impede operação/conversão.
 */
export const STATUS_DOCUMENTAL_BLOQUEANTE = new Set<string>([
  "vencido",
  "reprovado",
  "pendente",
  "em_analise",
  "enviado",
  "validando",
]);

/**
 * E. TIPOS DOCUMENTAIS RECONHECIDOS
 *
 * Usado por documentosPrestadorService.TIPOS_DOCUMENTO_VALIDOS.
 * Centralizado aqui para consistência.
 */
export const TIPOS_DOCUMENTO = [
  "CNH",
  "CNH Frente",
  "CNH Verso",
  "CRLV",
  "Documento do Veículo",
  "ANTT",
  "RNTRC",
  "Comprovante de Residência",
  "Comprovante de Endereço",
  "Dados Bancários",
  "Foto Veículo",
] as const;

/**
 * Mapeamento de nomes de documentos para compatibilidade entre sistemas.
 * AcompanhamentoDocs usa keys (cnh, crlv, etc.).
 * candidato_documentos usa tipos (CNH, CRLV, etc.).
 * documentos_prestadores usa tipos (CNH Frente, CRLV, etc.).
 */
export const DOC_KEY_TO_TIPO: Record<string, string> = {
  cnh: "CNH",
  crlv: "CRLV",
  antt: "ANTT",
  residencia: "Comprovante de Residência",
  bancario: "Dados Bancários",
};

/**
 * Status do candidato que indica fase documental.
 * AcompanhamentoDocs filtra por este stage.
 */
export const STAGE_DOCUMENTACAO = "documentacao";

/**
 * Classificação de cada tabela documental.
 *
 * candidato_documentos É MANTIDA (não eliminada) porque possui campos
 * ausentes no JSONB recrutamento_candidatos.documentos:
 * - arquivo_url (referência ao arquivo no Storage)
 * - dados_extraidos (JSONB com dados extraídos por IA)
 * - analise_ia_id (FK para documento_analises)
 * O JSONB é apenas um resumo leve (nome, status, dataValidade, observacao).
 *
 * provider_documents é deprecated — documentos_prestadores é a fonte canônica.
 */
export const DOCUMENT_TABLE_ROLES = {
  documentos_prestadores: "canonica_operacional" as const,
  candidato_documentos: "recrutamento_legado_mantido" as const,
  provider_documents: "deprecated" as const,
  "recrutamento_candidatos.documentos": "metadata_jsonb_resumo" as const,
} as const;
