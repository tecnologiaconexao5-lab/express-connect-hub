import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { normalizarStatusParaBanco } from "@/components/operacao/escalaStatus";
import { sincronizarOSEscala } from "@/services/ordemServicoService";
import {
  mapearLocalParaBanco,
  mapearBancoParaLocal,
  carregarLocalStorage,
  salvarLocalStorage,
} from "@/services/escala/escalaMapper";
import {
  listarAlocacoes,
  aceitarAlocacao as escalaAceitarAlocacao,
  recusarAlocacao as escalaRecusarAlocacao,
  iniciarRota as escalaIniciarRota,
  finalizarAlocacao as escalaFinalizarAlocacao,
} from "@/services/escala/escalaService";

type ResultadoOperacao = {
  sucesso: boolean;
  mensagem?: string;
  data?: any;
};

export type FonteDados = 'supabase' | 'localStorage';

export default function useEscala() {
  const [alocacoes, setAlocacoes] = useState<Record<string, any>[]>(() => carregarLocalStorage());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string>("");
  const [usandoSupabase, setUsandoSupabase] = useState(false);
  const [fonteDados, setFonteDados] = useState<FonteDados>('localStorage');
  const [erroSupabase, setErroSupabase] = useState<string | null>(null);

  const carregarAlocacoes = useCallback(async (filtros?: {
    prestadorId?: string;
    clienteId?: string;
    dataInicio?: string;
    dataFim?: string;
  }) => {
    setLoading(true);
    setError(null);
    setMensagem("");
    setErroSupabase(null);
    try {
      if (typeof window === "undefined") {
        setUsandoSupabase(false);
        return carregarLocalStorage();
      }

      let normalizadas: Record<string, any>[] = [];

      const params: Record<string, any> = {
        status: ["planejada", "aguardando_aceite", "aceita", "recusada", "em_rota", "concluida", "ocorrencia"],
        limite: 500,
      };

      if (filtros?.prestadorId) params.prestador_id = filtros.prestadorId;
      if (filtros?.clienteId) params.cliente_id = filtros.clienteId;
      if (filtros?.dataInicio) params.data_inicio = filtros.dataInicio;
      if (filtros?.dataFim) params.data_fim = filtros.dataFim;

      const resultado = await listarAlocacoes(params);

      if (resultado.sucesso && resultado.dados) {
        normalizadas = resultado.dados.alocacoes.map((item: Record<string, any>) => ({
          ...mapearBancoParaLocal(item),
          id: item.id != null ? String(item.id) : String(Date.now()),
        }));
        salvarLocalStorage(normalizadas);
        setAlocacoes(normalizadas);
        setUsandoSupabase(true);
        setFonteDados('supabase');
        setMensagem(`Alocacoes carregadas: ${normalizadas.length}`);
        return normalizadas;
      }

      console.warn("[Escala] listarAlocacoes falhou:", resultado.erro);
      throw new Error(resultado.erro || "Falha ao carregar alocacoes");
    } catch (err) {
      const msgErro = String((err as Error)?.message || err);
      console.warn("[Escala] Fallback para localStorage. Erro:", msgErro);
      setUsandoSupabase(false);
      setFonteDados('localStorage');
      setErroSupabase(msgErro);
      setError(msgErro);
      setMensagem("Dados carregados do cache local.");

      const fallback = carregarLocalStorage();
      const filtradas = filtros?.prestadorId
        ? fallback.filter((a: Record<string, any>) => String(a.prestadorId) === String(filtros.prestadorId))
        : fallback;
      setAlocacoes(filtradas);
      return filtradas;
    } finally {
      setLoading(false);
    }
  }, []);

  const criarAlocacao = useCallback(async (item: Record<string, any>): Promise<ResultadoOperacao> => {
    setLoading(true);
    setError(null);
    setMensagem("");
    try {
      if (!item || typeof item !== "object") {
        throw new Error("Alocação inválida");
      }

      if (usandoSupabase) {
        const itemParaBanco = mapearLocalParaBanco(item);

        console.log("[ESCALA_DEBUG] Payload insert:", JSON.stringify(itemParaBanco, null, 2));
        Object.entries(itemParaBanco).forEach(([k, v]) => {
          console.log("[ESCALA_DEBUG_FIELD]", k, v, typeof v);
        });

        const isUUID = (v: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        const uuidFields = ["id", "prestador_id", "cliente_id", "os_id", "operacao_id", "ordem_servico_id", "ordem_carregamento_id", "empresa_id"];
        uuidFields.forEach((campo) => {
          const valor = itemParaBanco[campo];
          if (valor && typeof valor === "string" && !isUUID(valor)) {
            console.error("[UUID_INVALIDO]", campo, valor);
            delete itemParaBanco[campo];
          }
        });
        Object.keys(itemParaBanco).forEach((k) => {
          if (itemParaBanco[k] === undefined || itemParaBanco[k] === null || itemParaBanco[k] === "") {
            delete itemParaBanco[k];
          }
        });

        const { data, error } = await supabase
          .from("alocacoes_escala")
          .insert(itemParaBanco)
          .select();

        if (error) {
          console.error("[ESCALA_DEBUG_ERROR]", JSON.stringify(error, null, 2));
        }

        if (!error && data) {
          const camelData = (Array.isArray(data) ? data : [data]).map(mapearBancoParaLocal);
          const next = [...alocacoes.filter((a) => String(a.id) !== String(item.id)), ...camelData];
          salvarLocalStorage(next);
          setAlocacoes(next);
          camelData.forEach((alc: any) => {
            sincronizarOSEscala(alc).then((res) => {
              if (!res.sucesso) console.warn("[Escala] sync OS ignorada:", res.erro || res.acao);
            }).catch((e: any) => {
              console.error("[Escala] Erro ao sincronizar OS:", e);
            });
          });
          return { sucesso: true, mensagem: "Alocação enviada ao Supabase.", data: camelData };
        }

        if (error) {
          console.error("[Escala] Supabase falhou ao criar alocação:", error.message);
          setErroSupabase(error.message);
          setError(error.message);
          setLoading(false);
          return { sucesso: false, mensagem: `Supabase: ${error.message}` };
        }
      }

      const itemCamel = mapearBancoParaLocal(mapearLocalParaBanco(item));
      const next = [...alocacoes.filter((a) => String(a.id) !== String(item.id)), itemCamel];
      salvarLocalStorage(next);
      setAlocacoes(next);
      return { sucesso: true, mensagem: "Alocação salva localmente.", data: itemCamel };
    } catch (err) {
      const mensagemErro = String((err as Error)?.message || err);
      console.warn("[Escala] Exceção ao criar alocação:", mensagemErro);
      setError(mensagemErro);
      return { sucesso: false, mensagem: mensagemErro };
    } finally {
      setLoading(false);
    }
  }, [alocacoes, usandoSupabase]);

  const atualizarAlocacao = useCallback(async (id: string, updates: Record<string, any>): Promise<ResultadoOperacao> => {
    setLoading(true);
    setError(null);
    setMensagem("");
    try {
      if (!id) {
        throw new Error("ID da alocação é obrigatório");
      }

      if (usandoSupabase) {
        const updatesBanco = mapearLocalParaBanco(updates);
        delete updatesBanco.id;
        Object.keys(updatesBanco).forEach((k) => {
          if (updatesBanco[k] === undefined || updatesBanco[k] === null || updatesBanco[k] === "") {
            delete updatesBanco[k];
          }
        });
        console.log("[ESCALA_DEBUG] Payload update:", JSON.stringify(updatesBanco, null, 2));
        const { data, error } = await supabase
          .from("alocacoes_escala")
          .update(updatesBanco)
          .eq("id", id)
          .select();

        if (!error && data) {
          const camelData = (Array.isArray(data) ? data : [data]).map(mapearBancoParaLocal);
          const next = alocacoes.map((alocacao) =>
            String(alocacao.id) === String(id) ? { ...alocacao, ...camelData[0] } : alocacao
          );
          salvarLocalStorage(next);
          setAlocacoes(next);
          camelData.forEach((alc: any) => {
            sincronizarOSEscala(alc).then((res) => {
              if (!res.sucesso) console.warn("[Escala] sync OS ignorada:", res.erro || res.acao);
            }).catch((e: any) => {
              console.error("[Escala] Erro ao sincronizar OS:", e);
            });
          });
          return { sucesso: true, mensagem: "Alocação atualizada.", data: camelData };
        }

        if (error) {
          console.error("[Escala] Supabase falhou ao atualizar alocação:", error.message);
          setErroSupabase(error.message);
          setError(error.message);
          setLoading(false);
          return { sucesso: false, mensagem: `Supabase: ${error.message}` };
        }
      }

      const updatesCamel = mapearBancoParaLocal(mapearLocalParaBanco(updates));
      const next = alocacoes.map((alocacao) =>
        String(alocacao.id) === String(id) ? { ...alocacao, ...updatesCamel } : alocacao
      );
      salvarLocalStorage(next);
      setAlocacoes(next);
      return { sucesso: true, mensagem: "Alocação atualizada localmente.", data: next };
    } catch (err) {
      const mensagemErro = String((err as Error)?.message || err);
      console.warn("[Escala] Exceção ao atualizar alocação:", mensagemErro);
      setError(mensagemErro);
      return { sucesso: false, mensagem: mensagemErro };
    } finally {
      setLoading(false);
    }
  }, [alocacoes, usandoSupabase]);

  const cancelarAlocacao = useCallback(async (id: string, motivo?: string): Promise<ResultadoOperacao> => {
    setLoading(true);
    setError(null);
    setMensagem("");
    try {
      if (!id) {
        throw new Error("ID da alocação é obrigatório");
      }

      if (usandoSupabase) {
        const { data, error } = await supabase
          .from("alocacoes_escala")
          .update({ status: "cancelada", status_pagamento: "cancelado", observacoes: motivo })
          .eq("id", id)
          .select();

        if (!error && data) {
          const camelData = (Array.isArray(data) ? data : [data]).map(mapearBancoParaLocal);
          const next = alocacoes.map((alocacao) =>
            String(alocacao.id) === String(id) ? { ...alocacao, ...camelData[0] } : alocacao
          );
          salvarLocalStorage(next);
          setAlocacoes(next);
          return { sucesso: true, mensagem: "Alocação cancelada.", data: camelData };
        }

        if (error) {
          console.error("[Escala] Supabase falhou ao cancelar alocação:", error.message);
          setErroSupabase(error.message);
          setError(error.message);
          setLoading(false);
          return { sucesso: false, mensagem: `Supabase: ${error.message}` };
        }
      }

      const statusCanceladoBanco = normalizarStatusParaBanco("cancelado");
      const next = alocacoes.map((alocacao) =>
        String(alocacao.id) === String(id) ? { ...alocacao, status: statusCanceladoBanco, statusPagamento: "cancelado", observacoes: motivo } : alocacao
      );
      salvarLocalStorage(next);
      setAlocacoes(next);
      return { sucesso: true, mensagem: "Alocação cancelada localmente.", data: next };
    } catch (err) {
      const mensagemErro = String((err as Error)?.message || err);
      console.warn("[Escala] Exceção ao cancelar alocação:", mensagemErro);
      setError(mensagemErro);
      return { sucesso: false, mensagem: mensagemErro };
    } finally {
      setLoading(false);
    }
  }, [alocacoes, usandoSupabase]);

  const aceitarAlocacaoHook = useCallback(async (id: string, prestadorId: string): Promise<ResultadoOperacao> => {
    setLoading(true);
    setError(null);
    setMensagem("");
    try {
      if (!id) throw new Error("ID da alocação é obrigatório");

      if (usandoSupabase) {
        const resultado = await escalaAceitarAlocacao(id, prestadorId);
        if (resultado.sucesso && resultado.dados) {
          const camelData = mapearBancoParaLocal(resultado.dados as Record<string, any>);
          const next = alocacoes.map((a) =>
            String(a.id) === String(id) ? { ...a, ...camelData } : a
          );
          salvarLocalStorage(next);
          setAlocacoes(next);
          return { sucesso: true, mensagem: "Alocação aceita.", data: camelData };
        }
        console.warn("[Escala] Falha ao aceitar alocação no Supabase:", resultado.erro || resultado.mensagem);
        setFonteDados('localStorage');
        setErroSupabase(resultado.erro || "Falha ao aceitar alocação no Supabase");
      }

      const statusAceita = normalizarStatusParaBanco("aceita");
      const updates = {
        status: statusAceita,
        aceite_prestador: true,
        data_aceite: new Date().toISOString(),
      };
      const next = alocacoes.map((a) =>
        String(a.id) === String(id) ? { ...a, ...updates } : a
      );
      salvarLocalStorage(next);
      setAlocacoes(next);
      return { sucesso: true, mensagem: "Alocação aceita localmente.", data: next };
    } catch (err) {
      const mensagemErro = String((err as Error)?.message || err);
      setError(mensagemErro);
      return { sucesso: false, mensagem: mensagemErro };
    } finally {
      setLoading(false);
    }
  }, [alocacoes, usandoSupabase]);

  const iniciarRotaHook = useCallback(async (id: string, prestadorId?: string): Promise<ResultadoOperacao> => {
    setLoading(true);
    setError(null);
    setMensagem("");
    try {
      if (!id) throw new Error("ID da alocação é obrigatório");

      if (usandoSupabase) {
        const resultado = await escalaIniciarRota(id, prestadorId);
        if (resultado.sucesso && resultado.dados) {
          const camelData = mapearBancoParaLocal(resultado.dados as Record<string, any>);
          const next = alocacoes.map((a) =>
            String(a.id) === String(id) ? { ...a, ...camelData } : a
          );
          salvarLocalStorage(next);
          setAlocacoes(next);
          return { sucesso: true, mensagem: "Rota iniciada no Supabase.", data: camelData };
        }
        console.warn("[Escala] Falha ao iniciar rota no Supabase:", resultado.erro || resultado.mensagem);
        setFonteDados('localStorage');
        setErroSupabase(resultado.erro || "Falha ao iniciar rota no Supabase");
      }

      const next = alocacoes.map((a) =>
        String(a.id) === String(id)
          ? { ...a, status: "em_rota", horarioInicioReal: new Date().toISOString() }
          : a
      );
      salvarLocalStorage(next);
      setAlocacoes(next);
      return { sucesso: true, mensagem: "Rota iniciada localmente.", data: next };
    } catch (err) {
      const mensagemErro = String((err as Error)?.message || err);
      setError(mensagemErro);
      return { sucesso: false, mensagem: mensagemErro };
    } finally {
      setLoading(false);
    }
  }, [alocacoes, usandoSupabase]);

  const finalizarAlocacaoHook = useCallback(async (
    id: string,
    dados: { comprovante_url?: string; observacoes?: string; horario_fim_real?: string },
    prestadorId?: string
  ): Promise<ResultadoOperacao> => {
    setLoading(true);
    setError(null);
    setMensagem("");
    try {
      if (!id) throw new Error("ID da alocação é obrigatório");

      if (usandoSupabase) {
        const resultado = await escalaFinalizarAlocacao(
          id,
          {
            horario_fim_real: dados.horario_fim_real || new Date().toISOString(),
            comprovante_url: dados.comprovante_url,
            observacoes: dados.observacoes,
          },
          prestadorId
        );
        if (resultado.sucesso && resultado.dados) {
          const camelData = mapearBancoParaLocal(resultado.dados as Record<string, any>);
          const next = alocacoes.map((a) =>
            String(a.id) === String(id) ? { ...a, ...camelData } : a
          );
          salvarLocalStorage(next);
          setAlocacoes(next);
          return { sucesso: true, mensagem: "Viagem finalizada no Supabase.", data: camelData };
        }
        console.warn("[Escala] Falha ao finalizar alocação no Supabase:", resultado.erro || resultado.mensagem);
        setFonteDados('localStorage');
        setErroSupabase(resultado.erro || "Falha ao finalizar alocação no Supabase");
      }

      const next = alocacoes.map((a) =>
        String(a.id) === String(id)
          ? {
              ...a,
              status: "concluida",
              finalizada: true,
              horarioFimReal: dados.horario_fim_real || new Date().toISOString(),
              comprovanteUrl: dados.comprovante_url,
              observacoes: dados.observacoes,
            }
          : a
      );
      salvarLocalStorage(next);
      setAlocacoes(next);
      return { sucesso: true, mensagem: "Viagem finalizada localmente.", data: next };
    } catch (err) {
      const mensagemErro = String((err as Error)?.message || err);
      setError(mensagemErro);
      return { sucesso: false, mensagem: mensagemErro };
    } finally {
      setLoading(false);
    }
  }, [alocacoes, usandoSupabase]);

  const recusarAlocacaoHook = useCallback(async (id: string, prestadorId: string, motivo?: string): Promise<ResultadoOperacao> => {
    setLoading(true);
    setError(null);
    setMensagem("");
    try {
      if (!id) throw new Error("ID da alocação é obrigatório");

      if (usandoSupabase) {
        const resultado = await escalaRecusarAlocacao(id, prestadorId, motivo || "Recusado pelo prestador");
        if (resultado.sucesso && resultado.dados) {
          const camelData = mapearBancoParaLocal(resultado.dados as Record<string, any>);
          const next = alocacoes.map((a) =>
            String(a.id) === String(id) ? { ...a, ...camelData } : a
          );
          salvarLocalStorage(next);
          setAlocacoes(next);
          return { sucesso: true, mensagem: "Alocação recusada.", data: camelData };
        }
        console.warn("[Escala] Falha ao recusar alocação no Supabase:", resultado.erro || resultado.mensagem);
        setFonteDados('localStorage');
        setErroSupabase(resultado.erro || "Falha ao recusar alocação no Supabase");
      }

      const statusRecusada = normalizarStatusParaBanco("recusada");
      const updates = {
        status: statusRecusada,
        aceite_prestador: false,
        motivo_recusa: motivo || "Recusado pelo prestador",
      };
      const next = alocacoes.map((a) =>
        String(a.id) === String(id) ? { ...a, ...updates } : a
      );
      salvarLocalStorage(next);
      setAlocacoes(next);
      return { sucesso: true, mensagem: "Alocação recusada localmente.", data: next };
    } catch (err) {
      const mensagemErro = String((err as Error)?.message || err);
      setError(mensagemErro);
      return { sucesso: false, mensagem: mensagemErro };
    } finally {
      setLoading(false);
    }
  }, [alocacoes, usandoSupabase]);

  return {
    alocacoes,
    loading,
    error,
    mensagem,
    usandoSupabase,
    fonteDados,
    erroSupabase,
    carregarAlocacoes,
    criarAlocacao,
    atualizarAlocacao,
    cancelarAlocacao,
    aceitarAlocacao: aceitarAlocacaoHook,
    recusarAlocacao: recusarAlocacaoHook,
    iniciarRota: iniciarRotaHook,
    finalizarAlocacao: finalizarAlocacaoHook,
  };
}
