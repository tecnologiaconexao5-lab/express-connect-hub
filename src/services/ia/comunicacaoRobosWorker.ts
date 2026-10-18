import { comunicacaoEntreRobosService } from "./comunicacaoEntreRobosService";

export type ComunicacaoWorkerEstado = "inativo" | "ativo" | "processando" | "erro";

export interface ComunicacaoWorkerStatus {
  rodando: boolean;
  estado: ComunicacaoWorkerEstado;
  ultimoProcessamento: string | null;
  totalProcessados: number;
  totalErros: number;
  errosConsecutivos: number;
  ultimoErro: string | null;
  filaPendente: number;
  intervaloMs: number;
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let foiIniciado = false;
let processandoAgora = false;

let status: ComunicacaoWorkerStatus = {
  rodando: false,
  estado: "inativo",
  ultimoProcessamento: null,
  totalProcessados: 0,
  totalErros: 0,
  errosConsecutivos: 0,
  ultimoErro: null,
  filaPendente: 0,
  intervaloMs: 10000,
};

const listeners: (() => void)[] = [];

export function onComunicacaoWorkerStatusChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notificar(): void {
  listeners.forEach((fn) => fn());
}

async function processarFila(): Promise<void> {
  if (processandoAgora) return;
  processandoAgora = true;

  try {
    status.estado = "processando";
    notificar();

    if (status.filaPendente === 0) {
      const fila = await comunicacaoEntreRobosService.listarFilaPendente();
      status.filaPendente = fila.length;
    }

    const resultado = await comunicacaoEntreRobosService.processarFilaComunicacao();

    status.totalProcessados += resultado.processados;
    status.totalErros += resultado.erros;
    status.ultimoProcessamento = new Date().toISOString();
    status.errosConsecutivos = resultado.erros > 0 ? status.errosConsecutivos + 1 : 0;
    status.ultimoErro = resultado.erros > 0 ? `${resultado.erros} erro(s) no último processamento` : null;

    const filaRestante = await comunicacaoEntreRobosService.listarFilaPendente();
    status.filaPendente = filaRestante.length;

    status.estado = "ativo";
  } catch (err) {
    status.errosConsecutivos++;
    status.totalErros++;
    status.ultimoErro = err instanceof Error ? err.message : "Erro desconhecido";
    status.estado = "erro";
  } finally {
    processandoAgora = false;
    notificar();
  }
}

export const comunicacaoRobosWorker = {
  iniciar(intervaloMs = 10000): void {
    if (intervalId) return;
    if (foiIniciado) return;
    foiIniciado = true;

    status.intervaloMs = intervaloMs;
    status.rodando = true;
    status.estado = "ativo";
    notificar();

    processarFila();
    intervalId = setInterval(processarFila, intervaloMs);
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

  getStatus(): ComunicacaoWorkerStatus {
    return { ...status };
  },

  async forcarProcessamento(): Promise<{ processados: number; erros: number }> {
    await processarFila();
    return { processados: status.totalProcessados, erros: status.totalErros };
  },
};

export default comunicacaoRobosWorker;
