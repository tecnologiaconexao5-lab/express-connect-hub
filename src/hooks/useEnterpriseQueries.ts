/**
 * React Query Hooks — Express Connect Hub / TMS
 * Missao 12.3 — Cache Enterprise
 * 
 * Configuracao: staleTime 30s, gcTime 5min
 * Use estes hooks em substituicao a fetch + useState nos componentes
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/contexts/TenantContext";

const STALE_TIME = 30_000;       // 30 segundos — dados frescos
const GC_TIME = 5 * 60_000;      // 5 minutos — cache mantido em memoria

// ============================================================
// DASHBOARD
// ============================================================

export function useDashboardQuery(filtros?: { dataInicio?: string; dataFim?: string }) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id || "default";
  const hoje = new Date().toISOString().split("T")[0];
  const inicio = filtros?.dataInicio || hoje;
  const fim = filtros?.dataFim || hoje;

  return useQuery({
    queryKey: [tenantId, "dashboard", inicio, fim],
    queryFn: async () => {
      const [osRes, recRes, pagRes, cliRes, presRes] = await Promise.all([
        supabase.from("ordens_servico").select("id, status, valor_cliente, custo_prestador, created_at").gte("created_at", inicio).lte("created_at", fim + "T23:59:59").limit(300),
        supabase.from("financeiro_receber").select("valor, status").limit(1000),
        supabase.from("financeiro_pagar").select("valor, status").limit(1000),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("prestadores").select("id, status", { count: "exact" }),
      ]);
      return { osRes, recRes, pagRes, cliRes, presRes };
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ============================================================
// ORDENS DE SERVICO (com paginacao)
// ============================================================

export function useOrdensServicoQuery(page: number, pageSize = 25) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id || "default";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: [tenantId, "ordens_servico", page, pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("ordens_servico")
        .select("*, clientes(nome_fantasia, razao_social)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { data, count: count ?? 0 };
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (prev) => prev, // mantem dados anteriores enquanto carrega nova pagina
  });
}

// ============================================================
// CLIENTES (com paginacao)
// ============================================================

export function useClientesQuery(page: number, pageSize = 25, busca?: string) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id || "default";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: [tenantId, "clientes", page, pageSize, busca],
    queryFn: async () => {
      let query = supabase.from("clientes").select("*", { count: "exact" }).order("razao_social").range(from, to);
      if (busca) query = query.or(`razao_social.ilike.%${busca}%,nome_fantasia.ilike.%${busca}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      return { data, count: count ?? 0 };
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ============================================================
// PRESTADORES (com paginacao)
// ============================================================

export function usePrestadoresQuery(page: number, pageSize = 25) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id || "default";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: [tenantId, "prestadores", page, pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("prestadores")
        .select("*", { count: "exact" })
        .range(from, to);
      if (error) throw error;
      return { data, count: count ?? 0 };
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ============================================================
// VEICULOS (com paginacao)
// ============================================================

export function useVeiculosQuery(page: number, pageSize = 25) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id || "default";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: [tenantId, "veiculos", page, pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("veiculos")
        .select("*", { count: "exact" })
        .order("placa")
        .range(from, to);
      if (error) throw error;
      return { data, count: count ?? 0 };
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ============================================================
// FINANCEIRO RECEBER (com paginacao)
// ============================================================

export function useContasReceberQuery(page: number, pageSize = 25) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id || "default";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: [tenantId, "financeiro_receber", page, pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("financeiro_receber")
        .select("*", { count: "exact" })
        .order("data_vencimento", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return { data, count: count ?? 0 };
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ============================================================
// MUTATIONS — Invalida cache apos alteracoes
// ============================================================

export function useInvalidateCache() {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const tenantId = tenant?.id || "default";

  return {
    invalidateOS: () => {
      queryClient.invalidateQueries({ queryKey: [tenantId, "ordens_servico"] });
      queryClient.invalidateQueries({ queryKey: [tenantId, "dashboard"] });
    },
    invalidateClientes: () => {
      queryClient.invalidateQueries({ queryKey: [tenantId, "clientes"] });
    },
    invalidatePrestadores: () => {
      queryClient.invalidateQueries({ queryKey: [tenantId, "prestadores"] });
    },
    invalidateVeiculos: () => {
      queryClient.invalidateQueries({ queryKey: [tenantId, "veiculos"] });
    },
    invalidateFinanceiro: () => {
      queryClient.invalidateQueries({ queryKey: [tenantId, "financeiro_receber"] });
      queryClient.invalidateQueries({ queryKey: [tenantId, "dashboard"] });
    },
    invalidateAllOperacao: () => {
      queryClient.invalidateQueries({ queryKey: [tenantId, "ordens_servico"] });
      queryClient.invalidateQueries({ queryKey: [tenantId, "dashboard"] });
      queryClient.invalidateQueries({ queryKey: [tenantId, "financeiro_receber"] });
    },
  };
}
