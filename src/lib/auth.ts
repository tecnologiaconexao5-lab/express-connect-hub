import { supabase } from "./supabase";

export type UserRole = "super_admin" | "admin" | "operador" | "financeiro" | "comercial" | "atendimento" | "motorista" | "cliente" | "prestador";

export interface User {
  email: string;
  name: string;
  role: UserRole;
  unit: string;
}

export function mapPapelToUserRole(papel: string): UserRole {
  switch (papel) {
    case "super_admin": return "super_admin";
    case "admin_tenant":
    case "gestor":
    case "admin": return "admin";
    case "operacional":
    case "operador": return "operador";
    case "financeiro": return "financeiro";
    case "comercial": return "comercial";
    case "atendimento": return "atendimento";
    case "cliente": return "cliente";
    case "prestador": return "prestador";
    case "motorista": return "motorista";
    default: return "operador";
  }
}

export function getRedirectPath(role: UserRole): string {
  switch (role) {
    case "super_admin":
    case "admin": return "/dashboard";
    case "financeiro": return "/financeiro";
    case "comercial": return "/comercial";
    case "operador": return "/operacao";
    case "atendimento": return "/dashboard";
    case "motorista":
    case "prestador": return "/app-prestador";
    case "cliente": return "/portal-cliente";
  }
}

// Obter sessão atual do Supabase (para verificar se está logado via auth real)
export async function getSessaoSupabase() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

// Obter cliente_id do usuário logado via Supabase Auth
export async function obterClienteIdAuth(): Promise<string | null> {
  try {
    const sessao = await getSessaoSupabase();
    if (!sessao?.user?.id) return null;

    const authUserId = sessao.user.id;
    const { data: vinculos } = await supabase
      .from("usuarios_cliente")
      .select("cliente_id")
      .eq("auth_user_id", authUserId)
      .eq("ativo", true)
      .limit(1);

    return vinculos && vinculos.length > 0 ? vinculos[0].cliente_id : null;
  } catch {
    return null;
  }
}
