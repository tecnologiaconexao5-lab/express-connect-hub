// ============================================================
// FASE 7 — Convites de OS (linha do tempo do Match → resposta)
// ============================================================
import { supabase } from "@/lib/supabase";

export type RespostaConvite = "pendente" | "aceito" | "recusado" | "expirado";

export interface ConviteOS {
  id: string;
  prestadorId: string;
  osId: string | null;
  status: RespostaConvite;
  sugeridoEm: string;
  respondidoEm: string | null;
  tempoRespostaMinutos: number | null;
  motivoRecusa: string | null;
}

const TABELA = "recrutamento_convites_os";

export async function registrarConviteOS(input: {
  prestadorId: string;
  osId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; id?: string; erro?: string }> {
  if (!input.prestadorId) return { ok: false, erro: "Prestador não informado." };
  const { data, error } = await supabase
    .from(TABELA)
    .insert([
      {
        prestador_id: input.prestadorId,
        os_id: input.osId || null,
        status: "pendente",
        sugerido_em: new Date().toISOString(),
        metadata: input.metadata || {},
      },
    ])
    .select("id")
    .single();
  if (error || !data) return { ok: false, erro: error?.message || "Falha ao registrar convite." };
  return { ok: true, id: String((data as { id: unknown }).id) };
}

export async function responderConviteOS(
  conviteId: string,
  resposta: Exclude<RespostaConvite, "pendente">,
  motivoRecusa?: string,
): Promise<{ ok: boolean; erro?: string }> {
  if (!conviteId) return { ok: false, erro: "Convite não informado." };

  const { data: atual, error: erroAtual } = await supabase
    .from(TABELA)
    .select("sugerido_em, status")
    .eq("id", conviteId)
    .maybeSingle();
  if (erroAtual) return { ok: false, erro: erroAtual.message };
  if (!atual) return { ok: false, erro: "Convite não encontrado." };

  const sugeridoEm = new Date(String((atual as { sugerido_em?: string }).sugerido_em || Date.now()));
  const agora = new Date();
  const minutos = Math.max(
    0,
    Math.round((agora.getTime() - sugeridoEm.getTime()) / (1000 * 60)),
  );

  const { error } = await supabase
    .from(TABELA)
    .update({
      status: resposta,
      respondido_em: agora.toISOString(),
      tempo_resposta_minutos: minutos,
      motivo_recusa: resposta === "recusado" ? motivoRecusa || null : null,
      updated_at: agora.toISOString(),
    })
    .eq("id", conviteId);
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

export async function listarConvitesOS(osId: string): Promise<ConviteOS[]> {
  if (!osId) return [];
  const { data, error } = await supabase
    .from(TABELA)
    .select("*")
    .eq("os_id", osId)
    .order("sugerido_em", { ascending: false });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    prestadorId: String(row.prestador_id),
    osId: row.os_id ? String(row.os_id) : null,
    status: (String(row.status || "pendente") as RespostaConvite),
    sugeridoEm: String(row.sugerido_em || ""),
    respondidoEm: row.respondido_em ? String(row.respondido_em) : null,
    tempoRespostaMinutos:
      row.tempo_resposta_minutos === null || row.tempo_resposta_minutos === undefined
        ? null
        : Number(row.tempo_resposta_minutos),
    motivoRecusa: row.motivo_recusa ? String(row.motivo_recusa) : null,
  }));
}
