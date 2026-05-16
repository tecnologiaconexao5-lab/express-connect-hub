export type Classification = "Bronze" | "Prata" | "Ouro" | "Diamante";

export interface ScoreBreakdown {
  documentacao: number;
  experiencia: number;
  regiao: number;
  disponibilidade: number;
  veiculo: number;
  historico: number;
  perfilOperacional: number;
}

export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
  classification: Classification;
  color: string;
}

export interface ScoreInput {
  nome: string;
  cpf: string;
  selfieUrl: string | null;
  cnhUrl: string | null;
  tipoVeiculo: string;
  modelo: string;
  placa: string;
  ano: string;
  capacidade: string;
  fotosVeiculo: string[];
  crlvUrl: string | null;
  comprovanteUrl: string | null;
  anttUrl: string | null;
  moppUrl: string | null;
  seguroUrl: string | null;
  chavePix: string;
  banco: string;
  regioes: string[];
  horariosInicio: string;
  horariosFim: string;
  tipoCarga: string;
  tipoViagem: string[];
  fazColeta: boolean;
  fazEntrega: boolean;
  distanciaMaxima: string;
  documentValidations: Record<string, { approved: boolean; confidence: number }>;
  stepsCompleted: boolean[];
  isComplete: boolean;
}

function classify(total: number): { classification: Classification; color: string } {
  if (total >= 86) return { classification: "Diamante", color: "#06b6d4" };
  if (total >= 66) return { classification: "Ouro", color: "#f59e0b" };
  if (total >= 41) return { classification: "Prata", color: "#94a3b8" };
  return { classification: "Bronze", color: "#cd7f32" };
}

export function calculateScore(input: ScoreInput): ScoreResult {
  const doc = input.documentValidations || {};

  const docScore = (() => {
    let s = 0;
    if (doc.cnh?.approved) s += 5;
    else if (input.cnhUrl) s += 2;
    if (doc.crlv?.approved) s += 5;
    else if (input.crlvUrl) s += 2;
    if (doc.comprovante?.approved) s += 4;
    else if (input.comprovanteUrl) s += 1.5;
    if (doc.antt?.approved) s += 4;
    if (doc.seguro?.approved) s += 4;
    else if (input.seguroUrl) s += 1;
    if (doc.mopp?.approved) s += 3;
    return Math.min(s, 25);
  })();

  const expScore = (() => {
    let s = 0;
    if (input.nome.trim()) s += 3;
    if (input.cpf.replace(/\D/g, "").length === 11) s += 3;
    if (input.selfieUrl) s += 3;
    if (input.cnhUrl) s += 3;
    if (input.stepsCompleted[0]) s += 3;
    return Math.min(s, 15);
  })();

  const regScore = (() => {
    const count = input.regioes.length;
    if (count === 0) return 0;
    if (count === 1) return 3;
    if (count <= 3) return 7;
    if (count <= 5) return 10;
    const strategic = ["Grande SP", "ABC Paulista", "Interior SP"];
    const hasStrategic = strategic.some((r) => input.regioes.includes(r));
    return hasStrategic ? 15 : 12;
  })();

  const dispScore = (() => {
    let s = 0;
    if (input.horariosInicio && input.horariosFim) s += 4;
    if (input.tipoCarga) s += 3;
    if (input.tipoViagem.length > 0) {
      s += Math.min(input.tipoViagem.length * 1.5, 3);
    }
    if (input.fazColeta && input.fazEntrega) s += 3;
    if (input.distanciaMaxima) s += 2;
    return Math.min(s, 15);
  })();

  const veicScore = (() => {
    let s = 0;
    if (input.tipoVeiculo) s += 3;
    if (input.modelo.trim()) s += 2;
    if (input.placa.trim().length >= 7) s += 2;
    const anoNum = parseInt(input.ano);
    if (anoNum >= 2020) s += 4;
    else if (anoNum >= 2015) s += 3;
    else if (anoNum >= 2010) s += 1;
    if (input.capacidade) s += 2;
    const fotoCount = input.fotosVeiculo.length;
    s += Math.min(fotoCount * 0.4, 2);
    return Math.min(s, 15);
  })();

  const histScore = (() => {
    let s = 0;
    const completed = input.stepsCompleted.filter(Boolean).length;
    s += Math.min(completed * 1.25, 5);
    const approvedDocs = Object.values(doc).filter((d) => d.approved).length;
    s += Math.min(approvedDocs * 1.2, 5);
    return Math.min(s, 10);
  })();

  const perfilScore = (() => {
    let s = 0;
    const stepsDone = input.stepsCompleted.filter(Boolean).length;
    if (stepsDone >= 5) s += 1.5;
    else if (stepsDone >= 3) s += 0.5;
    if (input.chavePix.trim()) s += 1;
    if (input.banco.trim()) s += 1;
    if (input.fazColeta || input.fazEntrega) s += 1.5;
    return Math.min(s, 5);
  })();

  const total = Math.round(
    Math.min(docScore + expScore + regScore + dispScore + veicScore + histScore + perfilScore, 100)
  );

  const { classification, color } = classify(total);

  return {
    total,
    breakdown: {
      documentacao: docScore,
      experiencia: expScore,
      regiao: regScore,
      disponibilidade: dispScore,
      veiculo: veicScore,
      historico: histScore,
      perfilOperacional: perfilScore,
    },
    classification,
    color,
  };
}

export function getClassificationColor(c: Classification): string {
  const map: Record<Classification, string> = {
    Bronze: "from-amber-700 to-amber-600",
    Prata: "from-slate-400 to-slate-300",
    Ouro: "from-yellow-500 to-yellow-400",
    Diamante: "from-cyan-500 to-blue-500",
  };
  return map[c];
}

export function getClassificationBg(c: Classification): string {
  const map: Record<Classification, string> = {
    Bronze: "bg-amber-100 text-amber-800 border-amber-200",
    Prata: "bg-slate-100 text-slate-700 border-slate-200",
    Ouro: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Diamante: "bg-cyan-50 text-cyan-700 border-cyan-200",
  };
  return map[c];
}
