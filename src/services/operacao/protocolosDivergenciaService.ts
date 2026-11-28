import { supabase } from "@/lib/supabase";
import { urlAssinadaEvidencia } from "@/services/volumesService";

export type ProtocoloStatus = "aberta" | "em_analise" | "aguardando_info" | "resolvida";

export interface ProtocoloDivergencia {
  id: string;
  numero_protocolo: string;
  ordem_servico_id: string;
  cliente_id?: string | null;
  prestador_id?: string | null;
  volumes_enviados: number;
  volumes_entregues: number;
  volumes_esperados_retorno: number;
  volumes_recebidos_retorno: number;
  quantidade_divergente: number;
  motivo?: string | null;
  observacoes?: string | null;
  fotos_paths?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  responsavel_recebimento?: string | null;
  status: ProtocoloStatus;
  resolucao_notas?: string | null;
  resolvido_por?: string | null;
  resolvido_em?: string | null;
  created_at: string;
  updated_at?: string | null;
  // Enriquecimento
  os_numero?: string | null;
  os_status?: string | null;
  cliente_nome?: string | null;
  prestador_nome?: string | null;
}

export interface ProtocoloFiltros {
  status?: ProtocoloStatus | "todos";
  clienteId?: string | null;
  prestadorId?: string | null;
  limite?: number;
}

export const PROTOCOLO_STATUS_LABEL: Record<ProtocoloStatus, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_info: "Aguardando informação",
  resolvida: "Resolvida",
};

export const PROTOCOLO_STATUS_TONE: Record<ProtocoloStatus, string> = {
  aberta: "bg-red-100 text-red-700 border-red-200",
  em_analise: "bg-amber-100 text-amber-700 border-amber-200",
  aguardando_info: "bg-sky-100 text-sky-700 border-sky-200",
  resolvida: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export async function listarProtocolosDivergencia(
  filtros: ProtocoloFiltros = {},
): Promise<ProtocoloDivergencia[]> {
  let query = supabase
    .from("protocolos_divergencia")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filtros.limite ?? 300);

  if (filtros.status && filtros.status !== "todos") query = query.eq("status", filtros.status);
  if (filtros.clienteId) query = query.eq("cliente_id", filtros.clienteId);
  if (filtros.prestadorId) query = query.eq("prestador_id", filtros.prestadorId);

  const { data, error } = await query;
  if (error) {
    console.warn("[protocolosDivergenciaService] listar:", error.message);
    return [];
  }
  const protocolos = (data || []) as ProtocoloDivergencia[];
  if (protocolos.length === 0) return [];

  const osIds = [...new Set(protocolos.map((p) => p.ordem_servico_id).filter(Boolean))] as string[];
  const clienteIds = [...new Set(protocolos.map((p) => p.cliente_id).filter(Boolean))] as string[];
  const prestadorIds = [...new Set(protocolos.map((p) => p.prestador_id).filter(Boolean))] as string[];

  const [osRes, cliRes, prestRes] = await Promise.all([
    osIds.length
      ? supabase.from("ordens_servico").select("id, numero, status").in("id", osIds)
      : Promise.resolve({ data: [] as Array<{ id: string; numero?: string; status?: string }> }),
    clienteIds.length
      ? supabase.from("clientes").select("id, nome_fantasia, razao_social").in("id", clienteIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nome_fantasia?: string; razao_social?: string }> }),
    prestadorIds.length
      ? supabase.from("prestadores").select("id, nome_completo").in("id", prestadorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nome_completo?: string }> }),
  ]);

  const osMap = new Map(((osRes.data || []) as any[]).map((o) => [o.id, o]));
  const cliMap = new Map(((cliRes.data || []) as any[]).map((c) => [c.id, c]));
  const prestMap = new Map(((prestRes.data || []) as any[]).map((p) => [p.id, p]));

  return protocolos.map((p) => {
    const os = osMap.get(p.ordem_servico_id) as any;
    const cli = p.cliente_id ? (cliMap.get(p.cliente_id) as any) : null;
    const prest = p.prestador_id ? (prestMap.get(p.prestador_id) as any) : null;
    return {
      ...p,
      os_numero: os?.numero || null,
      os_status: os?.status || null,
      cliente_nome: cli?.nome_fantasia || cli?.razao_social || null,
      prestador_nome: prest?.nome_completo || null,
    };
  });
}

export async function atualizarProtocoloDivergencia(
  id: string,
  patch: Partial<Pick<ProtocoloDivergencia, "status" | "resolucao_notas" | "volumes_recebidos_retorno">>,
): Promise<void> {
  const { error } = await supabase
    .from("protocolos_divergencia")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function encerrarProtocoloDivergencia(
  id: string,
  resolucaoNotas: string,
  usuarioId?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("protocolos_divergencia")
    .update({
      status: "resolvida",
      resolucao_notas: resolucaoNotas,
      resolvido_por: usuarioId || null,
      resolvido_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface ResultadoConferenciaRetorno {
  success: boolean;
  divergencia?: boolean;
  protocolo_id?: string;
  numero_protocolo?: string;
  volumes_esperados_retorno?: number;
  volumes_recebidos_retorno?: number;
  quantidade_divergente?: number;
  error?: string;
}

export async function conferirRetornoNaBase(input: {
  ordemServicoId: string;
  volumesRecebidos: number;
  motivo?: string | null;
  observacoes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  responsavel?: string | null;
  fotos?: string[];
}): Promise<ResultadoConferenciaRetorno> {
  const { data, error } = await supabase.rpc("f_fechar_conferencia_retorno_os", {
    p_ordem_servico_id: input.ordemServicoId,
    p_volumes_recebidos: Math.max(0, Math.floor(Number(input.volumesRecebidos) || 0)),
    p_motivo: input.motivo ?? null,
    p_observacoes: input.observacoes ?? null,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_responsavel: input.responsavel ?? null,
    p_fotos: input.fotos ?? [],
  });
  if (error) return { success: false, error: error.message };
  return (data || { success: false, error: "Sem retorno do servidor" }) as ResultadoConferenciaRetorno;
}

export async function urlAssinadaFotoProtocolo(path: string): Promise<string | null> {
  return urlAssinadaEvidencia(path);
}
