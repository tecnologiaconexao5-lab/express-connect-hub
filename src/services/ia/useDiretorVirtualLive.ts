import { useState, useEffect, useCallback, useRef } from "react";
import {
  diretorVirtualLiveEngine,
  onLiveEngineStatusChange,
  type LiveEngineStatus,
} from "./diretorVirtualLiveEngine";
import {
  diretorVirtualLiveService,
  type EventoDiretorLive,
} from "./diretorVirtualLiveService";
import { diretorVirtualService, type MetricaRobo, type DecisaoDiretor } from "./diretorVirtualService";

export function useDiretorVirtualLive() {
  const [engineStatus, setEngineStatus] = useState<LiveEngineStatus>(diretorVirtualLiveEngine.getStatus);
  const [eventos, setEventos] = useState<EventoDiretorLive[]>([]);
  const [decisoes, setDecisoes] = useState<DecisaoDiretor[]>([]);
  const [metricas, setMetricas] = useState<MetricaRobo[]>([]);
  const subscribed = useRef(false);

  useEffect(() => {
    if (subscribed.current) return;
    subscribed.current = true;
    const unsub = onLiveEngineStatusChange(() => {
      setEngineStatus(diretorVirtualLiveEngine.getStatus());
    });
    return () => { subscribed.current = false; unsub(); };
  }, []);

  const carregarDados = useCallback(async () => {
    const [evts, decs, mets] = await Promise.all([
      diretorVirtualLiveService.listarEventos(100),
      diretorVirtualService.listarDecisoes(50),
      diretorVirtualService.listarMetricas(),
    ]);
    setEventos(evts);
    setDecisoes(decs);
    setMetricas(mets);
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const iniciarEngine = useCallback((intervaloMs = 30000) => {
    diretorVirtualLiveEngine.iniciar(intervaloMs);
  }, []);

  const pararEngine = useCallback(() => {
    diretorVirtualLiveEngine.parar();
  }, []);

  const forcarCiclo = useCallback(async () => {
    const resultado = await diretorVirtualLiveEngine.forcarCiclo();
    await carregarDados();
    return resultado;
  }, [carregarDados]);

  const reiniciarEngine = useCallback((intervaloMs?: number) => {
    diretorVirtualLiveEngine.reiniciar(intervaloMs);
  }, []);

  return {
    engineStatus,
    eventos,
    decisoes,
    metricas,
    iniciarEngine,
    pararEngine,
    forcarCiclo,
    reiniciarEngine,
    recarregar: carregarDados,
  };
}
