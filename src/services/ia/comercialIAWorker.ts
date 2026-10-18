import { hunterService } from "./comercialIA/hunterService";
import { supabase } from "@/lib/supabase";

interface WorkerStatus {
  rodando: boolean;
  ultimo_ciclo: string | null;
  ultimo_resultado: string;
  erros_consecutivos: number;
}

type StatusListener = (status: WorkerStatus) => void;

const statusInicial: WorkerStatus = {
  rodando: false,
  ultimo_ciclo: null,
  ultimo_resultado: "aguardando",
  erros_consecutivos: 0,
};

let statusAtual: WorkerStatus = { ...statusInicial };
let intervalId: ReturnType<typeof setInterval> | null = null;
let processandoAgora = false;
const listeners = new Set<StatusListener>();
const INTERVALO_PADRAO_MS = 30 * 60 * 1000;
const ROBO_COMERCIAL_IA_NOME = "Comercial IA";

function notificar() {
  listeners.forEach(fn => fn({ ...statusAtual }));
}

async function buscarRoboComercial(): Promise<string | null> {
  const { data } = await supabase
    .from("automacoes_robos")
    .select("id, modo")
    .eq("nome", ROBO_COMERCIAL_IA_NOME)
    .single();
  return data?.id || null;
}

async function buscarIntervaloConfig(roboId: string): Promise<number> {
  try {
    const config = await hunterService.obterConfig(roboId);
    if (config?.estrategia?.limites?.prospeccoes_por_ciclo) {
      // Intervalo adaptativo: mais prospeccoes = mais frequente
      const qtd = config.estrategia.limites.prospeccoes_por_ciclo;
      if (qtd <= 5) return 60 * 60 * 1000;   // 1h se poucas prospeccoes
      if (qtd <= 10) return 30 * 60 * 1000;  // 30min
      return 15 * 60 * 1000;                 // 15min se muitas prospeccoes
    }
  } catch { /* fallback */ }
  return INTERVALO_PADRAO_MS;
}

async function ciclo() {
  if (processandoAgora) return;
  processandoAgora = true;

  try {
    const roboId = await buscarRoboComercial();
    if (!roboId) {
      statusAtual.ultimo_resultado = "Robo Comercial IA nao encontrado";
      statusAtual.erros_consecutivos++;
      notificar(); return;
    }

    const config = await hunterService.obterConfig(roboId);
    if (!config || !config.ativo) {
      statusAtual.ultimo_resultado = "Hunter inativo";
      notificar(); return;
    }

    if (config.modo === "manual") {
      statusAtual.ultimo_resultado = "Modo manual — pulando ciclo";
      notificar(); return;
    }

    const resultado = await hunterService.executarCiclo(roboId);
    statusAtual.ultimo_ciclo = new Date().toISOString();
    statusAtual.ultimo_resultado = resultado.resumo;
    statusAtual.erros_consecutivos = 0;

    if (resultado.leads_criados > 0) {
      statusAtual.ultimo_resultado = `${resultado.leads_criados} lead(s) criado(s)`;
    }
  } catch (err: any) {
    statusAtual.erros_consecutivos++;
    statusAtual.ultimo_resultado = `Erro: ${err.message}`;
    if (statusAtual.erros_consecutivos > 10) {
      console.error("[ComercialIAWorker] Muitos erros consecutivos. Parando worker.");
      parar();
    }
  } finally {
    processandoAgora = false;
    notificar();
  }
}

export const comercialIAWorker = {
  async iniciar(intervaloMs?: number) {
    if (intervalId) return;
    statusAtual = { ...statusInicial, rodando: true };
    const roboId = await buscarRoboComercial();
    const intervalo = intervaloMs || (roboId ? await buscarIntervaloConfig(roboId) : INTERVALO_PADRAO_MS);
    intervalId = setInterval(ciclo, intervalo);
    ciclo();
    notificar();
    console.log(`[ComercialIAWorker] Iniciado (intervalo: ${intervalo / 1000}s)`);
  },

  parar() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    statusAtual.rodando = false;
    notificar();
    console.log("[ComercialIAWorker] Parado.");
  },

  getStatus(): WorkerStatus { return { ...statusAtual }; },
  onStatusChange(fn: StatusListener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  async forcarCiclo() { await ciclo(); },
};
