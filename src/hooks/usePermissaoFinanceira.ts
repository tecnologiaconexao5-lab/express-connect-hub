import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { User, UserRole } from "@/lib/auth";

/**
 * REGRA GLOBAL DE PRIVACIDADE FINANCEIRA
 *
 * Receita, Custo, Margem (R$) e Margem (%) / Lucro são dados sensíveis.
 * Somente o Administrador Geral pode visualizá-los.
 *
 * Aceita tanto os papéis brutos do banco (`adm_geral`, `administrador`, `master`,
 * `admin`, `super_admin`, `admin_tenant`) quanto a flag explícita
 * `permissoes.ver_margem === true` (ou `metadata.ver_margem`).
 */

const ROLES_ADMIN_GERAL = new Set<string>([
  "super_admin",
  "adm_geral",
  "admin_geral",
  "administrador",
  "administrador_geral",
  "admin",
  "admin_tenant",
  "master",
]);

export type UsuarioComPermissoes = (User & {
  permissoes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  tipo?: string | null;
  perfil?: string | null;
  papel?: string | null;
}) | null | undefined;

function lerFlagVerMargem(valor: unknown): boolean {
  return valor === true || valor === "true" || valor === 1 || valor === "1";
}

function extrairFlag(user: UsuarioComPermissoes): boolean {
  if (!user) return false;
  const permissoes = user.permissoes ?? null;
  const metadata = user.metadata ?? null;

  if (permissoes) {
    if (
      lerFlagVerMargem(permissoes.ver_margem) ||
      lerFlagVerMargem(permissoes.verMargem) ||
      lerFlagVerMargem(permissoes["ver-margem"])
    ) {
      return true;
    }
  }

  if (metadata) {
    if (
      lerFlagVerMargem(metadata.ver_margem) ||
      lerFlagVerMargem(metadata.verMargem)
    ) {
      return true;
    }
    const permissoesMeta = metadata.permissoes;
    if (permissoesMeta && typeof permissoesMeta === "object") {
      const p = permissoesMeta as Record<string, unknown>;
      if (lerFlagVerMargem(p.ver_margem) || lerFlagVerMargem(p.verMargem)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Função pura (para uso fora de hooks/componentes e em testes).
 * Retorna `true` SOMENTE para Administrador Geral ou flag explícita.
 */
export function calcularPodeVerMargem(user: UsuarioComPermissoes): boolean {
  if (!user) return false;
  if (extrairFlag(user)) return true;

  const candidatos = [user.role, user.tipo, user.perfil, user.papel]
    .map((v) => String(v ?? "").trim().toLowerCase())
    .filter(Boolean);

  return candidatos.some((c) => ROLES_ADMIN_GERAL.has(c));
}

export interface PermissaoFinanceira {
  /** true apenas para Administrador Geral (ou flag ver_margem). */
  podeVerMargem: boolean;
  /** Alias semântico para leitura no JSX. */
  isAdminGeral: boolean;
  role: UserRole | null;
}

export function usePermissaoFinanceira(): PermissaoFinanceira {
  const { user } = useAuth();
  return useMemo<PermissaoFinanceira>(() => {
    const podeVerMargem = calcularPodeVerMargem(user as UsuarioComPermissoes);
    return {
      podeVerMargem,
      isAdminGeral: podeVerMargem,
      role: user?.role ?? null,
    };
  }, [user]);
}

/**
 * Mantido por compatibilidade com chamadas antigas.
 * @deprecated use `usePermissaoFinanceira().podeVerMargem`.
 */
export function usePodeVerMargem(): boolean {
  return usePermissaoFinanceira().podeVerMargem;
}
