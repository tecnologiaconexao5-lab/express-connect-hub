import { supabase } from "@/lib/supabase";

function nowISO(): string {
  return new Date().toISOString();
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function gerarIdempotencyKey(
  conectorId: string,
  acao: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const raw = `${conectorId}:${acao}:${JSON.stringify(payload)}`;
  return sha256(raw);
}

export async function verificarDuplicidade(
  idempotencyKey: string,
  conectorId: string,
): Promise<{ duplicata: boolean; execucaoExistente?: { id: string; resultado: Record<string, unknown>; status: string } }> {
  const { data } = await supabase
    .from("ia_execucoes_conectores")
    .select("id, resultado, status")
    .eq("idempotency_key", idempotencyKey)
    .eq("conector_id", conectorId)
    .eq("status", "CONCLUIDA")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    return { duplicata: true, execucaoExistente: { id: data.id, resultado: data.resultado as Record<string, unknown>, status: data.status } };
  }
  return { duplicata: false };
}

export async function marcarDuplicata(
  execucaoId: string,
  idempotencyKey: string,
  execucaoOriginalId: string,
): Promise<void> {
  await supabase.from("ia_execucoes_conectores").update({
    idempotency_key: idempotencyKey,
    status: "CONCLUIDA",
    resultado: {
      status: "duplicata_bloqueada",
      mensagem: `Execução duplicada bloqueada. A execução original ${execucaoOriginalId} já foi concluída com a mesma chave de idempotência.`,
      execucao_original_id: execucaoOriginalId,
      duplicata: true,
    },
    fim_execucao: nowISO(),
    updated_at: nowISO(),
  }).eq("id", execucaoId);
}

export async function registrarIdempotencyKey(
  execucaoId: string,
  idempotencyKey: string,
): Promise<void> {
  await supabase.from("ia_execucoes_conectores").update({
    idempotency_key: idempotencyKey,
    updated_at: nowISO(),
  }).eq("id", execucaoId);
}
