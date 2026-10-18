import { rotinasMotorService } from "./rotinasMotorService";

export type MotorEstado = "inativo" | "ativo" | "erro";

export interface MotorStatus {
  rodando: boolean;
  estado: MotorEstado;
  ultimaVerificacao: string | null;
  ultimaExecucao: string | null;
  ultimoHeartbeat: string | null;
  totalExecutadas: number;
  totalErros: number;
  totalRecuperadas: number;
  intervaloMs: number;
  errosConsecutivos: number;
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
let foiIniciado = false;

let motorStatus: MotorStatus = {
  rodando: false,
  estado: "inativo",
  ultimaVerificacao: null,
  ultimaExecucao: null,
  ultimoHeartbeat: null,
  totalExecutadas: 0,
  totalErros: 0,
  totalRecuperadas: 0,
  intervaloMs: 15000,
  errosConsecutivos: 0,
};

let executandoAgora = false;

const statusListeners: (() => void)[] = [];

export function onMotorStatusChange(fn: () => void): () => void {
  statusListeners.push(fn);
  return () => {
    const idx = statusListeners.indexOf(fn);
    if (idx >= 0) statusListeners.splice(idx, 1);
  };
}

function notificarStatus(): void {
  statusListeners.forEach((fn) => fn());
}

async function cicloVerificacao(): Promise<void> {
  if (executandoAgora) return;
  executandoAgora = true;

  try {
    const recuperadas = await rotinasMotorService.recuperarExecucoesTravadas();
    if (recuperadas > 0) {
      motorStatus.totalRecuperadas += recuperadas;
    }

    motorStatus.ultimaVerificacao = new Date().toISOString();
    motorStatus.errosConsecutivos = 0;
    motorStatus.estado = "ativo";

    const pendentes = await rotinasMotorService.buscarRotinasPendentes();

    for (const rotina of pendentes) {
      try {
        await rotinasMotorService.executarRotina(rotina.id);
        motorStatus.totalExecutadas++;
        motorStatus.ultimaExecucao = new Date().toISOString();
      } catch {
        motorStatus.totalErros++;
        motorStatus.errosConsecutivos++;
        if (motorStatus.errosConsecutivos >= 5) {
          motorStatus.estado = "erro";
        }
      }
    }
  } catch {
    motorStatus.totalErros++;
    motorStatus.errosConsecutivos++;
    if (motorStatus.errosConsecutivos >= 5) {
      motorStatus.estado = "erro";
    }
  } finally {
    executandoAgora = false;
    notificarStatus();
  }
}

function cicloHeartbeat(): void {
  motorStatus.ultimoHeartbeat = new Date().toISOString();
  notificarStatus();
}

export const rotinasMotorWorker = {
  iniciar(intervaloMs = 15000): void {
    if (intervalId) return;
    if (foiIniciado) return;
    foiIniciado = true;

    motorStatus.intervaloMs = intervaloMs;
    motorStatus.rodando = true;
    motorStatus.estado = "ativo";
    notificarStatus();

    cicloVerificacao();
    intervalId = setInterval(cicloVerificacao, intervaloMs);
    heartbeatIntervalId = setInterval(cicloHeartbeat, Math.min(intervaloMs, 30000));
  },

  parar(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (heartbeatIntervalId) {
      clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = null;
    }
    motorStatus.rodando = false;
    motorStatus.estado = "inativo";
    foiIniciado = false;
    notificarStatus();
  },

  getStatus(): MotorStatus {
    return { ...motorStatus };
  },

  async executarCicloManual(): Promise<{ executadas: number; erros: number; recuperadas: number }> {
    const antes = { ok: motorStatus.totalExecutadas, err: motorStatus.totalErros, rec: motorStatus.totalRecuperadas };
    await cicloVerificacao();
    return {
      executadas: motorStatus.totalExecutadas - antes.ok,
      erros: motorStatus.totalErros - antes.err,
      recuperadas: motorStatus.totalRecuperadas - antes.rec,
    };
  },

  forcarReinicio(): void {
    this.parar();
    foiIniciado = false;
    motorStatus.errosConsecutivos = 0;
    motorStatus.estado = "inativo";
    notificarStatus();
    this.iniciar(motorStatus.intervaloMs);
  },

  resetarContadores(): void {
    motorStatus.totalExecutadas = 0;
    motorStatus.totalErros = 0;
    motorStatus.totalRecuperadas = 0;
    motorStatus.errosConsecutivos = 0;
    motorStatus.estado = "ativo";
    notificarStatus();
  },
};

export default rotinasMotorWorker;
