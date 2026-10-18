/**
 * TenantContext — Express Connect Hub / TMS
 * Missao 17 — Multi-Tenant Fase 3: Auth + TenantProvider
 * 
 * Gerencia o tenant (empresa) ativo do usuario.
 * - Carrega tenants do usuario logado via tenant_usuarios
 * - Seleciona automaticamente se tiver apenas 1 tenant
 * - Persiste tenant ativo em localStorage (apenas ID)
 * - Limpa React Query cache ao trocar de empresa
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface Tenant {
  id: string;
  nome: string;
  slug: string;
  plano: string;
  status: string;
  logo_url?: string;
  cor_primaria?: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenants: Tenant[];
  selecionarTenant: (tenantId: string) => void;
  isLoading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  tenants: [],
  selecionarTenant: () => {},
  isLoading: true,
  error: null,
});

const TENANT_STORAGE_KEY = "tms_tenant_id";

export function TenantProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESH_FAILED") {
        carregarTenants();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const carregarTenants = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Verificar usuario logado
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Usuario autenticado: buscar tenants via tenant_usuarios
        const { data: tuData, error: tuError } = await supabase
          .from("tenant_usuarios")
          .select("tenant_id, tenants(*)")
          .eq("user_id", session.user.id)
          .eq("status", "ativo");

        if (tuError) throw tuError;

        if (tuData && tuData.length > 0) {
          const tenantList = tuData.map((t: any) => t.tenants).filter(Boolean) as Tenant[];
          setTenants(tenantList);

          // Restaurar tenant salvo ou selecionar primeiro
          const savedId = localStorage.getItem(TENANT_STORAGE_KEY);
          const savedTenant = savedId ? tenantList.find(t => t.id === savedId) : null;
          
          let selectedTenant: Tenant;
          if (savedTenant) {
            selectedTenant = savedTenant;
          } else {
            selectedTenant = tenantList[0];
            localStorage.setItem(TENANT_STORAGE_KEY, selectedTenant.id);
          }
          setTenant(selectedTenant);

          // Definir contexto do tenant no Supabase para RLS
          try {
            await supabase.rpc("set_tenant_context", { p_tenant_id: selectedTenant.id });
          } catch (e) {
            console.warn("[TenantProvider] set_tenant_context RPC nao disponivel");
          }

          setIsLoading(false);
          return;
        }
      }

      // 2. Sem usuario ou sem tenants: nenhum tenant carregado (R5 fix)
      // Usuario anonimo nao pode receber tenant ativo
    } catch (e: any) {
      console.error("[TenantProvider] Erro ao carregar tenants:", e);
      setError(e.message || "Erro ao carregar empresas");
    } finally {
      setIsLoading(false);
    }
  };

  const selecionarTenant = useCallback(async (tenantId: string) => {
    const novo = tenants.find(t => t.id === tenantId);
    if (novo) {
      setTenant(novo);
      localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
      // Definir contexto do tenant no Supabase para RLS
      try {
        await supabase.rpc("set_tenant_context", { p_tenant_id: tenantId });
      } catch (e) {
        console.warn("[TenantProvider] set_tenant_context RPC nao disponivel");
      }
      // Limpar todo o cache ao trocar de empresa
      queryClient.clear();
    }
  }, [tenants, queryClient]);

  return (
    <TenantContext.Provider value={{ tenant, tenants, selecionarTenant, isLoading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant deve ser usado dentro de TenantProvider");
  return ctx;
}
