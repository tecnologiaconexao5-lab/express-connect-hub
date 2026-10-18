import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

export type PeriodoFilter = "hoje" | "semana" | "mes" | "trimestre" | "personalizado";

export interface DashboardFilters {
  periodo: PeriodoFilter;
  dataInicio: string;
  dataFim: string;
  clienteId?: string;
  prestadorId?: string;
  veiculoTipo?: string;
  statusOS?: string;
}

interface DashboardFilterContextValue {
  filters: DashboardFilters;
  setPeriodo: (p: PeriodoFilter) => void;
  setClienteId: (id?: string) => void;
  setPrestadorId: (id?: string) => void;
  setVeiculoTipo: (t?: string) => void;
  setStatusOS: (s?: string) => void;
}

const DashboardFilterContext = createContext<DashboardFilterContextValue | null>(null);

function calcularDataRange(periodo: PeriodoFilter): { inicio: string; fim: string } {
  const hoje = new Date();
  const fim = hoje.toISOString().split("T")[0];
  let inicio: Date;

  switch (periodo) {
    case "hoje":
      inicio = hoje;
      break;
    case "semana":
      inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - 7);
      break;
    case "mes":
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      break;
    case "trimestre":
      inicio = new Date(hoje);
      inicio.setMonth(hoje.getMonth() - 3);
      break;
    default:
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  }

  return { inicio: inicio.toISOString().split("T")[0], fim };
}

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [periodo, setPeriodo] = useState<PeriodoFilter>("mes");
  const [clienteId, setClienteId] = useState<string | undefined>();
  const [prestadorId, setPrestadorId] = useState<string | undefined>();
  const [veiculoTipo, setVeiculoTipo] = useState<string | undefined>();
  const [statusOS, setStatusOS] = useState<string | undefined>();

  const filters = useMemo<DashboardFilters>(() => {
    const range = calcularDataRange(periodo);
    return { periodo, dataInicio: range.inicio, dataFim: range.fim, clienteId, prestadorId, veiculoTipo, statusOS };
  }, [periodo, clienteId, prestadorId, veiculoTipo, statusOS]);

  return (
    <DashboardFilterContext.Provider value={{ filters, setPeriodo, setClienteId, setPrestadorId, setVeiculoTipo, setStatusOS }}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilters(): DashboardFilterContextValue {
  const ctx = useContext(DashboardFilterContext);
  if (!ctx) throw new Error("useDashboardFilters must be used within DashboardFilterProvider");
  return ctx;
}
