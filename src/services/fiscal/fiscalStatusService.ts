import { supabase } from "@/lib/supabase";

interface AlterarStatusParams {
  documentoTipo: "CTE" | "MDFE" | "NFSE";
  documentoId: string;
  statusNovo: string;
  motivo: string;
  usuario?: string;
}

const tabelas: Record<string, string> = { CTE: "fiscal_ctes", MDFE: "fiscal_mdfes", NFSE: "fiscal_nfse" };

export async function alterarStatusFiscalInterno(params: AlterarStatusParams) {
  try {
    const { documentoTipo, documentoId, statusNovo, motivo, usuario } = params;
    const tabela = tabelas[documentoTipo];

    const { data: doc, error: fetchErr } = await supabase
      .from(tabela)
      .select("status")
      .eq("id", documentoId)
      .maybeSingle();

    if (fetchErr || !doc) throw new Error("Documento nao encontrado.");

    const statusAnterior = doc.status;

    const { error: updateErr } = await supabase
      .from(tabela)
      .update({ status: statusNovo, updated_at: new Date().toISOString() })
      .eq("id", documentoId);

    if (updateErr) throw new Error("Erro ao atualizar status: " + updateErr.message);

    await supabase.from("fiscal_historico_status").insert([{
      documento_tipo: documentoTipo,
      documento_id: documentoId,
      status_anterior: statusAnterior,
      status_novo: statusNovo,
      motivo,
      usuario: usuario || "sistema",
      origem: "simulacao_interna",
    }]);

    await supabase.from("fiscal_events").insert([{
      documento_tipo: documentoTipo,
      documento_id: documentoId,
      tipo_evento: "SIMULACAO_STATUS",
      descricao: statusAnterior + " → " + statusNovo + " (simulacao)",
      metadata: { status_anterior: statusAnterior, status_novo: statusNovo, motivo, origem: "simulacao_interna" },
    }]);

    await supabase.from("fiscal_logs").insert([{
      entidade_tipo: documentoTipo,
      entidade_id: documentoId,
      acao: "SIMULAR_ALTERACAO_STATUS",
      request: { status_anterior: statusAnterior, status_novo: statusNovo, motivo },
      response: { status: "sucesso", origem: "simulacao_interna" },
    }]);

    return { success: true };
  } catch (error: any) {
    console.error("[FiscalStatus] Erro:", error);
    return { success: false, error: error.message };
  }
}

export async function listarHistoricoStatus(documentoTipo: string, documentoId: string) {
  try {
    const { data } = await supabase
      .from("fiscal_historico_status")
      .select("*")
      .eq("documento_tipo", documentoTipo)
      .eq("documento_id", documentoId)
      .order("created_at", { ascending: false });

    return data || [];
  } catch (err) {
    console.error("[FiscalStatus] Erro ao listar historico:", err);
    return [];
  }
}
