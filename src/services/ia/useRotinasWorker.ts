import { useState, useEffect, useCallback, useRef } from "react";
import { rotinasMotorWorker, onMotorStatusChange, type MotorStatus } from "./rotinasMotorWorker";

export function useRotinasWorker() {
  const [status, setStatus] = useState<MotorStatus>(rotinasMotorWorker.getStatus);
  const subscribed = useRef(false);

  useEffect(() => {
    if (subscribed.current) return;
    subscribed.current = true;
    const unsub = onMotorStatusChange(() => {
      setStatus(rotinasMotorWorker.getStatus());
    });
    return () => {
      subscribed.current = false;
      unsub();
    };
  }, []);

  const iniciar = useCallback((intervaloMs = 15000) => {
    rotinasMotorWorker.iniciar(intervaloMs);
  }, []);

  const parar = useCallback(() => {
    rotinasMotorWorker.parar();
  }, []);

  const executarCicloManual = useCallback(async () => {
    return rotinasMotorWorker.executarCicloManual();
  }, []);

  const forcarReinicio = useCallback(() => {
    rotinasMotorWorker.forcarReinicio();
  }, []);

  const resetarContadores = useCallback(() => {
    rotinasMotorWorker.resetarContadores();
  }, []);

  return {
    status,
    iniciar,
    parar,
    executarCicloManual,
    forcarReinicio,
    resetarContadores,
  };
}
