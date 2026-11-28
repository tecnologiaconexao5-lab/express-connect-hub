import { supabase } from "@/lib/supabase";
import {
  assinarStorageRef,
  parseStorageRef,
  SIGN_TTL_SECONDS,
} from "@/services/storage/storageRefService";

export type OSVolumeStatus =
  | "aguardando_coleta"
  | "coletado"
  | "em_transito"
  | "entregue"
  | "recusado_parcial"
  | "em_devolucao"
  | "devolvido_base"
  | "divergente";

export type VolumeEventoTipo =
  | "gerado"
  | "conferencia_coleta"
  | "carregamento"
  | "entrega"
  | "recusa"
  | "retorno_base"
  | "divergencia";

export interface OSVolume {
  id: string;
  ordem_servico_id: string;
  rota_parada_id?: string | null;
  codigo_barras?: string | null;
  qr_code?: string | null;
  sku?: string | null;
  descricao?: string | null;
  lote?: string | null;
  data_validade?: string | null;
  peso_kg?: number | null;
  cubagem_m3?: number | null;
  status_atual: OSVolumeStatus;
  recebedor_nome?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface VolumeMovimentacao {
  id: string;
  volume_id: string;
  ordem_servico_id?: string | null;
  prestador_id?: string | null;
  tipo_evento: VolumeEventoTipo;
  latitude?: number | null;
  longitude?: number | null;
  foto_path?: string | null;
  observacao?: string | null;
  client_event_id?: string | null;
  registrado_em: string;
}

export interface ContadoresVolumes {
  previstos: number;
  conferidosColeta: number;
  entregues: number;
  pendentes: number;
  emDevolucao: number;
  divergentes: number;
}

export const STATUS_VOLUME_LABEL: Record<OSVolumeStatus, string> = {
  aguardando_coleta: "Aguardando coleta",
  coletado: "Coletado",
  em_transito: "Em trânsito",
  entregue: "Entregue",
  recusado_parcial: "Recusado parcial",
  em_devolucao: "Em devolução",
  devolvido_base: "Devolvido à base",
  divergente: "Divergente",
};

export const EVENTO_VOLUME_LABEL: Record<VolumeEventoTipo, string> = {
  gerado: "Volume gerado",
  conferencia_coleta: "Conferência na coleta",
  carregamento: "Carregamento",
  entrega: "Entrega",
  recusa: "Recusa",
  retorno_base: "Retorno à base",
  divergencia: "Divergência",
};

export const STATUS_VOLUME_TONE: Record<OSVolumeStatus, string> = {
  aguardando_coleta: "bg-slate-100 text-slate-700 border-slate-200",
  coletado: "bg-sky-100 text-sky-700 border-sky-200",
  em_transito: "bg-indigo-100 text-indigo-700 border-indigo-200",
  entregue: "bg-emerald-100 text-emerald-700 border-emerald-200",
  recusado_parcial: "bg-amber-100 text-amber-700 border-amber-200",
  em_devolucao: "bg-orange-100 text-orange-700 border-orange-200",
  devolvido_base: "bg-teal-100 text-teal-700 border-teal-200",
  divergente: "bg-red-100 text-red-700 border-red-200",
};

const EVENTO_POR_STATUS: Record<OSVolumeStatus, VolumeEventoTipo> = {
  aguardando_coleta: "gerado",
  coletado: "conferencia_coleta",
  em_transito: "carregamento",
  entregue: "entrega",
  recusado_parcial: "recusa",
  em_devolucao: "retorno_base",
  devolvido_base: "retorno_base",
  divergente: "divergencia",
};

export function gerarCodigoVolume(numeroOS: string | undefined | null, osId: string, indice: number): string {
  const bruto = (numeroOS || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const base = bruto.length > 0 ? bruto.slice(0, 14) : `OS${osId.replace(/-/g, "").slice(-8).toUpperCase()}`;
  return `VOL-${base}-${String(indice).padStart(3, "0")}`;
}

export function calcularContadores(volumes: OSVolume[]): ContadoresVolumes {
  const previstos = volumes.length;
  const conferidosColeta = volumes.filter((v) => v.status_atual !== "aguardando_coleta").length;
  const entregues = volumes.filter((v) => v.status_atual === "entregue").length;
  const pendentes = volumes.filter((v) =>
    ["aguardando_coleta", "coletado", "em_transito"].includes(v.status_atual),
  ).length;
  const emDevolucao = volumes.filter((v) =>
    ["em_devolucao", "devolvido_base"].includes(v.status_atual),
  ).length;
  const divergentes = volumes.filter((v) =>
    ["divergente", "recusado_parcial"].includes(v.status_atual),
  ).length;
  return { previstos, conferidosColeta, entregues, pendentes, emDevolucao, divergentes };
}

export function parseCodigosImportados(texto: string): Array<{
  codigo: string;
  sku?: string;
  lote?: string;
  dataValidade?: string;
  descricao?: string;
}> {
  const linhas = String(texto || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const vistos = new Set<string>();
  const resultado: Array<{ codigo: string; sku?: string; lote?: string; dataValidade?: string; descricao?: string }> = [];

  for (const linha of linhas) {
    const partes = linha.split(/\t|;|,/).map((p) => p.trim());
    const codigo = partes[0] || "";
    if (!codigo) continue;
    if (/^codigo$/i.test(codigo)) continue; // cabeçalho CSV
    if (vistos.has(codigo)) continue;
    vistos.add(codigo);
    resultado.push({
      codigo,
      sku: partes[1] || undefined,
      lote: partes[2] || undefined,
      dataValidade: /^\d{4}-\d{2}-\d{2}$/.test(partes[3] || "") ? partes[3] : undefined,
      descricao: partes[4] || undefined,
    });
  }
  return resultado;
}

export async function listarVolumesOS(ordemServicoId: string): Promise<OSVolume[]> {
  if (!ordemServicoId) return [];
  const { data, error } = await supabase
    .from("os_volumes")
    .select("*")
    .eq("ordem_servico_id", ordemServicoId)
    .order("codigo_barras", { ascending: true });
  if (error) {
    console.warn("[volumesService] listarVolumesOS:", error.message);
    return [];
  }
  return (data || []) as OSVolume[];
}

export async function listarMovimentacoesVolume(volumeId: string): Promise<VolumeMovimentacao[]> {
  if (!volumeId) return [];
  const { data, error } = await supabase
    .from("volume_movimentacoes")
    .select("*")
    .eq("volume_id", volumeId)
    .order("registrado_em", { ascending: false });
  if (error) {
    console.warn("[volumesService] listarMovimentacoesVolume:", error.message);
    return [];
  }
  return (data || []) as VolumeMovimentacao[];
}

export async function gerarVolumesAutomaticos(input: {
  ordemServicoId: string;
  numeroOS?: string | null;
  quantidade: number;
  pesoTotalKg?: number | null;
  cubagemTotalM3?: number | null;
  descricao?: string | null;
}): Promise<{ inseridos: number; ignorados: number; volumes: OSVolume[] }> {
  const { ordemServicoId, numeroOS, descricao } = input;
  const quantidade = Math.max(0, Math.floor(Number(input.quantidade) || 0));
  if (!ordemServicoId || quantidade <= 0) return { inseridos: 0, ignorados: 0, volumes: [] };

  const existentes = await listarVolumesOS(ordemServicoId);
  const codigosExistentes = new Set(
    existentes.map((v) => v.codigo_barras).filter((c): c is string => Boolean(c)),
  );

  const pesoUnit = input.pesoTotalKg && input.pesoTotalKg > 0 ? input.pesoTotalKg / quantidade : null;
  const cubagemUnit =
    input.cubagemTotalM3 && input.cubagemTotalM3 > 0 ? input.cubagemTotalM3 / quantidade : null;

  let indice = 1;
  const novas: Array<Record<string, unknown>> = [];
  while (novas.length < quantidade) {
    const codigo = gerarCodigoVolume(numeroOS, ordemServicoId, indice);
    indice += 1;
    if (codigosExistentes.has(codigo)) continue;
    codigosExistentes.add(codigo);
    novas.push({
      ordem_servico_id: ordemServicoId,
      codigo_barras: codigo,
      qr_code: codigo,
      descricao: descricao || "Volume gerado no TMS",
      peso_kg: pesoUnit,
      cubagem_m3: cubagemUnit,
      status_atual: "aguardando_coleta",
    });
  }

  const { data, error } = await supabase.from("os_volumes").insert(novas).select("*");
  if (error) throw new Error(error.message);
  const criados = (data || []) as OSVolume[];

  if (criados.length > 0) {
    const movimentos = criados.map((v) => ({
      volume_id: v.id,
      ordem_servico_id: ordemServicoId,
      tipo_evento: "gerado",
      observacao: "Volume gerado no TMS",
    }));
    const { error: errMov } = await supabase.from("volume_movimentacoes").insert(movimentos);
    if (errMov) console.warn("[volumesService] movimentos gerado:", errMov.message);
  }

  return { inseridos: criados.length, ignorados: existentes.length, volumes: criados };
}

export async function importarCodigosCliente(input: {
  ordemServicoId: string;
  texto: string;
  descricaoPadrao?: string | null;
}): Promise<{ inseridos: number; atualizados: number; ignorados: number; volumes: OSVolume[] }> {
  const { ordemServicoId, texto } = input;
  const codigos = parseCodigosImportados(texto);
  if (!ordemServicoId || codigos.length === 0) {
    return { inseridos: 0, atualizados: 0, ignorados: 0, volumes: [] };
  }

  const existentes = await listarVolumesOS(ordemServicoId);
  const mapaExistentes = new Map<string, OSVolume>();
  for (const v of existentes) if (v.codigo_barras) mapaExistentes.set(v.codigo_barras, v);

  let atualizados = 0;
  let ignorados = 0;
  const novas: Array<Record<string, unknown>> = [];

  for (const item of codigos) {
    const existente = mapaExistentes.get(item.codigo);
    if (existente) {
      const patch: Record<string, unknown> = {};
      if (item.sku && !existente.sku) patch.sku = item.sku;
      if (item.lote && !existente.lote) patch.lote = item.lote;
      if (item.dataValidade && !existente.data_validade) patch.data_validade = item.dataValidade;
      if (item.descricao && !existente.descricao) patch.descricao = item.descricao;
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("os_volumes").update(patch).eq("id", existente.id);
        if (!error) atualizados += 1;
      } else {
        ignorados += 1;
      }
      continue;
    }

    novas.push({
      ordem_servico_id: ordemServicoId,
      codigo_barras: item.codigo,
      qr_code: item.codigo,
      sku: item.sku || null,
      lote: item.lote || null,
      data_validade: item.dataValidade || null,
      descricao: item.descricao || input.descricaoPadrao || "Volume importado do cliente",
      status_atual: "aguardando_coleta",
    });
  }

  let criados: OSVolume[] = [];
  if (novas.length > 0) {
    const { data, error } = await supabase.from("os_volumes").insert(novas).select("*");
    if (error) throw new Error(error.message);
    criados = (data || []) as OSVolume[];
    const movimentos = criados.map((v) => ({
      volume_id: v.id,
      ordem_servico_id: ordemServicoId,
      tipo_evento: "gerado",
      observacao: "Código importado do cliente no TMS",
    }));
    const { error: errMov } = await supabase.from("volume_movimentacoes").insert(movimentos);
    if (errMov) console.warn("[volumesService] movimentos import:", errMov.message);
  }

  return { inseridos: criados.length, atualizados, ignorados, volumes: criados };
}

export async function registrarMovimentacao(input: {
  volumeId: string;
  ordemServicoId?: string | null;
  tipoEvento: VolumeEventoTipo;
  latitude?: number | null;
  longitude?: number | null;
  fotoPath?: string | null;
  observacao?: string | null;
  clientEventId?: string | null;
  sincronizarStatus?: boolean;
}): Promise<void> {
  const { volumeId, tipoEvento } = input;
  if (!volumeId) return;

  const { error } = await supabase.from("volume_movimentacoes").insert({
    volume_id: volumeId,
    ordem_servico_id: input.ordemServicoId || null,
    tipo_evento: tipoEvento,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    foto_path: input.fotoPath ?? null,
    observacao: input.observacao ?? null,
    client_event_id: input.clientEventId ?? null,
  });
  if (error) throw new Error(error.message);

  if (input.sincronizarStatus) {
    const statusPorEvento: Record<VolumeEventoTipo, OSVolumeStatus> = {
      gerado: "aguardando_coleta",
      conferencia_coleta: "coletado",
      carregamento: "em_transito",
      entrega: "entregue",
      recusa: "recusado_parcial",
      retorno_base: "devolvido_base",
      divergencia: "divergente",
    };
    await supabase
      .from("os_volumes")
      .update({ status_atual: statusPorEvento[tipoEvento], updated_at: new Date().toISOString() })
      .eq("id", volumeId);
  }
}

export async function atualizarStatusVolume(input: {
  volumeId: string;
  ordemServicoId?: string | null;
  status: OSVolumeStatus;
  recebedorNome?: string | null;
  observacao?: string | null;
}): Promise<void> {
  const { volumeId, status } = input;
  const patch: Record<string, unknown> = {
    status_atual: status,
    updated_at: new Date().toISOString(),
  };
  if (input.recebedorNome !== undefined) patch.recebedor_nome = input.recebedorNome || null;
  const { error } = await supabase.from("os_volumes").update(patch).eq("id", volumeId);
  if (error) throw new Error(error.message);

  await registrarMovimentacao({
    volumeId,
    ordemServicoId: input.ordemServicoId || null,
    tipoEvento: EVENTO_POR_STATUS[status],
    observacao: input.observacao || `Status alterado para ${STATUS_VOLUME_LABEL[status]}`,
    sincronizarStatus: false,
  });
}

/**
 * Resolve URL assinada de uma evidência privada, tentando os buckets oficiais.
 */
export async function urlAssinadaEvidencia(
  path: string | null | undefined,
  buckets: string[] = [
    "driver-evidence",
    "documentos-prestadores",
    "documentos_prestadores",
    "comprovantes-entrega",
  ],
): Promise<string | null> {
  if (!path) return null;
  const ref = parseStorageRef(path, buckets[0]);
  if (!ref) return null;
  if (ref.external) return ref.raw;

  const candidatos = ref.bucket && buckets.includes(ref.bucket)
    ? [ref.bucket, ...buckets.filter((b) => b !== ref.bucket)]
    : [ref.bucket || buckets[0], ...buckets.filter((b) => b !== ref.bucket)];

  for (const bucket of candidatos) {
    const url = await assinarStorageRef({ ...ref, bucket }, SIGN_TTL_SECONDS);
    if (url) return url;
  }
  return null;
}

export function exportarManifestoCSV(volumes: OSVolume[], numeroOS?: string | null): string {
  const cabecalho = ["codigo", "sku", "descricao", "lote", "data_validade", "status", "recebedor"];
  const linhas = volumes.map((v) => [
    v.codigo_barras || "",
    v.sku || "",
    v.descricao || "",
    v.lote || "",
    v.data_validade || "",
    STATUS_VOLUME_LABEL[v.status_atual] || v.status_atual,
    v.recebedor_nome || "",
  ]);
  const csv = [cabecalho, ...linhas]
    .map((linha) => linha.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  return `\uFEFF${csv}`;
}

export function baixarManifestoCSV(volumes: OSVolume[], numeroOS?: string | null): void {
  const csv = exportarManifestoCSV(volumes, numeroOS);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `manifesto${numeroOS ? `-${numeroOS.replace(/[^a-zA-Z0-9-]/g, "")}` : ""}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
