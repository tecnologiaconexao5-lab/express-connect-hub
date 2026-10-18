// ═══════════════════════════════════════════════════════════════════════════════
// TMS-COM-CARGA-01/02 — Cubagem, peso cubado e recomendação de veículo.
// Fonte ÚNICA, pura e determinística (base para cálculo, UI e PDF).
//
// TMS-COM-CARGA-02:
//  - Fator de cubagem NÃO é hardcoded. É resolvido por configuração
//    (chave 'fator_cubagem_kg_m3'). Sem fator configurado, o PESO CUBADO não é
//    calculado (peso considerado = peso real) e a UI sinaliza a pendência.
//  - Recomendação e compatibilidade usam o catálogo REAL de capacidades
//    (VEICULO_PARAMETROS em @/constants/tiposVeiculo). NÃO inventa capacidade.
//  - Capacidade de pallets / restrição de carroceria não existem no catálogo →
//    registradas como pendência (não usadas como restrição).
// NÃO altera preço/frete. NÃO inventa capacidade/cubagem.
// ═══════════════════════════════════════════════════════════════════════════════
import { TIPOS_VEICULO, VEICULO_PARAMETROS } from "@/constants/tiposVeiculo";
import type { CargaOrcamento, DimensaoCarga } from "./types";

/**
 * TMS-COM-CARGA-04 — Regra parametrizável do fator de cubagem (kg/m³).
 * Fonte OFICIAL: configuracoes_sistema['fator_cubagem_regras'] (backend).
 * NÃO há fator padrão inventado. Precedência: específica da modalidade → padrão geral → sem fator.
 * Preparado para contexts específicos de provider (Fracionado) sem alterar a carga.
 */
export interface RegraFatorCubagem {
  contexto: string;      // '__padrao__' = geral; demais = código real de modalidade/operação
  fatorKgM3: number;
  ativo: boolean;
}

export const FATOR_CONTEXTO_PADRAO = "__padrao__";

/** Contextos/modalidades REAIS do sistema (código Orcamento.modalidade). */
export const FATOR_CONTEXTOS_REAIS: { value: string; label: string }[] = [
  { value: FATOR_CONTEXTO_PADRAO, label: "Padrão geral" },
  { value: "contrato", label: "Contrato" },
  { value: "esporadico", label: "Esporádico" },
];

const numPos = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Resolve o fator por precedência determinística:
 * regra específica do contexto → regra padrão geral → null (não configurado).
 * NUNCA usa fallback numérico escondido.
 */
export function resolverFatorCubagemRegras(regras?: RegraFatorCubagem[] | null, contexto?: string | null): number | null {
  if (!Array.isArray(regras)) return null;
  const ativos = regras.filter((r) => r && r.ativo !== false && numPos(r.fatorKgM3) > 0);
  const ctx = (contexto || "").trim();
  if (ctx) {
    const esp = ativos.find((r) => r.contexto === ctx);
    if (esp) return numPos(esp.fatorKgM3);
  }
  const pad = ativos.find((r) => r.contexto === FATOR_CONTEXTO_PADRAO);
  return pad ? numPos(pad.fatorKgM3) : null;
}

/** Volume (m³) de UM grupo de dimensões: (c/100)*(l/100)*(a/100)*quantidade. */
export function volumeM3PorGrupo(d: DimensaoCarga): number {
  const c = numPos(d?.comprimentoCm) / 100;
  const l = numPos(d?.larguraCm) / 100;
  const a = numPos(d?.alturaCm) / 100;
  const q = numPos(d?.quantidade);
  const v = c * l * a * q;
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.round(v * 1000) / 1000;
}

/** Cubagem total (m³) somando todos os grupos de dimensões. */
export function calcularCubagemM3(dimensoes?: DimensaoCarga[] | null): number {
  if (!Array.isArray(dimensoes)) return 0;
  const total = dimensoes.reduce((s, d) => s + volumeM3PorGrupo(d), 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.round(total * 1000) / 1000;
}

/** Soma das quantidades dos grupos de dimensões (quantidade total de volumes). */
export function totalVolumesGrupos(dimensoes?: DimensaoCarga[] | null): number {
  if (!Array.isArray(dimensoes)) return 0;
  const total = dimensoes.reduce((s, d) => s + numPos(d?.quantidade), 0);
  return Number.isFinite(total) && total > 0 ? Math.round(total) : 0;
}

/**
 * Peso cubado (kg) = cubagem (m³) × fator (kg/m³).
 * Usa SOMENTE o fator explícito/resolvido (sem localStorage). Sem fator => 0.
 */
export function calcularPesoCubado(cubagemM3: number, fator?: number | null): number {
  const f = numPos(fator);
  if (!f) return 0;
  const c = numPos(cubagemM3);
  const p = c * f;
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.round(p * 100) / 100;
}

/** Peso considerado para capacidade = MAX(peso real, peso cubado). */
export function calcularPesoConsiderado(pesoRealKg: number, pesoCubadoKg: number): number {
  return Math.max(numPos(pesoRealKg), numPos(pesoCubadoKg));
}

/** Maior comprimento/largura/altura (cm) entre os grupos de dimensões. */
export function maiorDimensaoCm(dimensoes?: DimensaoCarga[] | null): { comprimentoCm: number; larguraCm: number; alturaCm: number } {
  const out = { comprimentoCm: 0, larguraCm: 0, alturaCm: 0 };
  if (!Array.isArray(dimensoes)) return out;
  for (const d of dimensoes) {
    out.comprimentoCm = Math.max(out.comprimentoCm, numPos(d?.comprimentoCm));
    out.larguraCm = Math.max(out.larguraCm, numPos(d?.larguraCm));
    out.alturaCm = Math.max(out.alturaCm, numPos(d?.alturaCm));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// TMS-COM-CARGA-03 — Capacidade parametrizável de TIPOS/CONFIGURAÇÕES de veículo.
// Os valores padrão são DERIVADOS de VEICULO_PARAMETROS (origem explícita) e
// podem ser sobrescritos por configuração (configuracoes_sistema.veiculo_capacidades).
// NÃO inventa capacidade; campos 0/null = "não parametrizado".
// Preparado para Dedicado/Conexão Exclusivo/Fracionado/Parceiros/Providers.
// ─────────────────────────────────────────────────────────────────────────────
export interface VeiculoCapacidade {
  tipo: string;
  label: string;
  configuracao?: string;
  capacidadeKg: number;
  comprimentoUtilCm: number;
  larguraUtilCm: number;
  alturaUtilCm: number;
  cubagemUtilM3: number;
  capacidadePallets?: number | null;
  refrigerado?: boolean | null;
  carroceriasPermitidas?: string[];
  ativo: boolean;
  fonte?: string;
}

/** Catálogo padrão derivado do sistema (VEICULO_PARAMETROS) — sem inventar números. */
export function catalogoPadraoVeiculo(): VeiculoCapacidade[] {
  return Object.entries(VEICULO_PARAMETROS).map(([tipo, p]) => ({
    tipo,
    label: TIPOS_VEICULO.find((t) => t.value === tipo)?.label || p.label || tipo,
    configuracao: "",
    capacidadeKg: p.pesoMax,
    comprimentoUtilCm: p.compMax,
    larguraUtilCm: p.largMax,
    alturaUtilCm: p.altMax,
    cubagemUtilM3: p.cubagemMax,
    capacidadePallets: null,
    refrigerado: null,
    carroceriasPermitidas: [],
    ativo: true,
    fonte: "Padrão do sistema (derivado de VEICULO_PARAMETROS)",
  }));
}

export type StatusCriterio = "ok" | "falha" | "nao_parametrizado";

export interface CriteriosVeiculo {
  peso: StatusCriterio;
  cubagem: StatusCriterio;
  dimensao: StatusCriterio;
  pallets: StatusCriterio;
  refrigerado: StatusCriterio;
}

export interface AvaliacaoVeiculo {
  tipo: string;
  label: string;
  configuracao?: string;
  compativel: boolean;
  criterios: CriteriosVeiculo;
  motivos: string[];
}

export interface RecomendacaoVeiculo {
  disponivel: boolean;
  tipo: string | null;
  label: string | null;
  configuracao?: string;
  criterios: CriteriosVeiculo | null;
  avaliacoes: AvaliacaoVeiculo[];
  motivos: string[];
  faltando: string[];
  notas: string[];
}

const fmtKg = (n: number) => `${n.toLocaleString("pt-BR")} kg`;
const fmtM3 = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} m³`;
const fmtCm = (n: number) => `${n} cm`;

export interface EntradaCapacidade {
  pesoConsideradoKg: number;
  cubagemM3: number;
  dimensoes?: DimensaoCarga[] | null;
  pallets?: number;
  refrigerado?: boolean;
}

/** Nota de lacunas parametrizáveis (não inventar capacidade). */
export const NOTA_CAPACIDADE_PENDENTE =
  "Capacidade de pallets e restrição de carroceria podem não estar parametrizadas — validar conforme configuração.";

/** O volume (c,l,a) cabe em ALGUMA orientação dentro de (C,L,A)? */
export function cabeEmAlgumaOrientacao(c: number, l: number, a: number, C: number, L: number, A: number): boolean {
  const cubo = [numPos(c), numPos(l), numPos(a)];
  const caixa = [numPos(C), numPos(L), numPos(A)];
  if (cubo.some((v) => v <= 0) || caixa.some((v) => v <= 0)) return false;
  const perm = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  return perm.some(([i, j, k]) => cubo[i] <= caixa[0] && cubo[j] <= caixa[1] && cubo[k] <= caixa[2]);
}

/** Avalia UM veículo/configuração contra a carga (critérios objetivos). */
export function avaliarVeiculo(veic: VeiculoCapacidade, input: EntradaCapacidade): AvaliacaoVeiculo {
  const peso = numPos(input.pesoConsideradoKg);
  const cub = numPos(input.cubagemM3);
  const pallets = numPos(input.pallets);
  const dims = (input.dimensoes || []).filter((d) => numPos(d?.comprimentoCm) > 0 && numPos(d?.larguraCm) > 0 && numPos(d?.alturaCm) > 0);
  const criterios: CriteriosVeiculo = { peso: "ok", cubagem: "ok", dimensao: "ok", pallets: "ok", refrigerado: "ok" };
  const motivos: string[] = [];

  // A) PESO
  if (numPos(veic.capacidadeKg) > 0) {
    if (peso > veic.capacidadeKg) {
      criterios.peso = "falha";
      motivos.push(`Peso ${fmtKg(peso)} excede a capacidade de ${fmtKg(veic.capacidadeKg)}.`);
    } else {
      motivos.push(`Peso: ${fmtKg(peso)} ≤ ${fmtKg(veic.capacidadeKg)}`);
    }
  } else {
    criterios.peso = "nao_parametrizado";
    motivos.push("Capacidade de peso não parametrizada.");
  }

  // B) CUBAGEM
  if (numPos(veic.cubagemUtilM3) > 0) {
    if (cub > veic.cubagemUtilM3) {
      criterios.cubagem = "falha";
      motivos.push(`Cubagem ${fmtM3(cub)} excede a capacidade de ${fmtM3(veic.cubagemUtilM3)}.`);
    } else if (cub > 0) {
      motivos.push(`Cubagem: ${fmtM3(cub)} ≤ ${fmtM3(veic.cubagemUtilM3)}`);
    }
  } else {
    criterios.cubagem = "nao_parametrizado";
    motivos.push("Cubagem útil não parametrizada.");
  }

  // C) DIMENSÃO INDIVIDUAL (cada volume em alguma orientação válida)
  const temDimsVeiculo = numPos(veic.comprimentoUtilCm) > 0 && numPos(veic.larguraUtilCm) > 0 && numPos(veic.alturaUtilCm) > 0;
  if (dims.length > 0 && temDimsVeiculo) {
    const falha = dims.find((d) => !cabeEmAlgumaOrientacao(d.comprimentoCm, d.larguraCm, d.alturaCm, veic.comprimentoUtilCm, veic.larguraUtilCm, veic.alturaUtilCm));
    if (falha) {
      criterios.dimensao = "falha";
      motivos.push(`Dimensão individual ${falha.comprimentoCm}×${falha.larguraCm}×${falha.alturaCm} cm não cabe em ${fmtCm(veic.comprimentoUtilCm)}×${fmtCm(veic.larguraUtilCm)}×${fmtCm(veic.alturaUtilCm)} (nenhuma orientação).`);
    } else {
      motivos.push(`Dimensões individuais compatíveis com ${fmtCm(veic.comprimentoUtilCm)}×${fmtCm(veic.larguraUtilCm)}×${fmtCm(veic.alturaUtilCm)}.`);
    }
  } else if (dims.length > 0 && !temDimsVeiculo) {
    criterios.dimensao = "nao_parametrizado";
    motivos.push("Dimensões úteis do veículo não parametrizadas.");
  }

  // D) PALLETS (só quando parametrizado)
  if (veic.capacidadePallets !== null && veic.capacidadePallets !== undefined) {
    if (pallets > numPos(veic.capacidadePallets)) {
      criterios.pallets = "falha";
      motivos.push(`Pallets ${pallets} excedem a capacidade de ${veic.capacidadePallets}.`);
    } else if (pallets > 0) {
      motivos.push(`Pallets: ${pallets} ≤ ${veic.capacidadePallets}`);
    }
  } else {
    criterios.pallets = "nao_parametrizado";
    if (pallets > 0) motivos.push("Capacidade de pallets não parametrizada.");
  }

  // E) CARROCERIA / REFRIGERAÇÃO (só quando parametrizado)
  if (input.refrigerado === true) {
    if (veic.refrigerado === true) {
      motivos.push("Configuração refrigerada compatível.");
    } else if (veic.refrigerado === false) {
      criterios.refrigerado = "falha";
      motivos.push("Carga refrigerada × veículo sem configuração refrigerada.");
    } else {
      criterios.refrigerado = "nao_parametrizado";
      motivos.push("Condição refrigerada não parametrizada para este veículo.");
    }
  }

  const compativel = Object.values(criterios).every((s) => s !== "falha");
  return { tipo: veic.tipo, label: veic.label, configuracao: veic.configuracao, compativel, criterios, motivos };
}

/** Avalia TODOS os veículos do catálogo (para exibição detalhada). */
export function avaliarCatalogo(input: EntradaCapacidade, catalogo: VeiculoCapacidade[] = catalogoPadraoVeiculo()): AvaliacaoVeiculo[] {
  return catalogo.filter((v) => v.ativo !== false).map((v) => avaliarVeiculo(v, input));
}

/** Recomenda o MENOR veículo ativo e compatível (por capacidade de peso, depois cubagem). */
export function recomendarVeiculo(input: EntradaCapacidade, catalogo: VeiculoCapacidade[] = catalogoPadraoVeiculo()): RecomendacaoVeiculo {
  const peso = numPos(input.pesoConsideradoKg);
  const cub = numPos(input.cubagemM3);
  const dim = maiorDimensaoCm(input.dimensoes);
  const notas = [NOTA_CAPACIDADE_PENDENTE];

  const semDados = peso <= 0 && cub <= 0 && dim.comprimentoCm <= 0 && dim.larguraCm <= 0 && dim.alturaCm <= 0;
  if (semDados) {
    return { disponivel: false, tipo: null, label: null, criterios: null, avaliacoes: [], motivos: [], faltando: ["Informe peso real, dimensões e/ou volumes para recomendar um veículo."], notas };
  }

  const avaliacoes = avaliarCatalogo(input, catalogo);
  const compativeis = avaliacoes.filter((a) => a.compativel);
  if (compativeis.length === 0) {
    return {
      disponivel: false,
      tipo: null,
      label: null,
      criterios: null,
      avaliacoes,
      motivos: [],
      faltando: ["Nenhum veículo parametrizado atende integralmente à carga."],
      notas,
    };
  }

  const ordenado = (catalogo || []).filter((v) => v.ativo !== false).slice().sort((a, b) => {
    const pa = numPos(a.capacidadeKg) || Number.POSITIVE_INFINITY;
    const pb = numPos(b.capacidadeKg) || Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return (numPos(a.cubagemUtilM3) || Number.POSITIVE_INFINITY) - (numPos(b.cubagemUtilM3) || Number.POSITIVE_INFINITY);
  });
  const escolhido = ordenado.find((v) => compativeis.some((c) => c.tipo === v.tipo));
  const ev = avaliacoes.find((a) => a.tipo === escolhido?.tipo) || null;

  return {
    disponivel: true,
    tipo: escolhido?.tipo || null,
    label: escolhido?.label || null,
    configuracao: escolhido?.configuracao,
    criterios: ev?.criterios || null,
    avaliacoes,
    motivos: ev?.motivos || [],
    faltando: [],
    notas,
  };
}

export interface CompatibilidadeVeiculo {
  ok: boolean;
  cadastrado: boolean;
  criterios: CriteriosVeiculo | null;
  excedentes: string[];
}

/** Verifica se um veículo SELECIONADO comporta a carga (capacidade parametrizada). */
export function avaliarCompatibilidadeVeiculo(tipo: string, input: EntradaCapacidade, catalogo: VeiculoCapacidade[] = catalogoPadraoVeiculo()): CompatibilidadeVeiculo {
  const veic = catalogo.find((v) => v.tipo === tipo);
  if (!veic) return { ok: false, cadastrado: false, criterios: null, excedentes: ["Veículo não cadastrado no catálogo de capacidades."] };
  const ev = avaliarVeiculo(veic, input);
  const excedentes = ev.motivos.filter((_, i) => {
    // mantém apenas motivos de FALHA (heurística: contêm "excede"/"não cabe")
    return /excede|não cabe|sem configuração refrigerada/i.test(ev.motivos[i]);
  });
  return { ok: ev.compativel, cadastrado: true, criterios: ev.criterios, excedentes };
}

export interface DerivadosCarga {
  cubagem: number;
  cubagemCalculada: number;
  volumesGrupos: number;
  pesoCubado: number;
  pesoConsiderado: number;
  fator: number | null;
  fatorDisponivel: boolean;
  fatorContexto: string | null;
  recomendacao: RecomendacaoVeiculo;
  notas: string[];
}

/**
 * Consolida os derivados da carga.
 * Fator efetivo: explícito (snapshot/teste) > regra da modalidade (regras) > padrão geral > null.
 * A carga original NÃO é alterada; o fator aplicado fica disponível para snapshot.
 */
export function calcularDerivadosCarga(
  carga?: Partial<CargaOrcamento> | null,
  fatorExplicito?: number | null,
  catalogo?: VeiculoCapacidade[],
  regras?: RegraFatorCubagem[] | null,
  contexto?: string | null,
): DerivadosCarga {
  const dims = Array.isArray(carga?.dimensoes) ? (carga!.dimensoes as DimensaoCarga[]) : [];
  const cubagemCalculada = calcularCubagemM3(dims);
  const volumesGrupos = totalVolumesGrupos(dims);
  const cubagem = dims.length > 0 ? cubagemCalculada : numPos(carga?.cubagem);

  const fatorFixo = numPos(fatorExplicito); // snapshot histórico ou fixture de teste têm prioridade
  const fatorRegras = resolverFatorCubagemRegras(regras, contexto);
  const fatorRes = fatorFixo > 0 ? fatorFixo : fatorRegras;

  const pesoCubado = calcularPesoCubado(cubagem, fatorRes);
  const pesoReal = numPos(carga?.peso);
  const pesoConsiderado = calcularPesoConsiderado(pesoReal, pesoCubado);
  const recomendacao = recomendarVeiculo({
    pesoConsideradoKg: pesoConsiderado,
    cubagemM3: cubagem,
    dimensoes: dims,
    pallets: numPos(carga?.pallets),
    refrigerado: carga?.refrigerado === true,
  }, catalogo);

  const notas: string[] = [...recomendacao.notas];
  if (!fatorRes) {
    notas.unshift("Peso cubado não calculado: nenhuma regra de fator de cubagem configurada (Configurações → Veículos). Peso considerado = peso real.");
  }

  return {
    cubagem,
    cubagemCalculada,
    volumesGrupos,
    pesoCubado,
    pesoConsiderado,
    fator: fatorRes,
    fatorDisponivel: fatorRes != null,
    fatorContexto: fatorRes != null ? (fatorFixo > 0 ? "snapshot" : (contexto || FATOR_CONTEXTO_PADRAO)) : null,
    recomendacao,
    notas,
  };
}
