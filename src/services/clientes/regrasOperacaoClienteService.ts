import { supabase } from "@/lib/supabase";
import { MODALIDADES_PRESTACAO } from "@/services/prestadores/homologacaoPrestadorService";

export type ModalidadeRegra = "todas" | (typeof MODALIDADES_PRESTACAO)[number]["value"];

export interface RegraOperacaoCliente {
  id: string;
  cliente_id: string;
  modalidade: ModalidadeRegra;
  exige_leitura_volumes: boolean;
  exige_foto_coleta: boolean;
  exige_foto_entrega: boolean;
  exige_assinatura: boolean;
  exige_pin_entrega: boolean;
  exige_controle_temperatura: boolean;
  permite_entrega_parcial: boolean;
  instrucoes_padrao?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export const MODALIDADES_REGRA: Array<{ value: ModalidadeRegra; label: string }> = [
  { value: "todas", label: "Todas as modalidades" },
  ...MODALIDADES_PRESTACAO,
];

export const CAMPOS_REGRA: Array<{
  campo: keyof Pick<
    RegraOperacaoCliente,
    | "exige_leitura_volumes"
    | "exige_foto_coleta"
    | "exige_foto_entrega"
    | "exige_assinatura"
    | "exige_pin_entrega"
    | "exige_controle_temperatura"
    | "permite_entrega_parcial"
  >;
  label: string;
  descricao: string;
}> = [
  { campo: "exige_leitura_volumes", label: "Exigir leitura de volumes", descricao: "O App solicita a leitura do código de barras/QR na coleta e na entrega." },
  { campo: "exige_foto_coleta", label: "Exigir foto na coleta", descricao: "Registrar apresentação fotográfica no momento da coleta." },
  { campo: "exige_foto_entrega", label: "Exigir foto na entrega", descricao: "Comprovação fotográfica obrigatória na entrega." },
  { campo: "exige_assinatura", label: "Exigir assinatura", descricao: "Assinatura do responsável pelo recebimento." },
  { campo: "exige_pin_entrega", label: "Exigir PIN de entrega", descricao: "Código de confirmação informado pelo cliente no ato da entrega." },
  { campo: "exige_controle_temperatura", label: "Exigir controle de temperatura", descricao: "Registrar leitura de temperatura para cargas refrigeradas." },
  { campo: "permite_entrega_parcial", label: "Permitir entrega parcial", descricao: "Aceitar a entrega de parte dos volumes da operação." },
];

export function modalidadeRegraLabel(valor: string): string {
  return MODALIDADES_REGRA.find((m) => m.value === valor)?.label || valor;
}

export async function listarRegrasOperacaoCliente(clienteId: string): Promise<RegraOperacaoCliente[]> {
  if (!clienteId) return [];
  const { data, error } = await supabase
    .from("regras_operacao_cliente")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("modalidade", { ascending: true });
  if (error) {
    console.warn("[regrasOperacaoClienteService] listar:", error.message);
    return [];
  }
  return (data || []) as RegraOperacaoCliente[];
}

export async function salvarRegraOperacao(input: {
  id?: string;
  cliente_id: string;
  modalidade: ModalidadeRegra;
  exige_leitura_volumes: boolean;
  exige_foto_coleta: boolean;
  exige_foto_entrega: boolean;
  exige_assinatura: boolean;
  exige_pin_entrega: boolean;
  exige_controle_temperatura: boolean;
  permite_entrega_parcial: boolean;
  instrucoes_padrao?: string | null;
}): Promise<RegraOperacaoCliente> {
  const payload: Record<string, unknown> = {
    cliente_id: input.cliente_id,
    modalidade: input.modalidade,
    exige_leitura_volumes: input.exige_leitura_volumes,
    exige_foto_coleta: input.exige_foto_coleta,
    exige_foto_entrega: input.exige_foto_entrega,
    exige_assinatura: input.exige_assinatura,
    exige_pin_entrega: input.exige_pin_entrega,
    exige_controle_temperatura: input.exige_controle_temperatura,
    permite_entrega_parcial: input.permite_entrega_parcial,
    instrucoes_padrao: input.instrucoes_padrao || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("regras_operacao_cliente")
    .upsert(payload, { onConflict: "cliente_id,modalidade" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as RegraOperacaoCliente;
}

export async function excluirRegraOperacao(id: string): Promise<void> {
  const { error } = await supabase.from("regras_operacao_cliente").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
