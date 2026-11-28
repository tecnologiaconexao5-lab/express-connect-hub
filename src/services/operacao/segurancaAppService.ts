import { supabase } from "@/lib/supabase";
import { urlAssinadaEvidencia } from "@/services/volumesService";

export type TipoOcorrenciaSeguranca =
  | "sos_emergencia"
  | "acidente"
  | "roubo_furto"
  | "pane_mecanica"
  | "problema_carga"
  | "atraso_transito";

export type SeveridadeOcorrenciaSeguranca = "critica" | "alta" | "media";
export type StatusOcorrenciaSeguranca = "aberta" | "em_atendimento" | "encerrada";

export interface OcorrenciaSegurancaApp {
  id: string;
  prestador_id: string;
  ordem_servico_id?: string | null;
  tipo: TipoOcorrenciaSeguranca;
  severidade: SeveridadeOcorrenciaSeguranca;
  descricao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  fotos_paths?: string[] | null;
  status: StatusOcorrenciaSeguranca;
  atendido_por?: string | null;
  created_at: string;
  updated_at?: string | null;
  // Enriquecimento
  prestador_nome?: string | null;
  prestador_telefone?: string | null;
  prestador_whatsapp?: string | null;
  os_numero?: string | null;
}

export const TIPO_OCORRENCIA_SEGURANCA: Record<TipoOcorrenciaSeguranca, string> = {
  sos_emergencia: "SOS emergência",
  acidente: "Acidente",
  roubo_furto: "Roubo / furto",
  pane_mecanica: "Pane mecânica",
  problema_carga: "Problema com a carga",
  atraso_transito: "Atraso no trânsito",
};

export const SEVERIDADE_OCORRENCIA_SEGURANCA: Record<SeveridadeOcorrenciaSeguranca, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
};

export const SEVERIDADE_TONE: Record<SeveridadeOcorrenciaSeguranca, string> = {
  critica: "bg-red-600 text-white border-red-700",
  alta: "bg-orange-100 text-orange-700 border-orange-200",
  media: "bg-amber-100 text-amber-700 border-amber-200",
};

export const STATUS_OCORRENCIA_SEGURANCA: Record<StatusOcorrenciaSeguranca, string> = {
  aberta: "Aberta",
  em_atendimento: "Em atendimento",
  encerrada: "Encerrada",
};

export async function listarOcorrenciasSeguranca(filtros: {
  status?: StatusOcorrenciaSeguranca | "todos";
  limite?: number;
} = {}): Promise<OcorrenciaSegurancaApp[]> {
  let query = supabase
    .from("ocorrencias_seguranca_app")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filtros.limite ?? 200);

  if (filtros.status && filtros.status !== "todos") query = query.eq("status", filtros.status);

  const { data, error } = await query;
  if (error) {
    console.warn("[segurancaAppService] listar:", error.message);
    return [];
  }
  const rows = (data || []) as OcorrenciaSegurancaApp[];
  if (rows.length === 0) return [];

  const prestadorIds = [...new Set(rows.map((r) => r.prestador_id).filter(Boolean))] as string[];
  const osIds = [...new Set(rows.map((r) => r.ordem_servico_id).filter(Boolean))] as string[];

  const [prestRes, osRes] = await Promise.all([
    prestadorIds.length
      ? supabase.from("prestadores").select("id, nome_completo, telefone, whatsapp").in("id", prestadorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nome_completo?: string; telefone?: string; whatsapp?: string }> }),
    osIds.length
      ? supabase.from("ordens_servico").select("id, numero").in("id", osIds)
      : Promise.resolve({ data: [] as Array<{ id: string; numero?: string }> }),
  ]);

  const prestMap = new Map(((prestRes.data || []) as any[]).map((p) => [p.id, p]));
  const osMap = new Map(((osRes.data || []) as any[]).map((o) => [o.id, o.numero]));

  return rows.map((r) => {
    const prest = prestMap.get(r.prestador_id) as any;
    return {
      ...r,
      prestador_nome: prest?.nome_completo || null,
      prestador_telefone: prest?.telefone || null,
      prestador_whatsapp: prest?.whatsapp || null,
      os_numero: r.ordem_servico_id ? ((osMap.get(r.ordem_servico_id) as string | undefined) || null) : null,
    };
  });
}

export async function atualizarStatusOcorrenciaSeguranca(input: {
  id: string;
  status: StatusOcorrenciaSeguranca;
  usuarioId?: string | null;
}): Promise<void> {
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.status === "em_atendimento" || input.status === "encerrada") {
    patch.atendido_por = input.usuarioId || null;
  }
  const { error } = await supabase.from("ocorrencias_seguranca_app").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function urlAssinadaFotoSeguranca(path: string | null | undefined): Promise<string | null> {
  return urlAssinadaEvidencia(path, ["driver-evidence", "ocorrencias-seguranca", "documentos-prestadores"]);
}

export function beepAlertaSos(): void {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 500);
  } catch {
    /* áudio bloqueado pelo navegador — sem impacto funcional */
  }
}

// ============================================================================
// Governança anti-abuso: parecer da Torre, distância até a próxima parada e
// bloqueio de novas oportunidades enquanto houver ocorrência ativa.
// ============================================================================

export type ParecerTorre = "comprovada_forca_maior" | "acionamento_indevido" | "acionamento_acidental";

export const PARECERES_TORRE: Array<{ value: ParecerTorre; label: string; descricao: string }> = [
  {
    value: "comprovada_forca_maior",
    label: "Comprovada força maior",
    descricao: "Ocorrência real comprovada (sem penalidade ao prestador parceiro).",
  },
  {
    value: "acionamento_indevido",
    label: "Acionamento indevido",
    descricao: "Má-fé / desistência sem evidência (registra alerta de confiabilidade no histórico).",
  },
  {
    value: "acionamento_acidental",
    label: "Acionamento acidental",
    descricao: "Engano confirmado.",
  },
];

export function parecerTorreLabel(valor?: string | null): string {
  return PARECERES_TORRE.find((p) => p.value === valor)?.label || "—";
}

export async function listarOcorrenciasAtivasPrestador(prestadorId: string): Promise<OcorrenciaSegurancaApp[]> {
  if (!prestadorId) return [];
  const { data, error } = await supabase
    .from("ocorrencias_seguranca_app")
    .select("*")
    .eq("prestador_id", prestadorId)
    .in("status", ["aberta", "em_atendimento"])
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[segurancaAppService] listarAtivasPrestador:", error.message);
    return [];
  }
  return (data || []) as OcorrenciaSegurancaApp[];
}

export interface DistanciaProximaParada {
  km: number;
  metros: number;
  descricao: string;
  paradaId?: string | null;
}

const STATUS_PARADA_CONCLUIDA = new Set([
  "entregue",
  "concluida",
  "concluído",
  "finalizada",
  "cancelada",
  "cancelado",
]);

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Distância GPS do acionamento até a próxima parada pendente da OS/rota ativa.
 * Prioriza `rota_paradas` (OS alocada) e faz fallback para `ordens_servico.enderecos`.
 */
export async function calcularDistanciaProximaParada(
  ocorrencia: OcorrenciaSegurancaApp,
): Promise<DistanciaProximaParada | null> {
  const lat = Number(ocorrencia.latitude);
  const lng = Number(ocorrencia.longitude);
  const osId = ocorrencia.ordem_servico_id;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !osId) return null;

  let alvo: { lat: number; lng: number; descricao: string; paradaId?: string | null } | null = null;

  const { data: paradasOS } = await supabase
    .from("rota_paradas")
    .select("id, sequencia, status, latitude, longitude, logradouro, endereco, numero, bairro, cidade, uf")
    .eq("os_id", osId)
    .order("sequencia", { ascending: true });

  let pendentes = ((paradasOS || []) as any[]).filter(
    (p) =>
      p.latitude != null &&
      p.longitude != null &&
      !STATUS_PARADA_CONCLUIDA.has(String(p.status || "").toLowerCase()),
  );

  if (pendentes.length === 0) {
    const { data: alocacao } = await supabase
      .from("alocacoes_escala")
      .select("id")
      .eq("ordem_servico_id", osId)
      .eq("prestador_id", ocorrencia.prestador_id)
      .not("status", "in", "(cancelada,recusada)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const alocacaoId = (alocacao as { id?: string } | null)?.id;
    if (alocacaoId) {
      const { data: paradasAloc } = await supabase
        .from("rota_paradas")
        .select("id, sequencia, status, latitude, longitude, logradouro, endereco, numero, bairro, cidade, uf")
        .eq("alocacao_id", alocacaoId)
        .order("sequencia", { ascending: true });
      pendentes = ((paradasAloc || []) as any[]).filter(
        (p) =>
          p.latitude != null &&
          p.longitude != null &&
          !STATUS_PARADA_CONCLUIDA.has(String(p.status || "").toLowerCase()),
      );
    }
  }

  if (pendentes.length > 0) {
    const p = pendentes[0];
    const texto = [p.logradouro || p.endereco, p.numero, p.bairro, p.cidade, p.uf]
      .filter(Boolean)
      .join(" · ");
    alvo = {
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      descricao: texto || "Próxima parada",
      paradaId: p.id || null,
    };
  }

  if (!alvo) {
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("enderecos")
      .eq("id", osId)
      .maybeSingle();
    const lista = Array.isArray((os as any)?.enderecos) ? ((os as any).enderecos as any[]) : [];
    const candidatas = lista
      .filter(
        (e) =>
          e &&
          e.latitude != null &&
          e.longitude != null &&
          !STATUS_PARADA_CONCLUIDA.has(String(e.statusPonto || e.status || "").toLowerCase()),
      )
      .sort((a, b) => Number(a.sequencia || 0) - Number(b.sequencia || 0));
    if (candidatas[0]) {
      const e = candidatas[0];
      const texto = [e.tipo, e.logradouro || e.endereco, e.numero, e.bairro, e.cidade, e.estado || e.uf]
        .filter(Boolean)
        .join(" · ");
      alvo = {
        lat: Number(e.latitude),
        lng: Number(e.longitude),
        descricao: texto || "Próxima parada",
        paradaId: null,
      };
    }
  }

  if (!alvo) return null;
  const km = haversineKm(lat, lng, alvo.lat, alvo.lng);
  return {
    km: Math.round(km * 100) / 100,
    metros: Math.round(km * 1000),
    descricao: alvo.descricao,
    paradaId: alvo.paradaId || null,
  };
}

export async function atualizarDistanciaProximaParada(id: string, km: number | null): Promise<void> {
  if (!id) return;
  const { error } = await supabase
    .from("ocorrencias_seguranca_app")
    .update({ distancia_proxima_parada_km: km, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.warn("[segurancaAppService] distanciaProximaParada:", error.message);
}

export async function encerrarOcorrenciaSeguranca(input: {
  ocorrencia: OcorrenciaSegurancaApp;
  parecer: ParecerTorre;
  observacao?: string | null;
  usuarioId?: string | null;
}): Promise<void> {
  const { ocorrencia, parecer } = input;
  const agora = new Date().toISOString();
  const observacao = (input.observacao || "").trim();
  const label = parecerTorreLabel(parecer);
  const marcador = `[Encerramento Torre] Parecer: ${label}${observacao ? ` — ${observacao}` : ""}`;
  const descricaoAtual = ocorrencia.descricao || "";
  const novaDescricao = descricaoAtual.includes("[Encerramento Torre]")
    ? descricaoAtual
    : `${descricaoAtual}${descricaoAtual ? "\n\n" : ""}${marcador}`;

  const { error } = await supabase
    .from("ocorrencias_seguranca_app")
    .update({
      status: "encerrada",
      parecer_torre: parecer,
      atendido_por: input.usuarioId || null,
      descricao: novaDescricao,
      updated_at: agora,
    })
    .eq("id", ocorrencia.id);
  if (error) throw new Error(error.message);

  if (parecer === "acionamento_indevido") {
    // Alerta de confiabilidade no histórico do prestador parceiro (aba Ocorrências).
    try {
      const { data: existente } = await supabase
        .from("ocorrencias")
        .select("id")
        .eq("prestador_id", ocorrencia.prestador_id)
        .eq("tipo", "Acionamento indevido")
        .contains("metadata", { ocorrencia_id: ocorrencia.id })
        .maybeSingle();

      if (!existente) {
        await supabase.from("ocorrencias").insert({
          os_id: ocorrencia.ordem_servico_id || null,
          prestador_id: ocorrencia.prestador_id,
          tipo: "Acionamento indevido",
          descricao: `Parecer da Torre: ${label}.${observacao ? ` ${observacao}` : ""}`,
          status: "pendente",
          severidade: "alta",
          prioridade: "alta",
          visivel_cliente: false,
          metadata: {
            origem: "sos_seguranca_app",
            ocorrencia_id: ocorrencia.id,
            parecer_torre: parecer,
          },
        });
      }
    } catch (e) {
      console.warn("[segurancaAppService] histórico confiabilidade:", e);
    }

    // Evento no Event Bus da Torre.
    try {
      await supabase.from("eventos_oficiais").insert({
        event_type: "app.acionamento_indevido",
        entity_type: "ocorrencia_seguranca_app",
        entity_id: ocorrencia.id,
        status: "active",
        source: "service",
        visibility: "internal",
        payload: {
          titulo: "Acionamento indevido de SOS",
          mensagem: observacao || "Acionamento indevido registrado pela Torre de Controle.",
          prestador_id: ocorrencia.prestador_id,
          os_id: ocorrencia.ordem_servico_id,
          parecer_torre: parecer,
          ocorrencia_id: ocorrencia.id,
        },
      });
    } catch (e) {
      console.warn("[segurancaAppService] evento confiabilidade:", e);
    }
  }
}
