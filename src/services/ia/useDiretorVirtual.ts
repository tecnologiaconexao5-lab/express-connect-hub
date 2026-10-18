import { useState, useEffect, useCallback, useRef } from "react";
import { diretorMotorWorker, onDiretorStatusChange, type DiretorWorkerStatus } from "./diretorMotorWorker";
import { diretorVirtualService, type DecisaoDiretor, type MetricaRobo, type DiretorVirtual } from "./diretorVirtualService";

export function useDiretorVirtual() {
  const [workerStatus, setWorkerStatus] = useState<DiretorWorkerStatus>(diretorMotorWorker.getStatus);
  const [config, setConfig] = useState<DiretorVirtual | null>(null);
  const [decisoes, setDecisoes] = useState<DecisaoDiretor[]>([]);
  const [metricas, setMetricas] = useState<MetricaRobo[]>([]);
  const subscribed = useRef(false);

  useEffect(() => {
    if (subscribed.current) return;
    subscribed.current = true;
    const unsub = onDiretorStatusChange(() => {
      setWorkerStatus(diretorMotorWorker.getStatus());
    });
    return () => { subscribed.current = false; unsub(); };
  }, []);

  const carregarDados = useCallback(async () => {
    const [cfg, decs, mets] = await Promise.all([
      diretorVirtualService.obterConfig(),
      diretorVirtualService.listarDecisoes(50),
      diretorVirtualService.listarMetricas(),
    ]);
    setConfig(cfg);
    setDecisoes(decs);
    setMetricas(mets);
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const iniciarWorker = useCallback((intervaloMs = 45000) => {
    diretorMotorWorker.iniciar(intervaloMs);
  }, []);

  const pararWorker = useCallback(() => {
    diretorMotorWorker.parar();
  }, []);

  const forcarCiclo = useCallback(async () => {
    return diretorMotorWorker.forcarCiclo();
  }, []);

  const atualizarConfig = useCallback(async (updates: Partial<DiretorVirtual>) => {
    const nova = await diretorVirtualService.atualizarConfig(updates);
    if (nova) setConfig(nova);
    return nova;
  }, []);

  const aprovarDecisao = useCallback(async (id: string) => {
    await diretorVirtualService.aprovarDecisao(id);
    const decs = await diretorVirtualService.listarDecisoes(50);
    setDecisoes(decs);
  }, []);

  const rejeitarDecisao = useCallback(async (id: string) => {
    await diretorVirtualService.rejeitarDecisao(id);
    const decs = await diretorVirtualService.listarDecisoes(50);
    setDecisoes(decs);
  }, []);

  return {
    workerStatus,
    config,
    decisoes,
    metricas,
    iniciarWorker,
    pararWorker,
    forcarCiclo,
    atualizarConfig,
    aprovarDecisao,
    rejeitarDecisao,
    recarregar: carregarDados,
  };
}
