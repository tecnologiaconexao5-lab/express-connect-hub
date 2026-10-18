// A31-J1.6 — Comprovante de pedágio (reutiliza a estrutura OFICIAL reembolsos_prestador,
// migration M129c — sem tabela/storage/bucket paralelo).
import { supabase } from "@/lib/supabase";

export interface ReembolsoPedagio {
  id: string;
  prestador: string | null;
  os_id: string | null;
  tipo: string | null;
  descricao: string | null;
  valor: number | null;
  data_despesa: string | null;
  comprovante_url: string | null;
  status: string | null;
}

/** Busca o comprovante de pedágio vinculado a uma operação (os_id = alocação no lançamento manual). */
export async function buscarComprovantePedagio(osId: string): Promise<ReembolsoPedagio | null> {
  try {
    const { data, error } = await supabase
      .from("reembolsos_prestador")
      .select("id, prestador, os_id, tipo, descricao, valor, data_despesa, comprovante_url, status")
      .eq("os_id", osId)
      .eq("tipo", "pedagio")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[reembolsoPedagioService] Erro ao buscar comprovante:", error.message);
      return null;
    }
    return (data || null) as ReembolsoPedagio | null;
  } catch (err) {
    console.warn("[reembolsoPedagioService] Exceção ao buscar comprovante:", err);
    return null;
  }
}

export interface ComprovantePedagioInput {
  os_id: string;
  prestador: string | null;
  valor: number;
  data_despesa: string;
  comprovante_url: string;
  tenant_id?: string | null;
}

/** Persiste o comprovante de pedágio na estrutura oficial reembolsos_prestador. */
export async function salvarComprovantePedagio(input: ComprovantePedagioInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("reembolsos_prestador").insert({
      os_id: input.os_id,
      prestador: input.prestador || null,
      tipo: "pedagio",
      descricao: "Pedágio (lançamento manual)",
      valor: input.valor,
      data_despesa: input.data_despesa || null,
      comprovante_url: input.comprovante_url || null,
      status: "pendente",
      tenant_id: input.tenant_id || null,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao salvar comprovante" };
  }
}
