import type { UserRole, User } from "./auth";

export interface ModuloPermissao {
  modulo: string;
  pode_ver: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
}

const PERMISSOES_SUPER_ADMIN: ModuloPermissao[] = [
  { modulo: "dashboard", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "clientes", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "prestadores", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "ordens_servico", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "financeiro", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "frota", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "cadastros_auxiliares", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "relatorios", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "configuracoes", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "admin_tenants", pode_ver: true, pode_editar: true, pode_excluir: true },
];

const PERMISSOES_ADMIN: ModuloPermissao[] = [
  { modulo: "dashboard", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "clientes", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "prestadores", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "ordens_servico", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "financeiro", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "frota", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "cadastros_auxiliares", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "relatorios", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "configuracoes", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "admin_tenants", pode_ver: false, pode_editar: false, pode_excluir: false },
];

const PERMISSOES_OPERADOR: ModuloPermissao[] = [
  { modulo: "dashboard", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "clientes", pode_ver: true, pode_editar: true, pode_excluir: false },
  { modulo: "prestadores", pode_ver: true, pode_editar: true, pode_excluir: false },
  { modulo: "ordens_servico", pode_ver: true, pode_editar: true, pode_excluir: false },
  { modulo: "financeiro", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "frota", pode_ver: true, pode_editar: true, pode_excluir: false },
  { modulo: "cadastros_auxiliares", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "relatorios", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "configuracoes", pode_ver: false, pode_editar: false, pode_excluir: false },
];

const PERMISSOES_FINANCEIRO: ModuloPermissao[] = [
  { modulo: "dashboard", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "clientes", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "prestadores", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "ordens_servico", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "financeiro", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "frota", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "cadastros_auxiliares", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "relatorios", pode_ver: true, pode_editar: true, pode_excluir: false },
  { modulo: "configuracoes", pode_ver: false, pode_editar: false, pode_excluir: false },
];

const PERMISSOES_COMERCIAL: ModuloPermissao[] = [
  { modulo: "dashboard", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "clientes", pode_ver: true, pode_editar: true, pode_excluir: false },
  { modulo: "prestadores", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "ordens_servico", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "financeiro", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "frota", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "cadastros_auxiliares", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "relatorios", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "configuracoes", pode_ver: false, pode_editar: false, pode_excluir: false },
];

const PERMISSOES_CLIENTE: ModuloPermissao[] = [
  { modulo: "dashboard", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "clientes", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "prestadores", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "ordens_servico", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "financeiro", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "frota", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "cadastros_auxiliares", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "relatorios", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "configuracoes", pode_ver: false, pode_editar: false, pode_excluir: false },
];

const PERMISSOES_PRESTADOR: ModuloPermissao[] = [
  { modulo: "dashboard", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "clientes", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "prestadores", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "ordens_servico", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "financeiro", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "frota", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "cadastros_auxiliares", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "relatorios", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "configuracoes", pode_ver: false, pode_editar: false, pode_excluir: false },
];

const PERMISSOES_MOTORISTA: ModuloPermissao[] = [
  { modulo: "dashboard", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "clientes", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "prestadores", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "ordens_servico", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "financeiro", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "frota", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "cadastros_auxiliares", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "relatorios", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "configuracoes", pode_ver: false, pode_editar: false, pode_excluir: false },
];

const PERMISSOES_ATENDIMENTO: ModuloPermissao[] = [
  { modulo: "dashboard", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "clientes", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "prestadores", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "ordens_servico", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "financeiro", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "frota", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "cadastros_auxiliares", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "relatorios", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "configuracoes", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "admin_tenants", pode_ver: false, pode_editar: false, pode_excluir: false },
];

export function getPermissoes(role: UserRole): ModuloPermissao[] {
  switch (role) {
    case "super_admin": return PERMISSOES_SUPER_ADMIN;
    case "admin": return PERMISSOES_ADMIN;
    case "operador": return PERMISSOES_OPERADOR;
    case "financeiro": return PERMISSOES_FINANCEIRO;
    case "comercial": return PERMISSOES_COMERCIAL;
    case "atendimento": return PERMISSOES_ATENDIMENTO;
    case "cliente": return PERMISSOES_CLIENTE;
    case "prestador": return PERMISSOES_PRESTADOR;
    case "motorista": return PERMISSOES_MOTORISTA;
    default: return [];
  }
}

export function podeAcessar(modulo: string, acao: "ver" | "editar" | "excluir", user?: User): boolean {
  const u = user ?? null;
  if (!u) return false;
  
  const permissoes = getPermissoes(u.role);
  const perm = permissoes.find(p => p.modulo === modulo);
  
  if (!perm) return false;
  
  switch (acao) {
    case "ver": return perm.pode_ver;
    case "editar": return perm.pode_editar;
    case "excluir": return perm.pode_excluir;
    default: return false;
  }
}

export function getModulosVisiveis(user: User): string[] {
  const permissoes = getPermissoes(user.role);
  return permissoes.filter(p => p.pode_ver).map(p => p.modulo);
}

/**
 * UPGRADE-REGRAS-DE-NEGOCIO-ALOCACAO-E-PERMISSOES — CONTROLE DE ACESSO A MARGENS
 * Receita (Cliente), Margem (R$) e Margem (%) são valores sensíveis da operação:
 * somente perfis administrativos (super_admin / admin) podem visualizá-los.
 * Operacionais (operador, atendimento, comercial, etc.) veem apenas "---".
 * O Custo do Prestador permanece visível para todas as personas (necessário na operação).
 */
export function podeVerReceitaEMargem(role?: UserRole | string | null): boolean {
  return role === "super_admin" || role === "admin";
}

/**
 * LGPD — Avaliações situacionais expõem perfil comportamental.
 * Visíveis apenas para recrutador/admin (não para comercial, financeiro,
 * atendimento, cliente ou prestador).
 */
export function podeVerAvaliacaoSituacional(
  role?: UserRole | string | null,
): boolean {
  return ["super_admin", "admin", "admin_tenant", "operador", "recrutador"].includes(
    String(role || ""),
  );
}