import { UserRole, getUser } from "./auth";

export interface ModuloPermissao {
  modulo: string;
  pode_ver: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
}

const PERMISSOES_ADMIN: ModuloPermissao[] = [
  { modulo: "dashboard", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "clientes", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "prestadores", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "ordens_servico", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "financeiro", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "cadastros_auxiliares", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "relatorios", pode_ver: true, pode_editar: true, pode_excluir: true },
  { modulo: "configuracoes", pode_ver: true, pode_editar: true, pode_excluir: true },
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

const PERMISSOES_CLIENTE: ModuloPermissao[] = [
  { modulo: "dashboard", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "clientes", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "prestadores", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "ordens_servico", pode_ver: true, pode_editar: false, pode_excluir: false },
  { modulo: "financeiro", pode_ver: true, pode_editar: false, pode_excluir: false },
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
  { modulo: "cadastros_auxiliares", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "relatorios", pode_ver: false, pode_editar: false, pode_excluir: false },
  { modulo: "configuracoes", pode_ver: false, pode_editar: false, pode_excluir: false },
];

export function getPermissoes(role: UserRole): ModuloPermissao[] {
  switch (role) {
    case "admin": return PERMISSOES_ADMIN;
    case "operador": return PERMISSOES_OPERADOR;
    case "cliente": return PERMISSOES_CLIENTE;
    case "prestador": return PERMISSOES_PRESTADOR;
    default: return [];
  }
}

export function podeAcessar(modulo: string, acao: "ver" | "editar" | "excluir"): boolean {
  const user = getUser();
  if (!user) return false;
  
  const permissoes = getPermissoes(user.role);
  const perm = permissoes.find(p => p.modulo === modulo);
  
  if (!perm) return false;
  
  switch (acao) {
    case "ver": return perm.pode_ver;
    case "editar": return perm.pode_editar;
    case "excluir": return perm.pode_excluir;
    default: return false;
  }
}

export function getModulosVisiveis(): string[] {
  const user = getUser();
  if (!user) return [];
  
  const permissoes = getPermissoes(user.role);
  return permissoes.filter(p => p.pode_ver).map(p => p.modulo);
}