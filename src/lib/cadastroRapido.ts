import { supabase } from "@/lib/supabase";
import { toClienteInsert } from "@/lib/dbMappers";

/**
 * Cadastro rápido de Cliente/Prestador a partir do formulário de OS/Orçamento.
 *
 * Cria um registro mínimo (sem migration) e o marca como "incompleto" para que a
 * operação finalize o cadastro depois:
 *  - Cliente:   `status = "pre-cadastro"` + `origem_comercial = "cadastro_rapido"`.
 *  - Prestador: `origem = "cadastro_rapido"` + `metadata.cadastro_rapido = true`
 *               (status permanece "ativo" para já aparecer nos filtros operacionais).
 */

const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const somenteDigitos = (v: string) => (v || "").replace(/\D/g, "");

/** Resolve o tenant_id do usuário atual (RPC + fallback via tenant_usuarios). */
export async function resolverTenantId(): Promise<string | undefined> {
  try {
    const { data } = await supabase.rpc("current_tenant_id_safe");
    if (typeof data === "string" && data) return data;
  } catch {
    // segue para o fallback
  }
  try {
    const { data: authData } = await supabase.auth.getUser();
    const authUserId = authData?.user?.id;
    if (!authUserId) return undefined;
    const { data: vinculo } = await supabase
      .from("tenant_usuarios")
      .select("tenant_id")
      .eq("user_id", authUserId)
      .maybeSingle();
    const tenantId = (vinculo as Record<string, unknown> | null)?.tenant_id;
    return typeof tenantId === "string" && tenantId ? tenantId : undefined;
  } catch {
    return undefined;
  }
}

export interface ClienteRapidoInput {
  nome: string;
  telefone?: string;
  cnpj?: string;
}

/** Cria um cliente mínimo com status "pre-cadastro". Retorna o registro criado. */
export async function criarClienteRapido(input: ClienteRapidoInput): Promise<Record<string, unknown>> {
  const nome = (input.nome || "").trim();
  if (!nome) throw new Error("Informe o nome do cliente.");

  const tenantId = await resolverTenantId();
  const novoId = uid();

  const payload = toClienteInsert({
    razaoSocial: nome,
    nomeFantasia: nome,
    cnpj: somenteDigitos(input.cnpj || "") || undefined,
    telefone: (input.telefone || "").trim() || undefined,
    status: "pre-cadastro",
    observacoes: "Cadastro rápido (OS/Orçamento) — requer validação.",
    origemComercial: "cadastro_rapido",
    tenantId,
  });
  // ID gerado no cliente: garante o vínculo mesmo se o RETURNING for bloqueado por RLS.
  payload.id = novoId;

  // Insert sem `.select()` — o RLS de SELECT pode ocultar a linha recém-criada.
  const { error } = await supabase.from("clientes").insert([payload]);
  if (error) throw error;

  return {
    id: novoId,
    nome_fantasia: String(payload.nome_fantasia || nome),
    razao_social: String(payload.razao_social || nome),
    cnpj: (payload.cnpj as string) || "",
    telefone: (payload.telefone as string) || "",
    status: "pre-cadastro",
    origem_comercial: "cadastro_rapido",
  };
}

export interface PrestadorRapidoInput {
  nome: string;
  telefone?: string;
}

/** Cria um prestador mínimo com a flag `metadata.cadastro_rapido`. Retorna o registro. */
export async function criarPrestadorRapido(input: PrestadorRapidoInput): Promise<Record<string, unknown>> {
  const nome = (input.nome || "").trim();
  if (!nome) throw new Error("Informe o nome do prestador.");

  const tenantId = await resolverTenantId();
  const novoId = uid();
  const telefone = (input.telefone || "").trim() || undefined;

  const payload: Record<string, unknown> = {
    id: novoId,
    nome_completo: nome,
    nome_fantasia: nome,
    telefone,
    whatsapp: telefone,
    status: "ativo",
    origem: "cadastro_rapido",
    observacoes: "Cadastro rápido (OS) — requer validação/documentação.",
    metadata: { cadastro_rapido: true, criado_em: new Date().toISOString() },
  };
  if (tenantId) payload.tenant_id = tenantId;

  const { error } = await supabase.from("prestadores").insert([payload]);
  if (error) throw error;

  return {
    id: novoId,
    nome_completo: nome,
    nome_fantasia: nome,
    telefone: telefone || "",
    whatsapp: telefone || "",
    status: "ativo",
    origem: "cadastro_rapido",
    metadata: payload.metadata,
  };
}

/** Cliente incompleto: pré-cadastro (flag já existente) ou sem CNPJ e sem razão social. */
export function ehCadastroIncompletoCliente(record: unknown): boolean {
  const r = record as Record<string, unknown> | null;
  if (!r) return false;
  if (String(r.status || "") === "pre-cadastro") return true;
  if (String(r.origem_comercial || "") === "cadastro_rapido") return true;
  return !r.cnpj && !r.razao_social && !r.nome_fantasia;
}

/** Prestador incompleto: flag `cadastro_rapido` no metadata ou sem CPF/CNPJ e sem telefone. */
export function ehCadastroIncompletoPrestador(record: unknown): boolean {
  const r = record as Record<string, unknown> | null;
  if (!r) return false;
  const meta = r.metadata as Record<string, unknown> | null;
  if (meta && meta.cadastro_rapido === true) return true;
  if (String(r.origem || "") === "cadastro_rapido") return true;
  return !r.cpf_cnpj && !r.telefone && !r.whatsapp;
}
