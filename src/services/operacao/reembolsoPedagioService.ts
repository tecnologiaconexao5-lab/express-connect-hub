// A31-J1.6 — Comprovante de pedágio (reutiliza a estrutura OFICIAL reembolsos_prestador,
// migration M129c — sem tabela/storage/bucket paralelo).
// O arquivo é enviado ao bucket privado `documentos_operacionais` (mesma Central de
// Documentos) e a URL estável fica em `reembolsos_prestador.comprovante_url`.
import { supabase } from "@/lib/supabase";
import {
  assinarStorageRef,
  caminhoValido,
  KNOWN_BUCKETS,
  parseStorageRef,
  SIGN_TTL_SECONDS,
} from "@/services/storage/storageRefService";

export const BUCKET_COMPROVANTE_PEDAGIO = "documentos_operacionais";
export const TIPO_COMPROVANTE_PEDAGIO = "Comprovante de Pedágio";

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

const CAMPOS_REEMBOLSO =
  "id, prestador, os_id, tipo, descricao, valor, data_despesa, comprovante_url, status";

async function buscarReembolsoPorOs(osId: string): Promise<ReembolsoPedagio | null> {
  const { data, error } = await supabase
    .from("reembolsos_prestador")
    .select(CAMPOS_REEMBOLSO)
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
}

async function buscarReembolsoPorComprovante(url: string): Promise<ReembolsoPedagio | null> {
  if (!url) return null;
  const { data, error } = await supabase
    .from("reembolsos_prestador")
    .select(CAMPOS_REEMBOLSO)
    .eq("comprovante_url", url)
    .eq("tipo", "pedagio")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[reembolsoPedagioService] Erro ao buscar comprovante por URL:", error.message);
    return null;
  }
  return (data || null) as ReembolsoPedagio | null;
}

/**
 * Busca o comprovante de pedágio vinculado a uma operação.
 * Aceita o id da OS (`os_id`) ou o id da alocação na Central Financeira; no caso
 * da alocação sem OS, usa o metadado da Central para localizar o comprovante.
 * A Central é a fonte dos uploads feitos pelo Financeiro (o trigger oficial do
 * App Motorista exige um prestador autenticado para gravar em reembolsos_prestador).
 */
export async function buscarComprovantePedagio(
  osOuAlocacaoId: string,
): Promise<ReembolsoPedagio | null> {
  if (!osOuAlocacaoId) return null;
  try {
    const porOs = await buscarReembolsoPorOs(osOuAlocacaoId);
    if (porOs) return porOs;

    const { data: doc } = await supabase
      .from("documentos_metadata")
      .select("id, url, nome, descricao, data_inclusao")
      .eq("modulo_origem", "financeiro")
      .eq("entidade_id", osOuAlocacaoId)
      .eq("tipo", TIPO_COMPROVANTE_PEDAGIO)
      .eq("ativo", true)
      .order("data_inclusao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const registro = (doc as {
      id?: string;
      url?: string;
      nome?: string | null;
      descricao?: string | null;
      data_inclusao?: string | null;
    } | null) || null;
    if (!registro?.url) return null;

    const porUrl = await buscarReembolsoPorComprovante(registro.url);
    if (porUrl) return porUrl;

    // Compatibilidade: upload feito pelo Financeiro fica na Central (metadado),
    // sem criar lançamento em reembolsos_prestador (regra do App mantida intacta).
    return {
      id: registro.id || "",
      prestador: null,
      os_id: null,
      tipo: "pedagio",
      descricao: registro.descricao || registro.nome || "Comprovante de pedágio",
      valor: null,
      data_despesa: registro.data_inclusao ? registro.data_inclusao.slice(0, 10) : null,
      comprovante_url: registro.url,
      status: "pendente",
    };
  } catch (err) {
    console.warn("[reembolsoPedagioService] Exceção ao buscar comprovante:", err);
    return null;
  }
}

/** Registra um comprovante informado apenas por URL (comprovantes antigos/links). */
export async function registrarComprovantePedagioUrl(input: {
  url: string;
  alocacaoId: string;
  descricao?: string | null;
}): Promise<string | null> {
  const url = String(input.url || "").trim();
  if (!url || !input.alocacaoId) return null;
  const { data, error } = await supabase
    .from("documentos_metadata")
    .insert([{
      url,
      nome: url.split("/").pop() || "Comprovante de pedágio",
      tipo: TIPO_COMPROVANTE_PEDAGIO,
      modulo_origem: "financeiro",
      entidade_id: input.alocacaoId,
      status_ia: "pendente",
      categoria: "Financeiro",
      departamento: "Financeiro",
      responsavel: "Financeiro",
      descricao: input.descricao || "Comprovante de pedágio (link informado)",
      ativo: true,
      historico: [{
        id: crypto.randomUUID?.() || `evt_${Date.now()}`,
        tipo: "criacao",
        descricao: "Comprovante de pedágio informado por link.",
        data: new Date().toISOString(),
        usuario: "Financeiro",
      }],
    }])
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn("[reembolsoPedagioService] Falha ao registrar comprovante por URL:", error.message);
    return null;
  }
  return (data as { id?: string } | null)?.id || null;
}

export interface ComprovantePedagioInput {
  os_id: string | null;
  prestador: string | null;
  valor: number;
  data_despesa: string;
  comprovante_url: string;
  tenant_id?: string | null;
}

/** Persiste o comprovante de pedágio na estrutura oficial reembolsos_prestador. */
export async function salvarComprovantePedagio(
  input: ComprovantePedagioInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("reembolsos_prestador").insert({
      os_id: input.os_id || null,
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
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar comprovante" };
  }
}

/**
 * Resolve a referência do comprovante para URL assinada (bucket privado) ou
 * devolve a URL externa original (compatibilidade com comprovantes antigos).
 */
export async function resolverUrlComprovantePedagio(
  value: string | null | undefined,
): Promise<string | null> {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const primeiro = raw.split("/")[0];
  // Compatibilidade com o path legado do App (sem prefixo de bucket):
  // `a5e5.../reimbursement/...` vive no bucket privado `driver-evidence`.
  if (!KNOWN_BUCKETS.has(primeiro) && raw.includes("/reimbursement/")) {
    return assinarStorageRef(
      { bucket: "driver-evidence", path: raw, external: false, raw },
      SIGN_TTL_SECONDS,
    );
  }
  const ref = parseStorageRef(value, BUCKET_COMPROVANTE_PEDAGIO);
  if (!ref) return null;
  if (ref.external) return ref.raw;
  if (!caminhoValido(ref.path)) return null;
  if (!KNOWN_BUCKETS.has(ref.bucket)) return null;
  return assinarStorageRef(ref, SIGN_TTL_SECONDS);
}
