import { diretorVirtualService, type DecisaoDiretor } from "./diretorVirtualService";

export type DiretorEstado = "inativo" | "analisando" | "ativo" | "erro";

export interface DiretorWorkerStatus {
  rodando: boolean;
  estado: DiretorEstado;
  ultimaAnalise: string | null;
  ultimaDecisao: string | null;
  totalDecisoes: number;
  totalAcoes: number;
  totalErros: number;
  intervaloMs: number;
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let foiIniciado = false;

let status: DiretorWorkerStatus = {
  rodando: false,
  estado: "inativo",
  ultimaAnalise: null,
  ultimaDecisao: null,
  totalDecisoes: 0,
  totalAcoes: 0,
  totalErros: 0,
  intervaloMs: 45000,
};

let analisandoAgora = false;

const listeners: (() => void)[] = [];

export function onDiretorStatusChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notificar(): void {
  listeners.forEach((fn) => fn());
}

async function cicloAnalise(): Promise<void> {
  if (analisandoAgora) return;
  analisandoAgora = true;

  try {
    status.estado = "analisando";
    status.ultimaAnalise = new Date().toISOString();
    notificar();

    const decisoes = await diretorVirtualService.gerarDecisoes();
    status.totalDecisoes += decisoes.length;

    const executadas = decisoes.filter((d) => d.executado).length;
    status.totalAcoes += executadas;

    if (decisoes.length > 0) {
      status.ultimaDecisao = new Date().toISOString();
    }
    status.estado = "ativo";
    status.totalErros = 0;
  } catch {
    status.totalErros++;
    status.estado = "erro";
  } finally {
    analisandoAgora = false;
    notificar();
  }
}

export const diretorMotorWorker = {
  iniciar(intervaloMs = 45000): void {
    if (intervalId) return;
    if (foiIniciado) return;
    foiIniciado = true;

    status.intervaloMs = intervaloMs;
    status.rodando = true;
    status.estado = "ativo";
    notificar();

    cicloAnalise();
    intervalId = setInterval(cicloAnalise, intervaloMs);
  },

  parar(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    status.rodando = false;
    status.estado = "inativo";
    foiIniciado = false;
    notificar();
  },

  getStatus(): DiretorWorkerStatus {
    return { ...status };
  },

  async forcarCiclo(): Promise<DecisaoDiretor[]> {
    await cicloAnalise();
    return await diretorVirtualService.listarDecisoes(10);
  },
};

export default diretorMotorWorker;
