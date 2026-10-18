import { useState, useEffect, useCallback, useRef } from "react";
import {
  comunicacaoRobosWorker,
  onComunicacaoWorkerStatusChange,
  type ComunicacaoWorkerStatus,
} from "./comunicacaoRobosWorker";
import {
  comunicacaoEntreRobosService,
  type ComunicacaoRobo,
  type FilaComunicacao,
  type TipoComunicacao,
  type PrioridadeComunicacao,
} from "./comunicacaoEntreRobosService";

export function useComunicacaoRobos() {
  const [workerStatus, setWorkerStatus] = useState<ComunicacaoWorkerStatus>(comunicacaoRobosWorker.getStatus);
  const [mensagens, setMensagens] = useState<ComunicacaoRobo[]>([]);
  const [fila, setFila] = useState<FilaComunicacao[]>([]);
  const [estatisticas, setEstatisticas] = useState<Record<string, number>>({});
  const subscribed = useRef(false);

  useEffect(() => {
    if (subscribed.current) return;
    subscribed.current = true;
    const unsub = onComunicacaoWorkerStatusChange(() => {
      setWorkerStatus(comunicacaoRobosWorker.getStatus());
    });
    return () => { subscribed.current = false; unsub(); };
  }, []);

  const carregarDados = useCallback(async () => {
    const [msgs, fl, est] = await Promise.all([
      comunicacaoEntreRobosService.listarMensagens(50),
      comunicacaoEntreRobosService.listarFilaPendente(),
      comunicacaoEntreRobosService.obterEstatisticas(),
    ]);
    setMensagens(msgs);
    setFila(fl);
    setEstatisticas(est as unknown as Record<string, number>);
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const iniciarWorker = useCallback((intervaloMs = 10000) => {
    comunicacaoRobosWorker.iniciar(intervaloMs);
  }, []);

  const enviarMensagem = useCallback(async (
    origemId: string,
    destinoId: string,
    tipo: TipoComunicacao,
    assunto: string,
    mensagem: string,
    contexto?: Record<string, unknown>,
    prioridade?: PrioridadeComunicacao,
    tarefaId?: string,
    rotinaId?: string,
  ) => {
    const result = await comunicacaoEntreRobosService.enviarMensagem(
      origemId, destinoId, tipo, assunto, mensagem, contexto, prioridade, tarefaId, rotinaId,
    );
    await carregarDados();
    return result;
  }, [carregarDados]);

  const responder = useCallback(async (comunicacaoId: string, respostaTexto: string, roboRespostaId: string) => {
    const ok = await comunicacaoEntreRobosService.responderMensagem(comunicacaoId, respostaTexto, roboRespostaId);
    await carregarDados();
    return ok;
  }, [carregarDados]);

  const escalar = useCallback(async (roboOrigemId: string, assunto: string, mensagem: string, contexto?: Record<string, unknown>) => {
    const result = await comunicacaoEntreRobosService.escalarParaDiretorVirtual(roboOrigemId, assunto, mensagem, contexto);
    await carregarDados();
    return result;
  }, [carregarDados]);

  return {
    workerStatus,
    mensagens,
    fila,
    estatisticas,
    iniciarWorker,
    enviarMensagem,
    responder,
    escalar,
    recarregar: carregarDados,
  };
}
