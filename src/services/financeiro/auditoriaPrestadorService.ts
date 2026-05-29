import { supabase } from "@/lib/supabase";

export type AcaoAuditoria =
  | "marcar_conferido"
  | "aprovar_pagamento"
  | "reprovar_pagamento"
  | "marcar_em_lote"
  | "cancelar_pagamento"
  | "marcar_pago"
  | "criar_pagamento"
  | "gerar_fechamento"
  | "gerar_repasse"
  | "atualizar_status";

export interface AuditoriaInput {
  acao: AcaoAuditoria;
  entidade_tipo: string;
  entidade_id?: string;
  prestador_id?: string;
  prestador_nome?: string;
  valor_anterior?: number;
  valor_novo?: number;
  detalhes?: Record<string, unknown>;
}

export async function registrarAuditoria(input: AuditoriaInput): Promise<void> {
  const user = obterUsuarioAtual();

  const payload = {
    acao: input.acao,
    entidade_tipo: input.entidade_tipo,
    entidade_id: input.entidade_id || null,
    prestador_id: input.prestador_id || null,
    prestador_nome: input.prestador_nome || null,
    valor_anterior: input.valor_anterior ?? 0,
    valor_novo: input.valor_novo ?? 0,
    detalhes: input.detalhes ? JSON.stringify(input.detalhes) : "{}",
    criado_por: user,
  };

  try {
    const { error } = await supabase.from("financeiro_prestador_auditoria").insert([payload]);
    if (error) {
      console.warn("[Auditoria] Erro ao registrar auditoria (não crítico):", error.message);
    }
  } catch (e) {
    console.warn("[Auditoria] Falha ao registrar auditoria (não crítico):", e);
  }
}

function obterUsuarioAtual(): string {
  try {
    const stored = localStorage.getItem("demo_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.nome || parsed?.email || "operador";
    }
  } catch {
    // ignore
  }
  return "sistema";
}
