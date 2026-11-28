import { supabase } from "@/lib/supabase";
import { urlAssinadaEvidencia } from "@/services/volumesService";

export type CategoriaReembolso =
  | "pedagio"
  | "estacionamento"
  | "balsa"
  | "abastecimento"
  | "extraordinaria";

export type StatusReembolso = "pendente" | "aprovado" | "rejeitado" | "pago";

export interface ReembolsoPrestador {
  id: string;
  prestador: string;
  prestador_id?: string | null;
  os_id?: string | null;
  alocacao_id?: string | null;
  categoria?: CategoriaReembolso | string | null;
  tipo?: string | null;
  descricao?: string | null;
  valor: number;
  data_despesa?: string | null;
  comprovante_path?: string | null;
  comprovante_url?: string | null;
  status: StatusReembolso | string;
  motivo_rejeicao?: string | null;
  obs_rejeicao?: string | null;
  aprovado_por?: string | null;
  aprovado_em?: string | null;
  data_aprovacao?: string | null;
  created_at?: string | null;
  // Enriquecimento
  prestador_nome?: string | null;
  os_numero?: string | null;
}

export const CATEGORIAS_REEMBOLSO: Array<{ value: CategoriaReembolso; label: string }> = [
  { value: "pedagio", label: "Pedágio" },
  { value: "estacionamento", label: "Estacionamento" },
  { value: "balsa", label: "Balsa" },
  { value: "abastecimento", label: "Abastecimento" },
  { value: "extraordinaria", label: "Despesa extraordinária" },
];

export const STATUS_REEMBOLSO_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  pago: "Pago",
};

export const STATUS_REEMBOLSO_TONE: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700 border-amber-200",
  aprovado: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejeitado: "bg-red-100 text-red-700 border-red-200",
  pago: "bg-sky-100 text-sky-700 border-sky-200",
};

export function categoriaReembolsoLabel(valor?: string | null): string {
  return CATEGORIAS_REEMBOLSO.find((c) => c.value === valor)?.label || valor || "Outros";
}

export async function listarReembolsosPrestador(filtros: {
  status?: StatusReembolso | "todos";
  categoria?: CategoriaReembolso | "todas";
  limite?: number;
} = {}): Promise<ReembolsoPrestador[]> {
  let query = supabase
    .from("reembolsos_prestador")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filtros.limite ?? 300);

  if (filtros.status && filtros.status !== "todos") query = query.eq("status", filtros.status);
  if (filtros.categoria && filtros.categoria !== "todas") query = query.eq("categoria", filtros.categoria);

  const { data, error } = await query;
  if (error) {
    console.warn("[reembolsosPrestadorAppService] listar:", error.message);
    return [];
  }
  const rows = (data || []) as ReembolsoPrestador[];
  if (rows.length === 0) return [];

  const osIds = [...new Set(rows.map((r) => r.os_id).filter(Boolean))] as string[];
  const prestadorIds = [...new Set(rows.map((r) => r.prestador_id).filter(Boolean))] as string[];

  const [osRes, prestRes] = await Promise.all([
    osIds.length
      ? supabase.from("ordens_servico").select("id, numero").in("id", osIds)
      : Promise.resolve({ data: [] as Array<{ id: string; numero?: string }> }),
    prestadorIds.length
      ? supabase.from("prestadores").select("id, nome_completo").in("id", prestadorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nome_completo?: string }> }),
  ]);

  const osMap = new Map(((osRes.data || []) as any[]).map((o) => [o.id, o.numero]));
  const prestMap = new Map(((prestRes.data || []) as any[]).map((p) => [p.id, p.nome_completo]));

  return rows.map((r) => ({
    ...r,
    prestador_nome: (r.prestador_id ? (prestMap.get(r.prestador_id) as string | undefined) : null) || r.prestador || null,
    os_numero: r.os_id ? ((osMap.get(r.os_id) as string | undefined) || null) : null,
  }));
}

export async function aprovarReembolso(id: string, usuarioId?: string | null): Promise<void> {
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("reembolsos_prestador")
    .update({
      status: "aprovado",
      aprovado_por: usuarioId || null,
      aprovado_em: agora,
      data_aprovacao: agora,
      updated_at: agora,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function rejeitarReembolso(id: string, motivo: string): Promise<void> {
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("reembolsos_prestador")
    .update({
      status: "rejeitado",
      motivo_rejeicao: motivo,
      obs_rejeicao: motivo,
      updated_at: agora,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function urlAssinadaComprovante(path: string | null | undefined): Promise<string | null> {
  return urlAssinadaEvidencia(path, [
    "driver-evidence",
    "comprovantes-entrega",
    "documentos-prestadores",
    "documentos_prestadores",
  ]);
}

export function formatarMoeda(valor: number | null | undefined): string {
  const n = Number(valor || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
