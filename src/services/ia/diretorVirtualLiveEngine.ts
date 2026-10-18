import { diretorVirtualLiveService, type ResultadoCiclo } from "./diretorVirtualLiveService";
import { diretorVirtualService } from "./diretorVirtualService";

export type LiveEngineEstado = "inativo" | "ativo" | "analisando" | "erro";

export interface LiveEngineStatus {
  rodando: boolean;
  estado: LiveEngineEstado;
  ultimoCiclo: string | null;
  ciclosCompletados: number;
  totalDecisoes: number;
  totalAcoes: number;
  totalErros: number;
  errosConsecutivos: number;
  ultimoErro: string | null;
  ultimoResultado: ResultadoCiclo | null;
  intervaloMs: number;
  modo: string;
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let foiIniciado = false;
let executandoAgora = false;

let status: LiveEngineStatus = {
  rodando: false,
  estado: "inativo",
  ultimoCiclo: null,
  ciclosCompletados: 0,
  totalDecisoes: 0,
  totalAcoes: 0,
  totalErros: 0,
  errosConsecutivos: 0,
  ultimoErro: null,
  ultimoResultado: null,
  intervaloMs: 30000,
  modo: "semi_auto",
};

const listeners: (() => void)[] = [];

export function onLiveEngineStatusChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notificar(): void {
  listeners.forEach((fn) => fn());
}

async function executarCiclo(): Promise<void> {
  if (executandoAgora) return;
  executandoAgora = true;

  const timeoutId = setTimeout(() => {
    if (executandoAgora) {
      executandoAgora = false;
      status.estado = "erro";
      status.errosConsecutivos++;
      status.ultimoErro = "Timeout do ciclo (>10s)";
      notificar();
    }
  }, diretorVirtualLiveService.getTempoMaximoCiclo());

  try {
    const config = await diretorVirtualService.obterConfig();
    const modo = config?.modo_operacao || "semi_auto";
    status.modo = modo;

    if (config?.status === "paused") {
      status.estado = "ativo";
      clearTimeout(timeoutId);
      executandoAgora = false;
      return;
    }

    status.estado = "analisando";
    notificar();

    const resultado = await diretorVirtualLiveService.processarDecisoesGlobais(modo);

    status.ultimoCiclo = new Date().toISOString();
    status.ciclosCompletados++;
    status.totalDecisoes += resultado.decisoesGeradas;
    status.totalAcoes += resultado.acoesExecutadas;
    status.totalErros += resultado.erros;
    status.errosConsecutivos = resultado.erros > 0 ? status.errosConsecutivos + 1 : 0;
    status.ultimoResultado = resultado;
    status.ultimoErro = resultado.erros > 0 ? `${resultado.erros} erro(s) no último ciclo` : null;

    status.estado = "ativo";
  } catch (err) {
    status.errosConsecutivos++;
    status.totalErros++;
    status.ultimoErro = err instanceof Error ? err.message : "Erro desconhecido";
    status.estado = "erro";
  } finally {
    clearTimeout(timeoutId);
    executandoAgora = false;
    notificar();
  }
}

export const diretorVirtualLiveEngine = {
  iniciar(intervaloMs = 30000): void {
    if (intervalId) return;
    if (foiIniciado) return;
    foiIniciado = true;

    status.intervaloMs = intervaloMs;
    status.rodando = true;
    status.estado = "ativo";
    notificar();

    executarCiclo();
    intervalId = setInterval(executarCiclo, intervaloMs);
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

  getStatus(): LiveEngineStatus {
    return { ...status, ultimoResultado: status.ultimoResultado ? { ...status.ultimoResultado } : null };
  },

  async forcarCiclo(): Promise<ResultadoCiclo | null> {
    if (executandoAgora) return null;
    await executarCiclo();
    return status.ultimoResultado;
  },

  reiniciar(intervaloMs?: number): void {
    this.parar();
    foiIniciado = false;
    status.errosConsecutivos = 0;
    status.estado = "inativo";
    notificar();
    this.iniciar(intervaloMs || status.intervaloMs);
  },
};

export default diretorVirtualLiveEngine;
