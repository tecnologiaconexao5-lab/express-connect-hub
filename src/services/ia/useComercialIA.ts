import { useState, useEffect, useCallback, useRef } from "react";
import { comercialIAWorker } from "./comercialIAWorker";
import { hunterService } from "./comercialIA/hunterService";
import { aprendizadoService } from "./comercialIA/aprendizadoService";
import { supabase } from "@/lib/supabase";
import type { HunterConfig, HunterExecucao, HunterResultado } from "./comercialIA/types";

export function useComercialIA(roboId?: string) {
  const [workerStatus, setWorkerStatus] = useState(comercialIAWorker.getStatus());
  const [config, setConfig] = useState<HunterConfig | null>(null);
  const [dashboard, setDashboard] = useState({
    total_encontradas: 0,
    total_leads: 0,
    total_descartados: 0,
    total_duplicatas: 0,
    total_confianca_baixa: 0,
    leads_quentes: 0,
    execucoes: 0,
    ultima_execucao: null as string | null,
    por_provider: {} as Record<string, { leads: number; descartados: number; duplicatas: number }>,
  });
  const [metricasAprendizado, setMetricasAprendizado] = useState({
    total: 0, respondeu: 0, ignorou: 0, recusou: 0,
    virou_cliente: 0, orcamento: 0, fechou: 0, taxa_conversao_percent: 0,
  });
  const [ultimasExecucoes, setUltimasExecucoes] = useState<HunterExecucao[]>([]);
  const [ultimosResultados, setUltimosResultados] = useState<HunterResultado[]>([]);
  const [loading, setLoading] = useState(true);
  const subscribed = useRef(false);

  useEffect(() => {
    const unsub = comercialIAWorker.onStatusChange(setWorkerStatus);
    return unsub;
  }, []);

  const carregarDados = useCallback(async (id?: string) => {
    setLoading(true);
    try {
      let roboIdResolved = id || roboId;

      if (!roboIdResolved) {
        const { data } = await supabase
          .from("automacoes_robos")
          .select("id")
          .eq("nome", "Comercial IA")
          .single();
        roboIdResolved = data?.id;
      }

      if (!roboIdResolved) {
        setLoading(false);
        return;
      }

      const [cfg, dash, aprendizado, execs, results] = await Promise.all([
        hunterService.obterConfig(roboIdResolved),
        hunterService.obterDashboard(roboIdResolved),
        aprendizadoService.calcularTaxaConvercao(roboIdResolved),
        supabase
          .from("comercial_hunter_execucoes")
          .select("*")
          .eq("robo_id", roboIdResolved)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("comercial_hunter_resultados")
          .select("*")
          .eq("robo_id", roboIdResolved)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      setConfig(cfg);
      setDashboard(dash);
      setMetricasAprendizado(aprendizado);
      setUltimasExecucoes((execs.data || []) as HunterExecucao[]);
      setUltimosResultados((results.data || []) as HunterResultado[]);
    } catch (err) {
      console.error("[useComercialIA] Erro:", err);
    } finally {
      setLoading(false);
    }
  }, [roboId]);

  useEffect(() => {
    if (!subscribed.current) {
      subscribed.current = true;
      carregarDados(roboId);
    }
  }, [roboId, carregarDados]);

  return {
    workerStatus,
    config,
    dashboard,
    metricasAprendizado,
    ultimasExecucoes,
    ultimosResultados,
    loading,
    carregarDados: () => carregarDados(roboId),
    worker: comercialIAWorker,
  };
}
