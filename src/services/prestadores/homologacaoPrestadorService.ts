import { supabase } from "@/lib/supabase";
import { urlAssinadaEvidencia } from "@/services/volumesService";

export type StatusValidacaoDocumento = "pendente" | "aprovado" | "rejeitado" | "vencido";

export interface DocumentoPrestadorApp {
  id: string;
  prestador_id: string;
  tipo?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  categoria_cnh?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  data_vencimento?: string | null;
  validade?: string | null;
  arquivo_path?: string | null;
  url?: string | null;
  status?: string | null;
  status_validacao?: StatusValidacaoDocumento | null;
  observacao?: string | null;
  observacoes?: string | null;
  validado_por?: string | null;
  validado_em?: string | null;
}

export type ModalidadePrestacao =
  | "entrega_imediata"
  | "servico_agendado"
  | "ecommerce_multiparadas"
  | "coleta_distribuicao"
  | "transporte_dedicado"
  | "operacao_fixa"
  | "centro_distribuicao"
  | "refrigerado";

export type StatusHomologacao = "homologado" | "pendente" | "em_analise" | "atualizacao_necessaria";

export interface PrestadorHomologacao {
  id: string;
  prestador_id: string;
  cliente_id?: string | null;
  modalidade: ModalidadePrestacao;
  categoria_veiculo?: string | null;
  status: StatusHomologacao;
  requisitos_pendentes?: unknown;
  validade_ate?: string | null;
  aprovado_por?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  cliente_nome?: string | null;
}

export const MODALIDADES_PRESTACAO: Array<{ value: ModalidadePrestacao; label: string }> = [
  { value: "entrega_imediata", label: "Entrega imediata" },
  { value: "servico_agendado", label: "Serviço agendado" },
  { value: "ecommerce_multiparadas", label: "E-commerce multiparadas" },
  { value: "coleta_distribuicao", label: "Coleta e distribuição" },
  { value: "transporte_dedicado", label: "Transporte dedicado" },
  { value: "operacao_fixa", label: "Operação fixa" },
  { value: "centro_distribuicao", label: "Centro de distribuição" },
  { value: "refrigerado", label: "Transporte refrigerado" },
];

export const STATUS_HOMOLOGACAO: Array<{ value: StatusHomologacao; label: string; tone: string }> = [
  { value: "homologado", label: "Homologado", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "pendente", label: "Pendente", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "em_analise", label: "Em análise", tone: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "atualizacao_necessaria", label: "Atualização necessária", tone: "bg-red-100 text-red-700 border-red-200" },
];

export const TIPO_DOCUMENTO_LABEL: Record<string, string> = {
  cnh: "CNH",
  crlv: "CRLV",
  antt: "ANTT / RNTRC",
  seguro: "Seguro",
  comprovante_residencia: "Comprovante de residência",
  certificacao: "Certificação",
  outro: "Outro",
};

export function modalidadeLabel(valor: string): string {
  return MODALIDADES_PRESTACAO.find((m) => m.value === valor)?.label || valor;
}

export function calcularAlertaValidade(data?: string | null): "sem_data" | "ok" | "vencendo" | "vencido" {
  if (!data) return "sem_data";
  const venc = new Date(`${data}T23:59:59`);
  if (Number.isNaN(venc.getTime())) return "sem_data";
  const hoje = new Date();
  const diffDias = Math.ceil((venc.getTime() - hoje.getTime()) / 86400000);
  if (diffDias < 0) return "vencido";
  if (diffDias <= 30) return "vencendo";
  return "ok";
}

export async function listarDocumentosPrestador(prestadorId: string): Promise<DocumentoPrestadorApp[]> {
  if (!prestadorId) return [];
  const { data, error } = await supabase
    .from("documentos_prestadores")
    .select("*")
    .eq("prestador_id", prestadorId)
    .order("data_validade", { ascending: true, nullsFirst: false });
  if (error) {
    console.warn("[homologacaoPrestadorService] listarDocumentos:", error.message);
    return [];
  }
  return (data || []) as DocumentoPrestadorApp[];
}

export async function atualizarValidacaoDocumento(input: {
  id: string;
  status: StatusValidacaoDocumento;
  usuarioId?: string | null;
  observacao?: string | null;
}): Promise<void> {
  const patch: Record<string, unknown> = {
    status_validacao: input.status,
    status: input.status,
    validado_por: input.usuarioId || null,
    validado_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.observacao !== undefined) {
    patch.observacao = input.observacao || null;
    patch.observacoes = input.observacao || null;
  }
  const { error } = await supabase.from("documentos_prestadores").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function urlAssinadaDocumento(path: string | null | undefined): Promise<string | null> {
  return urlAssinadaEvidencia(path, ["documentos-prestadores", "documentos_prestadores", "driver-evidence"]);
}

export async function listarHomologacoes(prestadorId: string): Promise<PrestadorHomologacao[]> {
  if (!prestadorId) return [];
  const { data, error } = await supabase
    .from("prestador_homologacoes")
    .select("*")
    .eq("prestador_id", prestadorId)
    .order("modalidade", { ascending: true });
  if (error) {
    console.warn("[homologacaoPrestadorService] listarHomologacoes:", error.message);
    return [];
  }
  const rows = (data || []) as PrestadorHomologacao[];
  const clienteIds = [...new Set(rows.map((r) => r.cliente_id).filter(Boolean))] as string[];
  if (clienteIds.length === 0) return rows;
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nome_fantasia, razao_social")
    .in("id", clienteIds);
  const mapa = new Map((clientes || []).map((c: any) => [c.id, c.nome_fantasia || c.razao_social]));
  return rows.map((r) => ({
    ...r,
    cliente_nome: r.cliente_id ? (mapa.get(r.cliente_id) as string | undefined) || null : null,
  }));
}

export async function salvarHomologacao(input: {
  id?: string;
  prestador_id: string;
  cliente_id?: string | null;
  modalidade: ModalidadePrestacao;
  categoria_veiculo?: string | null;
  status: StatusHomologacao;
  validade_ate?: string | null;
  requisitos_pendentes?: unknown;
  usuarioId?: string | null;
}): Promise<PrestadorHomologacao> {
  const payload: Record<string, unknown> = {
    prestador_id: input.prestador_id,
    cliente_id: input.cliente_id || null,
    modalidade: input.modalidade,
    categoria_veiculo: input.categoria_veiculo || null,
    status: input.status,
    validade_ate: input.validade_ate || null,
    requisitos_pendentes: input.requisitos_pendentes ?? [],
    aprovado_por: input.status === "homologado" ? input.usuarioId || null : null,
    updated_at: new Date().toISOString(),
  };

  let alvoId = input.id;
  if (!alvoId) {
    let consulta = supabase
      .from("prestador_homologacoes")
      .select("id")
      .eq("prestador_id", input.prestador_id)
      .eq("modalidade", input.modalidade);
    consulta = input.cliente_id
      ? consulta.eq("cliente_id", input.cliente_id)
      : consulta.is("cliente_id", null);
    const { data: existente } = await consulta.maybeSingle();
    alvoId = (existente as { id?: string } | null)?.id;
  }

  if (alvoId) {
    const { data, error } = await supabase
      .from("prestador_homologacoes")
      .update(payload)
      .eq("id", alvoId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as PrestadorHomologacao;
  }

  const { data, error } = await supabase
    .from("prestador_homologacoes")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PrestadorHomologacao;
}

export async function excluirHomologacao(id: string): Promise<void> {
  const { error } = await supabase.from("prestador_homologacoes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
