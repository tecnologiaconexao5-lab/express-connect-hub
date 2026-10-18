import { useState, useCallback } from "react";
import {
  finalizarComPOD,
  uploadFotoPOD,
  buscarPOD,
  type PODData,
  type PODResult,
} from "@/services/podService";

export default function usePod() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalizar = useCallback(
    async (
      alocacaoId: string,
      prestadorId: string,
      podData: PODData,
      kmFinal: number
    ): Promise<PODResult> => {
      setLoading(true);
      setError(null);
      try {
        const result = await finalizarComPOD(
          alocacaoId,
          prestadorId,
          podData,
          kmFinal
        );
        if (!result.sucesso) {
          setError(result.erro || "Erro ao finalizar com POD");
        }
        return result;
      } catch (err) {
        const msg = String((err as Error)?.message || err);
        setError(msg);
        return { sucesso: false, erro: msg };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const uploadFoto = useCallback(
    async (file: File, prefix: string): Promise<string | null> => {
      try {
        return await uploadFotoPOD(file, prefix);
      } catch {
        return null;
      }
    },
    []
  );

  const buscar = useCallback(
    async (alocacaoId: string): Promise<PODData | null> => {
      try {
        return await buscarPOD(alocacaoId);
      } catch {
        return null;
      }
    },
    []
  );

  return { finalizar, uploadFoto, buscar, loading, error };
}
