import { supabase } from "@/lib/supabase";
import { criarLinkPublico, obterOSPorToken } from "@/services/communicationHubService";

export interface TrackingPosition {
  latitude: number;
  longitude: number;
  velocidade?: number;
  precisao?: number;
  direcao?: number;
  bateria?: number;
  captured_at?: string;
  updated_at?: string;
  created_at?: string;
  alocacao_id?: string;
  prestador_id?: string;
  os_id?: string;
  cliente_id?: string;
  veiculo_id?: string;
  status?: string;
  origem?: string;
}

export interface TrackingSubscription {
  unsubscribe: () => void;
}

export interface RegistrarPosicaoMotoristaParams {
  alocacao_id: string;
  latitude: number;
  longitude: number;
  velocidade?: number;
  precisao?: number;
  direcao?: number;
  bateria?: number;
  captured_at?: string;
}

export async function gerarLinkRastreio(osId: string): Promise<{ token: string; link: string } | null> {
  const result = await criarLinkPublico(osId);
  if (!result) return null;
  const baseUrl = window.location.origin;
  return {
    token: result.token_publico,
    link: `${baseUrl}/rastreamento/${result.token_publico}`,
  };
}

export { obterOSPorToken };

/**
 * M106 — Registra posição do motorista via RPC do Supabase.
 * Esta é a função que o App Motorista (Flutter) chama via supabase.rpc().
 * Também pode ser chamada por qualquer componente TMS para teste/fallback.
 * 
 * Validações feitas pelo RPC no banco:
 *   - Autenticação (auth.uid())
 *   - Coordenadas válidas (não 0,0, latitude -90..90, longitude -180..180)
 *   - Alocação ativa do motorista (status: aceita, em_rota, ocorrencia)
 *   - Deduplicação (mesma coordenada nos últimos 5s)
 */
export async function registrarPosicaoViaRPC(
  params: RegistrarPosicaoMotoristaParams
): Promise<{ ok: boolean; error?: string; deduplicated?: boolean }> {
  const { data, error } = await supabase.rpc("registrar_posicao_motorista", {
    p_alocacao_id: params.alocacao_id,
    p_latitude: params.latitude,
    p_longitude: params.longitude,
    p_velocidade: params.velocidade ?? null,
    p_precisao: params.precisao ?? null,
    p_direcao: params.direcao ?? null,
    p_bateria: params.bateria ?? null,
    p_captured_at: params.captured_at ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return data as { ok: boolean; error?: string; deduplicated?: boolean };
}

export async function obterPosicaoAtual(osId: string): Promise<TrackingPosition | null> {
  return obterPosicaoAtualPorAlocacao(undefined, osId);
}

export async function obterPosicaoAtualPorAlocacao(
  alocacaoId?: string,
  osId?: string,
): Promise<TrackingPosition | null> {
  let query = supabase
    .from("portal_tracking_realtime")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (alocacaoId) query = query.eq("alocacao_id", alocacaoId);
  else if (osId) query = query.eq("os_id", osId);
  else return null;

  const { data, error } = await query.maybeSingle();

  if (error || !data) return null;
  return mapPositionFromDB(data);
}

function mapPositionFromDB(data: Record<string, any>): TrackingPosition {
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    velocidade: data.velocidade,
    precisao: data.precisao,
    direcao: data.direcao,
    bateria: data.bateria,
    captured_at: data.captured_at,
    updated_at: data.updated_at,
    created_at: data.created_at,
    alocacao_id: data.alocacao_id,
    prestador_id: data.prestador_id,
    os_id: data.os_id,
    cliente_id: data.cliente_id,
    veiculo_id: data.veiculo_id,
    status: data.status,
    origem: data.origem,
  };
}

export function inscreverPosicaoEmTempoReal(
  alocacaoId: string,
  onPosition: (pos: TrackingPosition) => void,
): TrackingSubscription {
  const channel = supabase
    .channel(`tracking-alocacao-${alocacaoId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "portal_tracking_realtime",
        filter: `alocacao_id=eq.${alocacaoId}`,
      },
      (payload) => {
        if (payload.new) onPosition(mapPositionFromDB(payload.new));
      },
    )
    .subscribe();

  return { unsubscribe: () => supabase.removeChannel(channel) };
}

export function inscreverPosicaoPorCliente(
  clienteId: string,
  onPosition: (pos: TrackingPosition) => void,
): TrackingSubscription {
  const channel = supabase
    .channel(`tracking-cliente-${clienteId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "portal_tracking_realtime",
        filter: `cliente_id=eq.${clienteId}`,
      },
      (payload) => {
        if (payload.new) onPosition(mapPositionFromDB(payload.new));
      },
    )
    .subscribe();

  return { unsubscribe: () => supabase.removeChannel(channel) };
}

function coordenadasValidas(lat: number, lng: number): boolean {
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

export async function registrarPosicao(params: {
  alocacao_id: string;
  cliente_id?: string;
  os_id?: string;
  prestador_id?: string;
  latitude: number;
  longitude: number;
  velocidade?: number;
  precisao?: number;
  direcao?: number;
  bateria?: number;
  captured_at?: string;
}): Promise<boolean> {
  if (!coordenadasValidas(params.latitude, params.longitude)) {
    console.warn('[Tracking] Coordenadas inválidas:', params.latitude, params.longitude);
    return false;
  }

  const { error } = await supabase.from("portal_tracking_realtime").insert({
    alocacao_id: params.alocacao_id,
    cliente_id: params.cliente_id || null,
    os_id: params.os_id || null,
    prestador_id: params.prestador_id || null,
    latitude: params.latitude,
    longitude: params.longitude,
    velocidade: params.velocidade || 0,
    precisao: params.precisao || null,
    direcao: params.direcao || null,
    bateria: params.bateria ?? null,
    captured_at: params.captured_at || new Date().toISOString(),
    status: "online",
    origem: "tms_manual",
  });

  return !error;
}

export async function buscarUltimasPosicoes(): Promise<TrackingPosition[]> {
  const { data, error } = await supabase
    .from("portal_tracking_realtime")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  const latestPerAlocacao = new Map<string, TrackingPosition>();
  for (const row of data) {
    // MISSÃO A25-B: só considera posições recentes (captured_at prioritário,
    // created_at como fallback) para não exibir seed antigo como motorista online.
    const ts = row.captured_at || row.created_at;
    if (!ts) continue;
    const idadeMin = (Date.now() - new Date(ts).getTime()) / 60000;
    if (idadeMin < 0 || idadeMin > 60) continue;

    const key = row.alocacao_id || row.os_id || row.id;
    if (!latestPerAlocacao.has(key)) {
      latestPerAlocacao.set(key, mapPositionFromDB(row));
    }
  }

  return Array.from(latestPerAlocacao.values());
}

export async function listarAlocacoesAtivasPorCliente(clienteId: string) {
  const { data, error } = await supabase
    .from("alocacoes_escala")
    .select(`
      id,
      status,
      origem,
      destino,
      horario_inicio_real,
      horario_fim_real,
      data_finalizacao,
      prestador_id,
      ordem_servico_id,
      placa,
      tipo_veiculo,
      prestadores!alocacoes_escala_prestador_id_fkey (nome_completo, telefone),
      ordens_servico!alocacoes_escala_ordem_servico_id_fkey (id, numero, status)
    `)
    .eq("cliente_id", clienteId)
    .in("status", ["aceita", "em_rota", "ocorrencia", "aguardando_aceite"])
    .order("data_escala", { ascending: false });

  if (error) return [];
  return data || [];
}

export async function consultarUltimaPosicao(prestadorId: string): Promise<TrackingPosition | null> {
  const { data, error } = await supabase
    .from("portal_tracking_realtime")
    .select("*")
    .eq("prestador_id", prestadorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapPositionFromDB(data);
}

export function inscreverPosicaoPorPrestador(
  prestadorId: string,
  onPosition: (pos: TrackingPosition) => void,
): TrackingSubscription {
  const channel = supabase
    .channel(`tracking-prestador-${prestadorId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "portal_tracking_realtime",
        filter: `prestador_id=eq.${prestadorId}`,
      },
      (payload) => {
        if (payload.new) onPosition(mapPositionFromDB(payload.new));
      },
    )
    .subscribe();

  return { unsubscribe: () => supabase.removeChannel(channel) };
}

/* ============================================================
 * MISSÃO A25-D — ALOCAÇÕES ATIVAS SEM OS (Grupo 2 do mapa da Torre)
 * Retorna alocações ativas (aceita/em_rota/ocorrencia) sem ordem_servico_id,
 * enriquecidas com prestador/veículo/metadata, para representação no mapa.
 * ============================================================ */

export interface AlocacaoOperacionalSemOS {
  id: string;
  status: string;
  prestador_id: string | null;
  prestador_nome: string | null;
  veiculo_tipo: string | null;
  placa: string | null;
  origem: string | null;
  destino: string | null;
  numero_os: string | null;
  romaneio: string | null;
  etapa_app: string | null;
  metadata: Record<string, any> | null;
}

export async function buscarAlocacoesSemOS(limit: number = 50): Promise<AlocacaoOperacionalSemOS[]> {
  try {
    const { data, error } = await supabase
      .from("alocacoes_escala")
      .select(`
        id,
        status,
        prestador_id,
        placa,
        tipo_veiculo,
        origem,
        destino,
        metadata,
        prestadores:prestador_id(id, nome_completo)
      `)
      .in("status", ["aceita", "em_rota", "ocorrencia"])
      .is("ordem_servico_id", null)
      .limit(limit);

    if (error) {
      console.warn("[trackingService] Erro ao buscar alocações sem OS:", error.message);
      return [];
    }

    return (data || []).map((a: any) => {
      const meta = a.metadata || {};
      const app = meta.app_motorista || {};
      return {
        id: a.id,
        status: a.status,
        prestador_id: a.prestador_id || null,
        prestador_nome: a.prestadores?.nome_completo || null,
        veiculo_tipo: a.tipo_veiculo || null,
        placa: a.placa || null,
        origem: a.origem || null,
        destino: a.destino || null,
        numero_os: app.numero_os || null,
        romaneio: app.romaneio || null,
        etapa_app: app.etapa_atual || null,
        metadata: meta,
      };
    });
  } catch (err) {
    console.error("[trackingService] Exceção ao buscar alocações sem OS:", err);
    return [];
  }
}
