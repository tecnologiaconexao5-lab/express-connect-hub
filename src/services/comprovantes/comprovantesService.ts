import { supabase } from "@/lib/supabase";
import {
  buscarDetalhesEntregaCompleto,
  type ComprovanteResumo,
  type DetalhesEntregaCompleto,
} from "@/services/portalCliente/portalClienteService";
import { normalizarEvento, type EventoNormalizado } from "@/components/torre-controle/eventAdapter";
import { resolverMidiasPod } from "@/services/comprovantes/podMediaService";

/* ============================================================
 * MISSÃO A23 — FASE A — Central Profissional de Comprovantes
 * Fonte oficial única: entregas_protocolo (M108C1)
 * Fluxo: App Prestador → delivery_proofs → trigger → entregas_protocolo
 * ============================================================ */

export type SituacaoComprovante =
  | "todos"
  | "entregue"
  | "entregue_ressalva"
  | "nao_entregue"
  | "completo"
  | "incompleto";

/* ============================================================
 * MISSÃO A23 — FASE D — Integração POD ↔ Financeiro
 * Fonte oficial: entregas_protocolo.
 * Helpers puros e testáveis usados por ConferenciaFinanceira,
 * PagamentoPrestadores e receberService.
 * ============================================================ */

export type SituacaoPodFinanceiro =
  | "completo"
  | "parcial"
  | "entregue_ressalva"
  | "nao_entregue"
  | "pendente";

export interface PODInfoFinanceiro {
  situacao: SituacaoPodFinanceiro;
  temFoto: boolean;
  temCanhoto: boolean;
  temAssinatura: boolean;
  recebedor: string | null;
  podId: string | null;
}

/**
 * Deriva a situação do POD para o Financeiro a partir de uma linha
 * de entregas_protocolo (ou null). Função pura — testável sem banco.
 */
export function derivarSituacaoPodFinanceiro(pod: {
  id?: string;
  status?: string | null;
  foto_entrega_url?: string | null;
  foto_canhoto_url?: string | null;
  assinatura_url?: string | null;
  nome_recebedor?: string | null;
} | null): PODInfoFinanceiro {
  if (!pod) {
    return { situacao: "pendente", temFoto: false, temCanhoto: false, temAssinatura: false, recebedor: null, podId: null };
  }

  const temFoto = !!(pod.foto_entrega_url || pod.foto_canhoto_url);
  const temCanhoto = !!pod.foto_canhoto_url;
  const temAssinatura = !!pod.assinatura_url;
  const recebedor = pod.nome_recebedor || null;

  let situacao: SituacaoPodFinanceiro = "parcial";
  if (pod.status === "nao_entregue") situacao = "nao_entregue";
  else if (pod.status === "entregue_ressalva" || pod.status === "entregue_com_ressalva") situacao = "entregue_ressalva";
  else if (temFoto && temAssinatura && recebedor) situacao = "completo";

  return { situacao, temFoto, temCanhoto, temAssinatura, recebedor, podId: pod.id || null };
}

export const SITUACAO_POD_FINANCEIRO_LABEL: Record<SituacaoPodFinanceiro, string> = {
  completo: "POD completo",
  parcial: "POD parcial",
  entregue_ressalva: "Com ressalva",
  nao_entregue: "Não entregue",
  pendente: "POD pendente",
};

/**
 * Deriva o status binário usado por PagamentoPrestadores
 * ("enviado" quando existe POD em entregas_protocolo, senão "pendente").
 * Fonte oficial: entregas_protocolo — NÃO depende de comprovante_url.
 */
export function derivarStatusComprovanteFinanceiro(pod: unknown): "enviado" | "pendente" {
  return pod ? "enviado" : "pendente";
}

/**
 * Consulta read-only — mapa alocacao_id → linha de entregas_protocolo.
 * Usada pelo Financeiro para cruzar POD real com alocações.
 */
export async function buscarPODsDeAlocacoes(alocacaoIds: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (!alocacaoIds.length) return map;
  try {
    const { data, error } = await supabase
      .from("entregas_protocolo")
      .select("id, alocacao_id, status, foto_entrega_url, foto_canhoto_url, assinatura_url, nome_recebedor, documento_recebedor, data_hora_entrega, observacao")
      .in("alocacao_id", alocacaoIds);
    if (error) {
      console.warn("[ComprovantesService] Erro ao buscar PODs de alocações:", error.message);
      return map;
    }
    (data || []).forEach((p: any) => {
      if (p.alocacao_id && !map.has(p.alocacao_id)) map.set(p.alocacao_id, p);
    });
  } catch (e) {
    console.error("[ComprovantesService] Exceção ao buscar PODs de alocações:", e);
  }
  return map;
}

export interface ComprovanteFiltros {
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
  clienteId?: string;
  os?: string;
  prestadorId?: string;
  destinatario?: string;
  situacao?: SituacaoComprovante;
  pagina?: number;
  porPagina?: number;
}

export interface ComprovanteEntrega {
  id: string;
  alocacao_id: string | null;
  ordem_servico_id: string | null;
  numero_os: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  prestador_id: string | null;
  prestador_nome: string | null;
  veiculo_placa: string | null;
  veiculo_tipo: string | null;
  destinatario: string | null;
  endereco: string | null;
  recebedor: string | null;
  documento_recebedor: string | null;
  relation: string | null;
  data_hora_entrega: string | null;
  situacao: string;
  situacao_label: string;
  observacao: string | null;
  foto_entrega_url: string | null;
  foto_canhoto_url: string | null;
  assinatura_url: string | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  status_alocacao: string | null;
  volume_previsto: number | null;
  volume_entregue: number | null;
  completo: boolean;
  criado_em: string;
}

export interface ComprovantesResultado {
  itens: ComprovanteEntrega[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface OcorrenciaComprovante {
  id: string;
  tipo: string;
  descricao: string | null;
  status: string | null;
  severidade: string | null;
  prioridade: string | null;
  created_at: string;
}

export interface DossieComprovante {
  pod: ComprovanteResumo;
  alocacao: DetalhesEntregaCompleto["alocacao"];
  ordemServico: DetalhesEntregaCompleto["ordemServico"];
  prestador: DetalhesEntregaCompleto["prestador"];
  gps: {
    latitude: number | null;
    longitude: number | null;
    gps_accuracy: number | null;
  };
  timeline: EventoNormalizado[];
  ocorrencias: OcorrenciaComprovante[];
  volumes: { previsto: number | null; entregue: number | null };
}

const SITUACAO_LABELS: Record<string, string> = {
  entregue: "Entregue",
  entregue_ressalva: "Entregue com ressalva",
  nao_entregue: "Não entregue",
  entregue_com_ressalva: "Entregue com ressalva",
  nao_entregue_devolucao: "Não entregue (devolução)",
  recusada: "Recusada",
  pendente: "Pendente",
};

export function rotularSituacao(status: string | null | undefined): string {
  if (!status) return "Pendente";
  return SITUACAO_LABELS[status] || status;
}

/** Determina se um comprovante é considerado COMPLETO (evidências obrigatórias presentes). */
export function isComprovanteCompleto(item: {
  foto_entrega_url?: string | null;
  foto_canhoto_url?: string | null;
  assinatura_url?: string | null;
  nome_recebedor?: string | null;
  data_hora_entrega?: string | null;
}): boolean {
  const temFoto = !!(item.foto_entrega_url || item.foto_canhoto_url);
  return !!(temFoto && item.assinatura_url && item.nome_recebedor && item.data_hora_entrega);
}

/**
 * ETAPA 1 — listarComprovantes
 * Consulta a fonte oficial entregas_protocolo com cruzamento de dados operacionais:
 * alocacoes_escala, ordens_servico, prestadores, clientes e rota_paradas (opcional).
 */
export async function listarComprovantes(
  filtros: ComprovanteFiltros = {}
): Promise<ComprovantesResultado> {
  const pagina = filtros.pagina || 1;
  const porPagina = filtros.porPagina || 20;

  try {
    let query = supabase
      .from("entregas_protocolo")
      .select(
        "id, alocacao_id, ordem_servico_id, prestador_id, nome_recebedor, documento_recebedor, receiver_relationship, observacao, foto_entrega_url, foto_canhoto_url, assinatura_url, data_hora_entrega, latitude, longitude, gps_accuracy, status, created_at"
      );

    if (filtros.dataInicio) query = query.gte("data_hora_entrega", filtros.dataInicio);
    if (filtros.dataFim) query = query.lte("data_hora_entrega", filtros.dataFim);

    const statusSituacao: SituacaoComprovante[] = ["entregue", "entregue_ressalva", "nao_entregue"];
    if (filtros.situacao && statusSituacao.includes(filtros.situacao)) {
      query = query.eq("status", filtros.situacao);
    }

    query = query.order("data_hora_entrega", { ascending: false }).limit(500);

    const { data: pods, error } = await query;
    if (error) {
      console.error("[ComprovantesService] Erro ao buscar entregas_protocolo:", error.message);
      return { itens: [], total: 0, pagina, porPagina };
    }
    if (!pods || pods.length === 0) {
      return { itens: [], total: 0, pagina, porPagina };
    }

    const alocacaoIds = [...new Set((pods as any[]).map((p) => p.alocacao_id).filter(Boolean))];
    const osIds = [...new Set((pods as any[]).map((p) => p.ordem_servico_id).filter(Boolean))];
    const prestadorIds = [...new Set((pods as any[]).map((p) => p.prestador_id).filter(Boolean))];

    const [alocacoesRes, osRes, prestadoresRes] = await Promise.all([
      alocacaoIds.length > 0
        ? supabase
            .from("alocacoes_escala")
            .select("id, ordem_servico_id, prestador_id, cliente_id, status, placa, tipo_veiculo, origem, destino")
            .in("id", alocacaoIds)
        : { data: [] as any[] },
      osIds.length > 0
        ? supabase.from("ordens_servico").select("id, numero, cliente, cliente_id, volumes").in("id", osIds)
        : { data: [] as any[] },
      prestadorIds.length > 0
        ? supabase.from("prestadores").select("id, nome_completo").in("id", prestadorIds)
        : { data: [] as any[] },
    ]);

    const alocacoesMap = new Map((alocacoesRes.data || []).map((a: any) => [a.id, a]));
    const osMap = new Map((osRes.data || []).map((o: any) => [o.id, o]));
    const prestadoresMap = new Map((prestadoresRes.data || []).map((p: any) => [p.id, p]));

    const clienteIds = [...new Set(
      [...(alocacoesRes.data || [])]
        .map((a: any) => a.cliente_id)
        .filter(Boolean)
    )];

    const clientesRes =
      clienteIds.length > 0
        ? await supabase.from("clientes").select("id, nome_fantasia, razao_social").in("id", clienteIds)
        : { data: [] as any[] };
    const clientesMap = new Map((clientesRes.data || []).map((c: any) => [c.id, c]));

    // rota_paradas — opcional: destinatário/endereço/volumes quando existirem (poucos registros reais)
    let paradasMap = new Map<string, any>();
    if (alocacaoIds.length > 0) {
      const { data: paradas } = await supabase
        .from("rota_paradas")
        .select("id, alocacao_id, destinatario, endereco, volumes, volumes_entregues, recebedor")
        .in("alocacao_id", alocacaoIds);
      (paradas || []).forEach((pa: any) => {
        if (pa.alocacao_id) paradasMap.set(pa.alocacao_id, pa);
      });
    }

    let itens: ComprovanteEntrega[] = (pods as any[]).map((p: any) => {
      const aloc = alocacaoIds.length > 0 ? alocacoesMap.get(p.alocacao_id) : undefined;
      const os = aloc?.ordem_servico_id ? osMap.get(aloc.ordem_servico_id) : undefined;
      const prest = aloc?.prestador_id ? prestadoresMap.get(aloc.prestador_id) : undefined;
      const cli = aloc?.cliente_id ? clientesMap.get(aloc.cliente_id) : undefined;
      const parada = p.alocacao_id ? paradasMap.get(p.alocacao_id) : undefined;

      const situacao = p.status || "pendente";
      const completo = isComprovanteCompleto(p);

      return {
        id: p.id,
        alocacao_id: p.alocacao_id || null,
        ordem_servico_id: p.ordem_servico_id || aloc?.ordem_servico_id || null,
        numero_os: os?.numero || null,
        cliente_id: aloc?.cliente_id || os?.cliente_id || null,
        cliente_nome: cli?.nome_fantasia || cli?.razao_social || os?.cliente || null,
        prestador_id: aloc?.prestador_id || p.prestador_id || null,
        prestador_nome: prest?.nome_completo || aloc?.prestador_nome || null,
        veiculo_placa: aloc?.placa || null,
        veiculo_tipo: aloc?.tipo_veiculo || null,
        destinatario: parada?.destinatario || aloc?.destino || os?.cliente || cli?.nome_fantasia || null,
        endereco: parada?.endereco || null,
        recebedor: p.nome_recebedor || null,
        documento_recebedor: p.documento_recebedor || null,
        relation: p.receiver_relationship || null,
        data_hora_entrega: p.data_hora_entrega || null,
        situacao,
        situacao_label: rotularSituacao(situacao),
        observacao: p.observacao || null,
        foto_entrega_url: p.foto_entrega_url || null,
        foto_canhoto_url: p.foto_canhoto_url || null,
        assinatura_url: p.assinatura_url || null,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        gps_accuracy: p.gps_accuracy ?? null,
        status_alocacao: aloc?.status || null,
        volume_previsto: os?.volumes != null ? os.volumes : parada?.volumes != null ? parada.volumes : null,
        volume_entregue: parada?.volumes_entregues != null ? parada.volumes_entregues : null,
        completo,
        criado_em: p.created_at || "",
      };
    });

    // Filtros client-side (cruzamento de dados)
    const q = (filtros.busca || "").toLowerCase().trim();
    if (q) {
      itens = itens.filter((it) =>
        [it.numero_os, it.cliente_nome, it.prestador_nome, it.destinatario, it.recebedor, it.documento_recebedor, it.id]
          .some((v) => v && v.toLowerCase().includes(q))
      );
    }
    if (filtros.clienteId) itens = itens.filter((it) => it.cliente_id === filtros.clienteId);
    if (filtros.os) {
      const osQ = filtros.os.toLowerCase().trim();
      itens = itens.filter((it) => (it.numero_os || "").toLowerCase().includes(osQ));
    }
    if (filtros.prestadorId) itens = itens.filter((it) => it.prestador_id === filtros.prestadorId);
    if (filtros.destinatario) {
      const destQ = filtros.destinatario.toLowerCase().trim();
      itens = itens.filter((it) => (it.destinatario || "").toLowerCase().includes(destQ));
    }
    if (filtros.situacao === "completo") itens = itens.filter((it) => it.completo);
    if (filtros.situacao === "incompleto") itens = itens.filter((it) => !it.completo);

    const total = itens.length;
    const inicio = (pagina - 1) * porPagina;
    const paginaItens = itens.slice(inicio, inicio + porPagina);

    return { itens: paginaItens, total, pagina, porPagina };
  } catch (err) {
    console.error("[ComprovantesService] Exceção ao listar comprovantes:", err);
    return { itens: [], total: 0, pagina, porPagina };
  }
}

/**
 * ETAPA 1 — buscarDossieComprovante
 * Reaproveita buscarDetalhesEntregaCompleto (portal) e enriquece com:
 * timeline (eventos_oficiais — Event Bus), ocorrências vinculadas e volumes.
 */
export async function buscarDossieComprovante(podId: string): Promise<DossieComprovante | null> {
  try {
    const detalhes = await buscarDetalhesEntregaCompleto(podId);
    if (!detalhes) return null;

    const alocacaoId = detalhes.pod.alocacao_id || detalhes.alocacao?.id || null;
    const osId = detalhes.ordemServico?.id || null;

    let timeline: EventoNormalizado[] = [];
    let ocorrencias: OcorrenciaComprovante[] = [];

    if (alocacaoId || osId) {
      const ids = [alocacaoId, osId].filter(Boolean);
      const { data: eventos } = await supabase
        .from("eventos_oficiais")
        .select("id, event_type, entity_type, entity_id, entity_number, status, source, created_by, visibility, payload, metadata, created_at, processed_at, version, retry_count")
        .in("entity_id", ids)
        .order("created_at", { ascending: true })
        .limit(100);

      timeline = (eventos || []).map((ev: any) => normalizarEvento(ev));
    }

    if (alocacaoId || osId) {
      let ocQuery = supabase
        .from("ocorrencias")
        .select("id, tipo, descricao, status, severidade, prioridade, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (alocacaoId && osId) ocQuery = ocQuery.or(`alocacao_id.eq.${alocacaoId},os_id.eq.${osId}`);
      else if (alocacaoId) ocQuery = ocQuery.eq("alocacao_id", alocacaoId);
      else if (osId) ocQuery = ocQuery.eq("os_id", osId);

      const { data: ocorr } = await ocQuery;
      ocorrencias = (ocorr || []).map((o: any) => ({
        id: o.id,
        tipo: o.tipo,
        descricao: o.descricao,
        status: o.status,
        severidade: o.severidade,
        prioridade: o.prioridade,
        created_at: o.created_at,
      }));
    }

    // Volumes — apenas quando realmente existirem (rota_paradas é quase vazia em produção)
    let volumes: { previsto: number | null; entregue: number | null } = {
      previsto: detalhes.ordemServico?.volumes ?? null,
      entregue: null,
    };
    if (alocacaoId) {
      const { data: parada } = await supabase
        .from("rota_paradas")
        .select("volumes, volumes_entregues")
        .eq("alocacao_id", alocacaoId)
        .limit(1)
        .maybeSingle();
      if (parada) {
        volumes = {
          previsto: parada.volumes != null ? parada.volumes : volumes.previsto,
          entregue: parada.volumes_entregues ?? null,
        };
      }
    }

    // APP-E2E-07 — resolve mídia privada (driver-evidence) em signed URL p/ o Dossiê.
    const podComMidia = await resolverMidiasPod(detalhes.pod as any);

    return {
      pod: podComMidia,
      alocacao: detalhes.alocacao,
      ordemServico: detalhes.ordemServico,
      prestador: detalhes.prestador,
      gps: {
        latitude: detalhes.gps.latitude,
        longitude: detalhes.gps.longitude,
        gps_accuracy: null,
      },
      timeline,
      ocorrencias,
      volumes,
    };
  } catch (e) {
    console.error("[ComprovantesService] Erro ao montar dossiê:", e);
    return null;
  }
}

/* ============================================================
 * MISSÃO A23 — FASE B — Métrica de POD pendente (fonte oficial)
 *
 * Regra operacional segura:
 *   Uma operação deve ser considerada POD pendente quando o
 *   comprovante JÁ deveria existir (finalizada/concluida) e NÃO
 *   existe registro correspondente na fonte oficial
 *   `entregas_protocolo`.
 *
 *   NÃO são tratadas como comprovante atrasado as operações em
 *   andamento (aceita, em_rota, aguardando_aceite, planejada),
 *   pois a entrega ainda pode estar acontecendo.
 *
 *   Fonte de verdade: entregas_protocolo. NÃO usa
 *   alocacoes_escala.comprovante_url como fonte de pendência.
 * ============================================================ */

/** Status/alocação em que o POD já deveria existir. */
export function operacaoExigePOD(aloc: { status?: string | null; finalizada?: boolean | null }): boolean {
  return !!aloc.finalizada || aloc.status === "concluida";
}

export interface PodPendente {
  id: string;
  osId: string | null;
  osNumero: string | null;
  cliente: string | null;
  prestador: string | null;
  status: string | null;
  finalizada: boolean;
}

/**
 * Função pura — filtra alocações POD pendente (testável sem banco).
 * alocacoes: array de alocações (finalizada/concluida) com id, ordem_servico_id.
 * alocacaoIdsComPod: Set de alocacao_id que POSSUEM POD em entregas_protocolo.
 */
export function filtrarPodsPendentes(
  alocacoes: Array<{
    id: string;
    ordem_servico_id?: string | null;
    status?: string | null;
    finalizada?: boolean | null;
  }>,
  alocacaoIdsComPod: Set<string>
): PodPendente[] {
  return alocacoes
    .filter((a) => operacaoExigePOD(a) && !alocacaoIdsComPod.has(a.id))
    .map((a) => ({
      id: a.id,
      osId: a.ordem_servico_id || null,
      osNumero: null,
      cliente: null,
      prestador: null,
      status: a.status || null,
      finalizada: !!a.finalizada,
    }));
}

export interface PodsPendentesResultado {
  total: number;
  itens: PodPendente[];
}

/**
 * Consulta read-only (SELECT) — conta operações concluídas/finalizadas
 * SEM POD real em entregas_protocolo. Usada pela Torre de Controle.
 */
export async function buscarPodsPendentes(): Promise<PodsPendentesResultado> {
  try {
    const { data: alocacoes, error } = await supabase
      .from("alocacoes_escala")
      .select("id, ordem_servico_id, prestador_id, cliente_id, status, finalizada")
      .or("finalizada.eq.true,status.eq.concluida")
      .limit(2000);

    if (error) {
      console.error("[ComprovantesService] Erro ao buscar alocações p/ POD pendente:", error.message);
      return { total: 0, itens: [] };
    }
    if (!alocacoes || alocacoes.length === 0) return { total: 0, itens: [] };

    const ids = alocacoes.map((a: any) => a.id);
    const { data: pods } = await supabase
      .from("entregas_protocolo")
      .select("alocacao_id")
      .in("alocacao_id", ids);

    const comPod = new Set((pods || []).map((p: any) => p.alocacao_id));
    const pendentes = filtrarPodsPendentes(alocacoes as any[], comPod);
    if (pendentes.length === 0) return { total: 0, itens: [] };

    const osIds = [...new Set(pendentes.map((p) => p.osId).filter(Boolean))] as string[];
    const prestadorIds = [...new Set((alocacoes as any[]).filter((a: any) => a.finalizada || a.status === "concluida").map((a: any) => a.prestador_id).filter(Boolean))];
    const clienteIds = [...new Set((alocacoes as any[]).filter((a: any) => a.finalizada || a.status === "concluida").map((a: any) => a.cliente_id).filter(Boolean))];

    const [osRes, prestadoresRes, clientesRes] = await Promise.all([
      osIds.length > 0
        ? supabase.from("ordens_servico").select("id, numero, cliente").in("id", osIds)
        : { data: [] as any[] },
      prestadorIds.length > 0
        ? supabase.from("prestadores").select("id, nome_completo").in("id", prestadorIds)
        : { data: [] as any[] },
      clienteIds.length > 0
        ? supabase.from("clientes").select("id, nome_fantasia, razao_social").in("id", clienteIds)
        : { data: [] as any[] },
    ]);

    const osMap = new Map((osRes.data || []).map((o: any) => [o.id, o]));
    const prestadoresMap = new Map((prestadoresRes.data || []).map((p: any) => [p.id, p]));
    const clientesMap = new Map((clientesRes.data || []).map((c: any) => [c.id, c]));

    const alocMap = new Map((alocacoes as any[]).map((a: any) => [a.id, a]));
    const enriquecidos: PodPendente[] = pendentes.map((p) => {
      const aloc = alocMap.get(p.id);
      const os = p.osId ? osMap.get(p.osId) : undefined;
      const prest = aloc?.prestador_id ? prestadoresMap.get(aloc.prestador_id) : undefined;
      const cli = aloc?.cliente_id ? clientesMap.get(aloc.cliente_id) : undefined;
      return {
        ...p,
        osNumero: os?.numero || null,
        cliente: cli?.nome_fantasia || cli?.razao_social || os?.cliente || null,
        prestador: prest?.nome_completo || null,
      };
    });

    return { total: enriquecidos.length, itens: enriquecidos };
  } catch (e) {
    console.error("[ComprovantesService] Exceção ao buscar PODs pendentes:", e);
    return { total: 0, itens: [] };
  }
}

/** Lista de clientes para o filtro (nome_fantasia/razao_social). */
export async function listarClientesComprovantes(): Promise<{ id: string; nome: string }[]> {
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome_fantasia, razao_social")
      .order("nome_fantasia", { ascending: true })
      .limit(300);
    if (error) {
      console.warn("[ComprovantesService] Erro clientes:", error.message);
      return [];
    }
    return (data || []).map((c: any) => ({
      id: c.id,
      nome: c.nome_fantasia || c.razao_social || "Cliente",
    }));
  } catch {
    return [];
  }
}

/** Lista de prestadores para o filtro. */
export async function listarPrestadoresComprovantes(): Promise<{ id: string; nome: string }[]> {
  try {
    const { data, error } = await supabase
      .from("prestadores")
      .select("id, nome_completo")
      .order("nome_completo", { ascending: true })
      .limit(300);
    if (error) {
      console.warn("[ComprovantesService] Erro prestadores:", error.message);
      return [];
    }
    return (data || []).map((p: any) => ({ id: p.id, nome: p.nome_completo || "Prestador" }));
  } catch {
    return [];
  }
}

/* ============================================================
 * MISSÃO A23 — FASE C — Entregas de uma OS (OS → alocações → POD)
 * Fonte: ordens_servico → alocacoes_escala → entregas_protocolo.
 * rota_paradas é complemento opcional (NÃO obrigatório).
 * ============================================================ */

export interface EntregaOS {
  alocacao_id: string;
  ordem_servico_id: string | null;
  pod_id: string | null;
  tem_pod: boolean;
  destinatario: string | null;
  endereco: string | null;
  prestador_id: string | null;
  prestador_nome: string | null;
  veiculo_placa: string | null;
  veiculo_tipo: string | null;
  status_operacao: string | null;
  data_hora_entrega: string | null;
  recebedor: string | null;
  documento_recebedor: string | null;
  situacao_pod: string | null;
  situacao_label: string;
  tem_foto: boolean;
  tem_canhoto: boolean;
  tem_assinatura: boolean;
  volume_previsto: number | null;
  volume_entregue: number | null;
  observacao: string | null;
  sequencia: number | null;
}

/**
 * Função pura — monta a entrega de uma OS a partir de dados crus.
 * Testável sem banco. NÃO inventa volumes/destinatário quando ausentes.
 */
export function montarEntregaOS(raw: {
  alocacao: {
    id: string;
    ordem_servico_id?: string | null;
    status?: string | null;
    finalizada?: boolean | null;
    placa?: string | null;
    tipo_veiculo?: string | null;
    prestador_id?: string | null;
    destino?: string | null;
  };
  pod?: {
    id?: string;
    nome_recebedor?: string | null;
    documento_recebedor?: string | null;
    observacao?: string | null;
    foto_entrega_url?: string | null;
    foto_canhoto_url?: string | null;
    assinatura_url?: string | null;
    data_hora_entrega?: string | null;
    status?: string | null;
  } | null;
  prestador_nome?: string | null;
  parada?: {
    destinatario?: string | null;
    endereco?: string | null;
    volumes?: number | null;
    volumes_entregues?: number | null;
    sequencia?: number | null;
  } | null;
}): EntregaOS {
  const aloc = raw.alocacao;
  const pod = raw.pod || null;
  const parada = raw.parada || null;
  const temPod = !!pod;
  const situacao = pod?.status || null;
  const destinatario = parada?.destinatario || aloc.destino || pod?.nome_recebedor || null;

  return {
    alocacao_id: aloc.id,
    ordem_servico_id: aloc.ordem_servico_id || null,
    pod_id: pod?.id || null,
    tem_pod: temPod,
    destinatario,
    endereco: parada?.endereco || null,
    prestador_id: aloc.prestador_id || null,
    prestador_nome: raw.prestador_nome || null,
    veiculo_placa: aloc.placa || null,
    veiculo_tipo: aloc.tipo_veiculo || null,
    status_operacao: aloc.status || null,
    data_hora_entrega: pod?.data_hora_entrega || null,
    recebedor: pod?.nome_recebedor || null,
    documento_recebedor: pod?.documento_recebedor || null,
    situacao_pod: situacao,
    situacao_label: rotularSituacao(situacao),
    tem_foto: !!(pod?.foto_entrega_url || pod?.foto_canhoto_url),
    tem_canhoto: !!pod?.foto_canhoto_url,
    tem_assinatura: !!pod?.assinatura_url,
    volume_previsto: parada?.volumes ?? null,
    volume_entregue: parada?.volumes_entregues ?? null,
    observacao: pod?.observacao || null,
    sequencia: parada?.sequencia ?? null,
  };
}

/**
 * Consulta read-only — todas as entregas/alocações de uma OS, com POD
 * real de entregas_protocolo (fonte oficial) e enriquecimento opcional
 * de rota_paradas. Usada na seção "Entregas e Comprovantes" da OS.
 */
export async function buscarEntregasDaOS(osId: string): Promise<EntregaOS[]> {
  try {
    const { data: alocacoes, error } = await supabase
      .from("alocacoes_escala")
      .select("id, ordem_servico_id, prestador_id, cliente_id, status, finalizada, placa, tipo_veiculo, origem, destino, created_at")
      .eq("ordem_servico_id", osId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.warn("[ComprovantesService] Erro alocações da OS:", error.message);
      return [];
    }
    if (!alocacoes || alocacoes.length === 0) return [];

    const alocacaoIds = alocacoes.map((a: any) => a.id);
    const prestadorIds = [...new Set((alocacoes as any[]).map((a: any) => a.prestador_id).filter(Boolean))];

    const [podsRes, prestadoresRes, paradasRes] = await Promise.all([
      supabase
        .from("entregas_protocolo")
        .select("id, alocacao_id, nome_recebedor, documento_recebedor, observacao, foto_entrega_url, foto_canhoto_url, assinatura_url, data_hora_entrega, status")
        .in("alocacao_id", alocacaoIds),
      prestadorIds.length > 0
        ? supabase.from("prestadores").select("id, nome_completo").in("id", prestadorIds)
        : { data: [] as any[] },
      supabase
        .from("rota_paradas")
        .select("alocacao_id, destinatario, endereco, volumes, volumes_entregues, sequencia")
        .in("alocacao_id", alocacaoIds),
    ]);

    const podMap = new Map<string, any>();
    (podsRes.data || []).forEach((p: any) => {
      if (p.alocacao_id && !podMap.has(p.alocacao_id)) podMap.set(p.alocacao_id, p);
    });
    const prestadoresMap = new Map((prestadoresRes.data || []).map((p: any) => [p.id, p]));
    const paradasMap = new Map<string, any>();
    (paradasRes.data || []).forEach((pa: any) => {
      if (pa.alocacao_id && !paradasMap.has(pa.alocacao_id)) paradasMap.set(pa.alocacao_id, pa);
    });

    return (alocacoes as any[]).map((aloc: any) =>
      montarEntregaOS({
        alocacao: aloc,
        pod: podMap.get(aloc.id) || null,
        prestador_nome: aloc.prestador_id ? prestadoresMap.get(aloc.prestador_id)?.nome_completo || null : null,
        parada: paradasMap.get(aloc.id) || null,
      })
    );
  } catch (e) {
    console.error("[ComprovantesService] Exceção ao buscar entregas da OS:", e);
    return [];
  }
}
