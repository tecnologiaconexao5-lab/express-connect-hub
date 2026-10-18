// ═══════════════════════════════════════════════════════════════════════════
// AG-07F + AG-07H — GATE ÚNICO DE ELEGIBILIDADE OPERACIONAL / ESCALA
// Um prestador só é operacionalmente elegível quando:
//  1) status está autorizado (ativo/aprovado);            [gate duro — ag-07f]
//  2) liberado_app = true;                                 [gate duro — ag-07f]
//  3) veículo elegível quando a operação exigir veículo;   [ag-07f]
//  4) documentação obrigatória válida/aplicável.           [ag-07h]
//
// Robustez: o gate usa APENAS colunas confirmadas no contrato para o bloco
// duro (prestadores.status, prestadores.liberado_app). A verificação documental
// e de CNH é BEST-EFFORT: se o schema de documentos_prestadores (status/
// validade/cnh_validade) não estiver disponível em Produção, NÃO bloqueia
// (fail-open), mantendo a operação viva — documentado como dependência.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";

/** Status que autorizam operação (normalizados em minúsculas). */
export const STATUS_AUTORIZADOS = new Set<string>(["ativo", "aprovado"]);

/** Status que bloqueiam operação (para documentação/testes). */
export const STATUS_BLOQUEADOS = new Set<string>([
  "analise",
  "em_analise",
  "inativo",
  "bloqueado",
  "reprovado",
  "cancelado",
  "pendente",
  "interessado",
]);

/** Status documental que NÃO bloqueia (aprovado/válido/regular). */
export const STATUS_DOCUMENTAL_VALIDO = new Set<string>([
  "valido",
  "aprovado",
  "regular",
  "ativo",
]);

/** Tipos documentais obrigatórios para qualquer prestador operacional. */
export const DOCS_OBRIGATORIOS = ["CNH", "Comprovante de Endereço", "Comprovante de Residência"] as const;

/** CNH reconhecida por estes tipos. */
const TIPOS_CNH = new Set(["CNH Frente", "CNH Verso", "CNH"]);

/** Documento do veículo (exigido apenas quando o prestador possui veículo). */
const TIPOS_VEICULO_DOC = new Set(["CRLV", "Documento do Veículo"]);

export type MotivoInelegibilidade =
  | "prestador_nao_encontrado"
  | "status_nao_autorizado"
  | "liberado_app_false"
  | "veiculo_inelegivel"
  | "tipo_veiculo_incompativel"
  | "documento_obrigatorio_invalido"
  | "documento_vencido"
  | "cnh_invalida"
  | "capacidade_peso_insuficiente"
  | "capacidade_cubagem_insuficiente"
  | "requisito_refrigerado_nao_atendido"
  | "ajudante_obrigatorio_ausente";

// ═══════════════════════════════════════════════════════════════════════════
// AG-07I-B1 / B1.1 — NORMALIZAÇÃO DE TIPO DE VEÍCULO
// Regra conservadora: tipos diferentes são incompatíveis até existir
// regra explícita comprovada no contrato.
//
// "outro" NÃO é wildcard — só é compatível com "outro".
// van ≠ kombi (specs diferentes: tiposVeiculo.ts, cargaService.ts).
// passeio ≠ outro (categoria genérica vs específica).
// ═══════════════════════════════════════════════════════════════════════════

/** Nenhuma equivalência global — match exato para todos os tipos. */
const EQUIVALENCIAS_TIPO: Record<string, string[]> = {};

/** Normaliza string de tipo para comparação (minúsculas, trim). */
function normalizarTipoVeiculo(tipo?: string | null): string {
  return String(tipo || "").toLowerCase().trim();
}

export interface ResultadoElegibilidade {
  elegivel: boolean;
  motivo?: MotivoInelegibilidade;
  detalhe?: string;
}

interface DadosPrestadorElegibilidade {
  status?: string | null;
  liberado_app?: boolean | null;
}

/**
 * Regra pura de elegibilidade a partir dos campos reais do prestador.
 * Nenhuma consulta — fácil de testar.
 */
export function prestadorOperacionalmenteElegivelDados(p: DadosPrestadorElegibilidade): ResultadoElegibilidade {
  if (!p) return { elegivel: false, motivo: "prestador_nao_encontrado", detalhe: "Prestador não informado" };
  const status = String(p.status || "").toLowerCase().trim();
  if (!STATUS_AUTORIZADOS.has(status)) {
    return {
      elegivel: false,
      motivo: "status_nao_autorizado",
      detalhe: `Status "${String(p.status || "")}" não autorizado para operação`,
    };
  }
  if (p.liberado_app !== true) {
    return {
      elegivel: false,
      motivo: "liberado_app_false",
      detalhe: "liberado_app=false — prestador não liberado para o App/operação",
    };
  }
  return { elegivel: true };
}

/** Classifica o status de um documento em "bloqueia" ou "ok". */
export function documentoBloqueia(status?: string | null, validade?: string | null): boolean {
  const s = String(status || "").toLowerCase().trim();
  if (STATUS_DOCUMENTAL_VALIDO.has(s) || s === "") return false;
  if (s === "vencido") return true;
  if (s === "reprovado") return true;
  if (s === "pendente" || s === "em_analise" || s === "enviado" || s === "validando") return true;
  return false;
}

/** CNH vencida pelo campo validade. */
export function documentoVencido(validade?: string | null): boolean {
  if (!validade) return false;
  const d = new Date(String(validade));
  return !Number.isNaN(d.getTime()) && d < new Date();
}

/**
 * Regra pura documental (testável), dado um array de documentos.
 * Regra de segurança ("não bloquear errado"):
 *  - prestador SEM nenhum documento cadastrado (legado/não migrado) → ELEGÍVEL
 *    (não é possível comprovar; fail-open para não derrubar operação).
 *  - prestador QUE JÁ PARTICIPA do fluxo documental (≥1 documento) → exige
 *    obrigatórios válidos; bloqueia rejeitado/vencido/faltante.
 * Documentos opcionais/ausentes não bloqueiam.
 */
export function prestadorDocumentalmenteElegivel(docs: Array<{ tipo?: string; status?: string | null; validade?: string | null }>): ResultadoElegibilidade {
  const lista = (docs || []).filter((d) => String(d.tipo || "").trim());
  if (lista.length === 0) return { elegivel: true, detalhe: "documento_indisponivel" };

  const porTipo = new Map<string, { status?: string | null; validade?: string | null }>();
  for (const d of lista) {
    const t = String(d.tipo || "").trim().toLowerCase();
    if (!porTipo.has(t)) porTipo.set(t, d);
  }
  const get = (tipos: string[]) => {
    for (const t of tipos) {
      const found = porTipo.get(t.toLowerCase());
      if (found) return found;
    }
    return undefined;
  };

  // CNH — obrigatória e válida
  const cnh = get([...TIPOS_CNH]);
  if (!cnh) {
    return { elegivel: false, motivo: "cnh_invalida", detalhe: "CNH pendente (documento não enviado)" };
  }
  if (documentoVencido(cnh.validade)) {
    return { elegivel: false, motivo: "documento_vencido", detalhe: "CNH vencida" };
  }
  if (documentoBloqueia(cnh.status, cnh.validade)) {
    return {
      elegivel: false,
      motivo: "documento_obrigatorio_invalido",
      detalhe: `CNH ${cnh.status ? `"${cnh.status}"` : "sem status de aprovação"}`,
    };
  }

  // Comprovante de residência — obrigatório quando participa do fluxo
  if (!get(["comprovante de endereço", "comprovante de residência"])) {
    return { elegivel: false, motivo: "documento_obrigatorio_invalido", detalhe: "Comprovante de residência pendente" };
  }

  return { elegivel: true };
}

/**
 * Verifica a elegibilidade documental consultando documentos_prestadores.
 * BEST-EFFORT: se a consulta falhar (colunas indisponíveis em Produção), NÃO
 * bloqueia (fail-open) — retorna um resultado elegível com nota estrutural.
 */
export async function verificarElegibilidadeDocumental(
  prestadorId: string | null | undefined,
  opts: { temVeiculo?: boolean } = {}
): Promise<ResultadoElegibilidade> {
  if (!prestadorId) return { elegivel: true };
  try {
    const { data } = await supabase
      .from("documentos_prestadores")
      .select("tipo, status, validade")
      .eq("prestador_id", prestadorId);
    const docs = (data || []) as Array<{ tipo?: string; status?: string | null; validade?: string | null }>;

    const resultado = prestadorDocumentalmenteElegivel(docs);
    if (!resultado.elegivel) return resultado;

    // Se o prestador possui veículo, CRLV/documento do veículo é obrigatório.
    if (opts.temVeiculo && !docs.some((d) => TIPOS_VEICULO_DOC.has(String(d.tipo || "").trim()))) {
      return {
        elegivel: false,
        motivo: "documento_obrigatorio_invalido",
        detalhe: "Documento do veículo pendente (CRLV)",
      };
    }

    return { elegivel: true };
  } catch (e) {
    // Schema documental indisponível → não bloquear (dependência estrutural).
    console.warn("[Elegibilidade] documento não verificável (schema):", e);
    return { elegivel: true, detalhe: "documento_indisponivel" };
  }
}

/**
 * Verifica a elegibilidade operacional de um prestador no banco.
 * Bloco duro usa colunas confirmadas (status, liberado_app).
 * Documento/CNH : best-effort — nunca derruba a operação se o schema faltar.
 */
export async function verificarElegibilidadeOperacionalPrestador(
  prestadorId: string | null | undefined
): Promise<ResultadoElegibilidade> {
  if (!prestadorId) return { elegivel: false, motivo: "prestador_nao_encontrado", detalhe: "Prestador não informado" };

  // Bloco duro — somente colunas confirmadas no contrato.
  const { data } = await supabase
    .from("prestadores")
    .select("status, liberado_app")
    .eq("id", prestadorId)
    .maybeSingle();
  if (!data) return { elegivel: false, motivo: "prestador_nao_encontrado", detalhe: "Prestador inexistente" };

  const base = prestadorOperacionalmenteElegivelDados(data);
  if (!base.elegivel) return base;

  // Bloco documental (best-effort).
  const doc = await verificarElegibilidadeDocumental(prestadorId);
  if (!doc.elegivel) return doc;

  // CNH via cnh_validade (campo opcional — se não existir, não bloqueia).
  try {
    const { data: cnhData } = await supabase
      .from("prestadores")
      .select("cnh_validade")
      .eq("id", prestadorId)
      .maybeSingle();
    if (cnhData?.cnh_validade) {
      const cnhDate = new Date(String(cnhData.cnh_validade));
      if (!Number.isNaN(cnhDate.getTime()) && cnhDate < new Date()) {
        return { elegivel: false, motivo: "documento_vencido", detalhe: "CNH vencida (cnh_validade)" };
      }
    }
  } catch {
    /* coluna cnh_validade pode não existir — não bloquear */
  }

  return { elegivel: true };
}

/**
 * Verifica compatibilidade entre o tipo de veículo exigido pela OS e o tipo
 * real do veículo/prestador. Regra pura (testável sem banco).
 *
 *  - Se tipoExigido estiver vazio → ELEGÍVEL (ausência de informação = sem restrição).
 *  - Se tipoVeiculo estiver vazio → INELEGÍVEL (prestador sem veículo informado).
 *  - Caso contrário: compara usando equivalências comprovadas.
 */
export function tipoVeiculoCompativel(
  tipoExigido?: string | null,
  tipoVeiculo?: string | null
): ResultadoElegibilidade {
  const exigido = normalizarTipoVeiculo(tipoExigido);
  const real = normalizarTipoVeiculo(tipoVeiculo);

  // OS não exige tipo específico → não bloquear.
  if (!exigido) return { elegivel: true };

  // Prestador sem veículo informado → incompatível.
  if (!real) {
    return {
      elegivel: false,
      motivo: "tipo_veiculo_incompativel",
      detalhe: `Tipo exigido "${exigido}" — prestador sem veículo informado`,
    };
  }

  // Verificar equivalência exata.
  if (exigido === real) return { elegivel: true };

  // Verificar grupo de equivalência.
  const grupo = EQUIVALENCIAS_TIPO[exigido];
  if (grupo && grupo.includes(real)) return { elegivel: true };

  return {
    elegivel: false,
    motivo: "tipo_veiculo_incompativel",
    detalhe: `Tipo exigido "${exigido}" é incompatível com veículo "${real}"`,
  };
}

/**
 * Verifica compatibilidade de tipo consultando a OS no banco.
 * BEST-EFFORT: se a OS não existir ou não tiver veiculo_tipo → fail-open.
 */
export async function verificarCompatibilidadeTipoVeiculo(
  osId?: string | null,
  tipoVeiculo?: string | null
): Promise<ResultadoElegibilidade> {
  if (!osId) return { elegivel: true };
  try {
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("veiculo_tipo")
      .eq("id", osId)
      .maybeSingle();
    const tipoExigido = os?.veiculo_tipo;
    return tipoVeiculoCompativel(tipoExigido, tipoVeiculo);
  } catch {
    // Schema ou query falhou → fail-open.
    return { elegivel: true, detalhe: "compatibilidade_tipo_indisponivel" };
  }
}

/**
 * Verifica se o veículo (placa) é elegível para operação.
 * Regra já utilizada pela Escala (veiculos.status).
 */
export async function verificarElegibilidadeVeiculo(placa: string | null | undefined): Promise<ResultadoElegibilidade> {
  if (!placa) return { elegivel: true };
  const { data: veiculo } = await supabase
    .from("veiculos")
    .select("status")
    .eq("placa", placa)
    .maybeSingle();
  if (veiculo && (veiculo.status === "manutencao" || veiculo.status === "inativo" || veiculo.status === "indisponivel")) {
    return { elegivel: false, motivo: "veiculo_inelegivel", detalhe: `Veículo ${placa} está ${veiculo.status}` };
  }
  return { elegivel: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// AG-07I-B2 — BLOQUEIO POR CAPACIDADE KG / M³
// Comparação entre capacidade do veículo (veiculos) e carga da OS (ordens_servico).
// Regra: quando AMBOS existem e são > 0, exige capacidade >= carga.
// Quando ausentes (null/0): fail-open — não bloqueia.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Regra pura de capacidade (testável sem banco).
 *
 * @param pesoOs        — peso exigido pela OS (kg). null/0 = ausente → não aplica.
 * @param capacidadeKg  — capacidade do veículo (kg). null/0 = ausente → não aplica.
 * @param cubagemOs     — cubagem exigida pela OS (m³). null/0 = ausente → não aplica.
 * @param capacidadeM3  — capacidade do veículo (m³). null/0 = ausente → não aplica.
 *
 * Regras:
 *  - Ambos os campos de peso existentes e > 0: pesoOs <= capacidadeKg → OK, caso contrário INELEGÍVEL.
 *  - Ambos os campos de cubagem existentes e > 0: cubagemOs <= capacidadeM3 → OK, caso contrário INELEGÍVEL.
 *  - Se qualquer campo estiver ausente/zero: não aplica essa dimensão (fail-open).
 *  - Moto com capacidade null: não bloqueia (campo estrutural ausente).
 */
export function capacidadeVeiculoCompativel(
  pesoOs: number | null | undefined,
  capacidadeKg: number | null | undefined,
  cubagemOs: number | null | undefined,
  capacidadeM3: number | null | undefined
): ResultadoElegibilidade {
  const peso = Number(pesoOs) || 0;
  const capKg = Number(capacidadeKg) || 0;
  const cubo = Number(cubagemOs) || 0;
  const capM3 = Number(capacidadeM3) || 0;

  // Regra de peso: ambos existem e > 0
  if (peso > 0 && capKg > 0) {
    if (peso > capKg) {
      return {
        elegivel: false,
        motivo: "capacidade_peso_insuficiente",
        detalhe: `Carga (${peso} kg) excede capacidade do veículo (${capKg} kg)`,
      };
    }
  }

  // Regra de cubagem: ambos existem e > 0
  if (cubo > 0 && capM3 > 0) {
    if (cubo > capM3) {
      return {
        elegivel: false,
        motivo: "capacidade_cubagem_insuficiente",
        detalhe: `Cubagem (${cubo} m³) excede capacidade do veículo (${capM3} m³)`,
      };
    }
  }

  return { elegivel: true };
}

/**
 * Verifica capacidade do veículo × OS no banco.
 * BEST-EFFORT: se OS ou veículo não existir ou não tiver dados → fail-open.
 */
export async function verificarCapacidadeVeiculo(
  osId?: string | null,
  placa?: string | null
): Promise<ResultadoElegibilidade> {
  if (!osId || !placa) return { elegivel: true };
  try {
    const [osResult, veicResult] = await Promise.all([
      supabase.from("ordens_servico").select("peso, cubagem").eq("id", osId).maybeSingle(),
      supabase.from("veiculos").select("capacidade_kg, capacidade_m3").eq("placa", placa).maybeSingle(),
    ]);
    const os = osResult.data;
    const veic = veicResult.data;
    if (!os || !veic) return { elegivel: true, detalhe: "capacidade_indisponivel" };

    return capacidadeVeiculoCompativel(os.peso, veic.capacidade_kg, os.cubagem, veic.capacidade_m3);
  } catch {
    return { elegivel: true, detalhe: "capacidade_indisponivel" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AG-07I-B3 — BLOQUEIO REFRIGERADO / TÉRMICO / TEMPERATURA
//
// Fonte oficial do requisito operacional:
//   ordens_servico.carga_refrigerada (boolean) — precedência primária
//   ordens_servico.veiculo_termica (text) — fallback ("refrigerado"/"seco")
//   Rede: os.carga_refrigerada ? "refrigerado" : (os.veiculo_termica || "seco")
//
// Fonte oficial da capacidade térmica do veículo:
//   veiculos.tipo_carga (text) — "seco" / "refrigerado"
//
// Temperatura (min/max):
//   veiculos.temperatura_min/max existem.
//   OS NÃO possui faixa estruturada → DEPENDÊNCIA ESTRUTURAL (não comparável).
// ═══════════════════════════════════════════════════════════════════════════

/** Fontes de status térmico consideradas "refrigerado" no veículo. */
const TIPOS_CARGA_REFRIGERADO = new Set(["refrigerado", "congelado", "termico", "térmico"]);

/**
 * Determina se a OPERAÇÃO exige veículo refrigerado/térmico.
 * Fonte: carga_refrigerada (boolean) com precedência sobre veiculo_termica (text).
 * Retorna true se a operação exige capacidade térmica.
 */
export function operacaoRequerRefrigerado(
  cargaRefrigerada?: boolean | null,
  veiculoTermica?: string | null
): boolean {
  if (cargaRefrigerada === true) return true;
  const termica = String(veiculoTermica || "").toLowerCase().trim();
  if (termica === "refrigerado" || termica === "congelado" || termica === "termico" || termica === "térmico") return true;
  return false;
}

/**
 * Determina se o VEÍCULO possui capacidade térmica (refrigerado/térmico).
 * Fonte: veiculos.tipo_carga (texto estruturado).
 */
export function veiculoPossuiCapacidadeTermica(tipoCargaVeiculo?: string | null): boolean {
  const tc = String(tipoCargaVeiculo || "").toLowerCase().trim();
  return TIPOS_CARGA_REFRIGERADO.has(tc);
}

/**
 * Regra pura de compatibilidade térmica (testável sem banco).
 *
 * @param operacaoRequerRefrig — se a OS exige refrigerado/térmico
 * @param tipoCargaVeiculo     — tipo_carga do veículo ("seco"/"refrigerado"/etc)
 *
 * Regras:
 *  - Operação NÃO exige refrigerado → ELEGÍVEL (veículo seco permitido).
 *  - Operação EXIGE refrigerado + veículo refrigerado/térmico → ELEGÍVEL.
 *  - Operação EXIGE refrigerado + veículo seco → INELEGÍVEL.
 *  - Operação EXIGE refrigerado + veículo sem info → INELEGÍVEL (não assumir compatível).
 */
export function refrigeradoCompativel(
  operacaoRequerRefrig: boolean,
  tipoCargaVeiculo?: string | null
): ResultadoElegibilidade {
  if (!operacaoRequerRefrig) return { elegivel: true };

  if (veiculoPossuiCapacidadeTermica(tipoCargaVeiculo)) {
    return { elegivel: true };
  }

  return {
    elegivel: false,
    motivo: "requisito_refrigerado_nao_atendido",
    detalhe: `Operação exige veículo refrigerado/térmico — veículo classificado como "${String(tipoCargaVeiculo || "seco")}"`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AG-07I-B5 — BLOQUEIO POR AJUDANTE OBRIGATÓRIO
//
// Fonte oficial do requisito operacional:
//   ordens_servico.carga_ajudante (boolean) — operação exige ajudante
//   rota_paradas.exige_ajudante (boolean) — parada exige ajudante para descarga
//
// Fonte da alocacao:
//   alocacoes_escala.ajudantes (integer) — quantidade de ajudantes alocados
//
// Regra: quando carga_ajudante=true E ajudantes=0 → BLOQUEADO.
// Quando carga_ajudante=false/null → não aplica (fail-open).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determina se a OPERAÇÃO exige ajudante.
 * Fonte: carga_ajudante (boolean) da OS.
 */
export function operacaoExigeAjudante(cargaAjudante?: boolean | null): boolean {
  return cargaAjudante === true;
}

/**
 * Regra pura de compatibilidade de ajudante (testável sem banco).
 *
 * @param operacaoExigeAjudante — se a OS exige ajudante
 * @param ajudantesAlocados     — quantidade de ajudantes alocados (0 = nenhum)
 *
 * Regras:
 *  - Operação NÃO exige ajudante → ELEGÍVEL.
 *  - Operação EXIGE ajudante + ajudantes > 0 → ELEGÍVEL.
 *  - Operação EXIGE ajudante + ajudantes = 0/null → INELEGÍVEL.
 */
export function ajudanteCompativel(
  operacaoExige: boolean,
  ajudantesAlocados?: number | null
): ResultadoElegibilidade {
  if (!operacaoExige) return { elegivel: true };

  const qtd = Number(ajudantesAlocados) || 0;
  if (qtd > 0) return { elegivel: true };

  return {
    elegivel: false,
    motivo: "ajudante_obrigatorio_ausente",
    detalhe: "Esta operação exige ajudante — nenhum ajudante alocado",
  };
}

/**
 * Verifica se a operação exige ajudante e se há ajudantes alocados.
 * BEST-EFFORT: se OS não existir ou não tiver campo → fail-open.
 */
export async function verificarAjudante(
  osId?: string | null,
  ajudantesAlocados?: number | null
): Promise<ResultadoElegibilidade> {
  if (!osId) return { elegivel: true };
  try {
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("carga_ajudante")
      .eq("id", osId)
      .maybeSingle();
    if (!os) return { elegivel: true, detalhe: "os_indisponivel_ajudante" };

    const requerAjudante = operacaoExigeAjudante(os.carga_ajudante);
    return ajudanteCompativel(requerAjudante, ajudantesAlocados);
  } catch {
    return { elegivel: true, detalhe: "ajudante_indisponivel" };
  }
}

/**
 * Verifica compatibilidade térmica consultando OS e veículo no banco.
 * BEST-EFFORT: se dados indisponíveis → fail-open.
 */
export async function verificarRefrigerado(
  osId?: string | null,
  placa?: string | null
): Promise<ResultadoElegibilidade> {
  if (!osId) return { elegivel: true };
  try {
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("carga_refrigerada, veiculo_termica")
      .eq("id", osId)
      .maybeSingle();
    if (!os) return { elegivel: true, detalhe: "os_indisponivel_refrigerado" };

    const requerRefrig = operacaoRequerRefrigerado(os.carga_refrigerada, os.veiculo_termica);
    if (!requerRefrig) return { elegivel: true };

    if (!placa) {
      return {
        elegivel: false,
        motivo: "requisito_refrigerado_nao_atendido",
        detalhe: "Operação exige refrigerado — veículo não informado",
      };
    }

    const { data: veic } = await supabase
      .from("veiculos")
      .select("tipo_carga")
      .eq("placa", placa)
      .maybeSingle();

    return refrigeradoCompativel(true, veic?.tipo_carga);
  } catch {
    return { elegivel: true, detalhe: "refrigerado_indisponivel" };
  }
}