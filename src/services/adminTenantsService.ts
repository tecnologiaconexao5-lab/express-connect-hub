import { supabase } from "@/lib/supabase";

export interface TenantRow {
  id: string;
  nome: string;
  slug: string;
  documento?: string;
  plano: string;
  status: string;
  email_contato?: string;
  telefone_contato?: string;
  logo_url?: string;
  cor_primaria?: string;
  dominio_customizado?: string;
  config?: Record<string, unknown>;
  criado_em?: string;
  atualizado_em?: string;
}

export interface TenantUsuarioRow {
  id: string;
  tenant_id: string;
  user_id: string;
  papel: string;
  status: string;
  criado_em?: string;
  atualizado_em?: string;
}

export async function listarTenants(): Promise<TenantRow[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as TenantRow[];
}

export async function buscarTenant(id: string): Promise<TenantRow | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as TenantRow | null;
}

export async function criarTenant(
  input: Pick<TenantRow, "nome" | "slug" | "plano" | "status"> &
    Partial<Omit<TenantRow, "id" | "criado_em" | "atualizado_em">>
): Promise<TenantRow> {
  const { data, error } = await supabase
    .from("tenants")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as TenantRow;
}

export async function atualizarTenant(
  id: string,
  updates: Partial<Omit<TenantRow, "id" | "criado_em" | "atualizado_em">>
): Promise<TenantRow> {
  const { data, error } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as TenantRow;
}

export async function deletarTenant(id: string): Promise<void> {
  const { error } = await supabase.from("tenants").delete().eq("id", id);
  if (error) throw error;
}

export async function listarUsuariosTenant(tenantId: string): Promise<TenantUsuarioRow[]> {
  const { data, error } = await supabase
    .from("tenant_usuarios")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TenantUsuarioRow[];
}

export async function listarTodosUsuarios(): Promise<TenantUsuarioRow[]> {
  const { data, error } = await supabase
    .from("tenant_usuarios")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TenantUsuarioRow[];
}

export async function vincularUsuario(
  input: Pick<TenantUsuarioRow, "tenant_id" | "user_id" | "papel" | "status">
): Promise<TenantUsuarioRow> {
  const { data, error } = await supabase
    .from("tenant_usuarios")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as TenantUsuarioRow;
}

export async function atualizarVinculo(
  id: string,
  updates: Partial<Pick<TenantUsuarioRow, "papel" | "status">>
): Promise<TenantUsuarioRow> {
  const { data, error } = await supabase
    .from("tenant_usuarios")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as TenantUsuarioRow;
}

export async function removerVinculo(id: string): Promise<void> {
  const { error } = await supabase
    .from("tenant_usuarios")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Buscar user_id por email via RPC (requer migration M20 e papel super_admin) */
export async function buscarUsuarioPorEmail(email: string): Promise<{ id: string; email: string } | null> {
  try {
    const { data, error } = await supabase.rpc("buscar_usuario_por_email", { p_email: email });
    if (error) throw error;
    if (data && data.length > 0) return data[0] as { id: string; email: string };
    return null;
  } catch {
    return null;
  }
}

/** Listar todos os vinculos com email (via RPC M20 se disponivel) */
export async function listarTodosUsuariosComEmail(): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc("listar_usuarios_tenant", { p_tenant_id: null });
    if (!error && data) return data as any[];
  } catch {
    // RPC nao disponivel ou sem permissao — fallback
  }
  return listarTodosUsuarios();
}

/** Criar convite para usuario se vincular a um tenant */
export async function criarConvite(
  tenantId: string,
  email: string,
  papel: string
): Promise<{ id: string; token: string }> {
  const { data, error } = await supabase
    .from("convites")
    .insert({ tenant_id: tenantId, email, papel, criado_por: (await supabase.auth.getUser()).data.user?.id })
    .select("id, token")
    .single();
  if (error) throw error;
  return data as { id: string; token: string };
}

/** Listar convites pendentes de um tenant */
export async function listarConvites(tenantId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("convites")
    .select("id, email, papel, token, usado, expira_em, criado_em")
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Remover convite */
export async function removerConvite(id: string): Promise<void> {
  const { error } = await supabase.from("convites").delete().eq("id", id);
  if (error) throw error;
}
