import { supabase } from "@/lib/supabase";
import { workforceOrchestratorService } from "./workforceOrchestratorService";

export type WorkforceEstado = "inativo" | "processando" | "ativo" | "erro";

export interface WorkforceWorkerStatus {
  rodando: boolean;
  estado: WorkforceEstado;
  ultimoProcessamento: string | null;
  totalProcessados: number;
  totalRedistribuidos: number;
  totalGargalos: number;
  totalErros: number;
  errosConsecutivos: number;
  filaPendente: number;
  intervaloMs: number;
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let foiIniciado = false;
let processandoAgora = false;

let status: WorkforceWorkerStatus = {
  rodando: false,
  estado: "inativo",
  ultimoProcessamento: null,
  totalProcessados: 0,
  totalRedistribuidos: 0,
  totalGargalos: 0,
  totalErros: 0,
  errosConsecutivos: 0,
  filaPendente: 0,
  intervaloMs: 15000,
};

const listeners: (() => void)[] = [];

export function onWorkforceStatusChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notificar(): void {
  listeners.forEach((fn) => fn());
}

const PRIORIDADE_ORDEM: Record<string, number> = {
  critica: 0,
  alta: 1,
  normal: 2,
  baixa: 3,
};

async function processarCiclo(): Promise<void> {
  if (processandoAgora) return;
  processandoAgora = true;

  try {
    status.estado = "processando";
    notificar();

    const fila = await workforceOrchestratorService.listarFila({ status: "pendente" });
    status.filaPendente = fila.length;

    const ordenados = fila.sort((a, b) => {
      const prioA = PRIORIDADE_ORDEM[a.trabalho?.prioridade || "normal"] ?? 2;
      const prioB = PRIORIDADE_ORDEM[b.trabalho?.prioridade || "normal"] ?? 2;
      if (prioA !== prioB) return prioA - prioB;
      const vencA = a.trabalho?.data_vencimento;
      const vencB = b.trabalho?.data_vencimento;
      if (vencA && vencB) return new Date(vencA).getTime() - new Date(vencB).getTime();
      if (vencA) return -1;
      if (vencB) return 1;
      return a.ordem_execucao - b.ordem_execucao;
    });

    const agora = new Date();
    let processados = 0;
    let erros = 0;

    for (const item of ordenados) {
      if (item.proxima_execucao && new Date(item.proxima_execucao) > agora) continue;

      try {
        const executou = await workforceOrchestratorService.executarTrabalho(item.id);
        if (executou) processados++;
        else erros++;
      } catch {
        erros++;
        status.totalErros++;
        status.errosConsecutivos++;
      }

      if (processados + erros >= 10) break;
    }

    status.totalProcessados += processados;
    status.totalErros += erros;
    status.ultimoProcessamento = new Date().toISOString();

    if (erros === 0) status.errosConsecutivos = 0;

    const stats = await workforceOrchestratorService.obterEstatisticas();

    if (stats.atrasadas > 5) {
      status.totalGargalos = stats.atrasadas;
    }

    if (stats.pendentes > 0) {
      const { data: robos } = await supabase
        .from("automacoes_robos")
        .select("id, nome")
        .eq("ativo", true);

      if (robos && robos.length > 0) {
        const cargas: { robo_id: string; carga: number }[] = [];
        for (const robo of robos as { id: string; nome: string }[]) {
          const prod = await workforceOrchestratorService.obterProdutividadeRobo(robo.id);
          cargas.push({ robo_id: robo.id, carga: prod.total });
        }

        const mediaCarga = cargas.reduce((s, c) => s + c.carga, 0) / Math.max(cargas.length, 1);
        const sobrecarregados = cargas.filter((c) => c.carga > mediaCarga * 1.5);

        if (sobrecarregados.length > 0) {
          const filaPendente = await workforceOrchestratorService.listarFila({ status: "pendente" });
          for (const item of filaPendente) {
            const menosCarregado = cargas.reduce((min, c) => c.carga < min.carga ? c : min);
            if (menosCarregado.robo_id !== item.robo_id) {
              await workforceOrchestratorService.redistribuirTrabalho(
                item.trabalho_id,
                menosCarregado.robo_id,
                undefined,
              );
              status.totalRedistribuidos++;
            }
          }
        }
      }
    }

    status.estado = status.errosConsecutivos >= 5 ? "erro" : "ativo";
  } catch {
    status.totalErros++;
    status.errosConsecutivos++;
    status.estado = "erro";
  } finally {
    processandoAgora = false;
    notificar();
  }
}

export const workforceOrchestratorWorker = {
  iniciar(intervaloMs = 15000): void {
    if (intervalId) return;
    if (foiIniciado) return;
    foiIniciado = true;

    status.intervaloMs = intervaloMs;
    status.rodando = true;
    status.estado = "ativo";
    notificar();

    processarCiclo();
    intervalId = setInterval(processarCiclo, intervaloMs);
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

  getStatus(): WorkforceWorkerStatus {
    return { ...status };
  },

  async forcarCiclo(): Promise<{ processados: number; erros: number }> {
    await processarCiclo();
    return { processados: status.totalProcessados, erros: status.totalErros };
  },

  resetarContadores(): void {
    status.totalProcessados = 0;
    status.totalRedistribuidos = 0;
    status.totalGargalos = 0;
    status.totalErros = 0;
    status.errosConsecutivos = 0;
    status.estado = "ativo";
    notificar();
  },
};

export default workforceOrchestratorWorker;
