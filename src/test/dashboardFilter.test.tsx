import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { DashboardFilterProvider, useDashboardFilters } from "@/contexts/DashboardFilterContext";
import type { ReactNode } from "react";

const wrapper = ({ children }: { children: ReactNode }) => (
  <DashboardFilterProvider>{children}</DashboardFilterProvider>
);

describe("DashboardFilterContext — Missão 136-A.2", () => {
  it("1 — valor inicial é 'mes' com dataInicio no primeiro dia do mês", () => {
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });
    expect(result.current.filters.periodo).toBe("mes");
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString().split("T")[0];
    expect(result.current.filters.dataInicio).toBe(primeiroDia);
    expect(result.current.filters.dataFim).toBe(hoje.toISOString().split("T")[0]);
  });

  it("2 — setPeriodo('semana') altera dataInicio para 7 dias atrás", () => {
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });
    act(() => { result.current.setPeriodo("semana"); });
    expect(result.current.filters.periodo).toBe("semana");
    const esperado = new Date();
    esperado.setDate(esperado.getDate() - 7);
    expect(result.current.filters.dataInicio).toBe(
      esperado.toISOString().split("T")[0]
    );
  });

  it("3 — setPeriodo('trimestre') altera dataInicio para 3 meses atrás", () => {
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });
    act(() => { result.current.setPeriodo("trimestre"); });
    expect(result.current.filters.periodo).toBe("trimestre");
    const esperado = new Date();
    esperado.setMonth(esperado.getMonth() - 3);
    expect(result.current.filters.dataInicio).toBe(
      esperado.toISOString().split("T")[0]
    );
  });

  it("4 — mesmo período não altera dataFim", () => {
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });
    const fimOriginal = result.current.filters.dataFim;
    act(() => { result.current.setPeriodo("mes"); });
    expect(result.current.filters.dataFim).toBe(fimOriginal);
  });

  it("5 — setClienteId altera filtro de cliente", () => {
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });
    act(() => { result.current.setClienteId("cliente-123"); });
    expect(result.current.filters.clienteId).toBe("cliente-123");
  });

  it("6 — filtros adicionais (prestadorId, veiculoTipo, statusOS) funcionam", () => {
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });
    act(() => { result.current.setPrestadorId("prest-1"); });
    act(() => { result.current.setVeiculoTipo("BAU"); });
    act(() => { result.current.setStatusOS("finalizada"); });
    expect(result.current.filters.prestadorId).toBe("prest-1");
    expect(result.current.filters.veiculoTipo).toBe("BAU");
    expect(result.current.filters.statusOS).toBe("finalizada");
  });

  it("7 — filters reference é estável quando valores não mudam", () => {
    const { result, rerender } = renderHook(
      () => useDashboardFilters(), { wrapper }
    );
    const ref1 = result.current.filters;
    rerender();
    const ref2 = result.current.filters;
    // Sem alterações, o useMemo deve retornar a mesma referência
    expect(ref1).toBe(ref2);
  });
});
