import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// A31B — Complementação manual via Central Financeira.
// Garante que salvarComplementoFinanceiroAlocacao escreve SOMENTE em
// alocacoes_escala (mesma fonte da Escala) e que a whitelist de colunas
// oficiais é respeitada (sem base paralela).
// ============================================================================

const calls: { coluna: string; valor: unknown }[] = [];
const updateMock = vi.fn();
const eqMock = vi.fn(() => Promise.resolve({ error: null }));
const selectMock = vi.fn();
const selectEqMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === "alocacoes_escala") {
        return {
          update: (payload: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(payload)) {
              if (k !== "updated_at") calls.push({ coluna: k, valor: v });
            }
            updateMock(payload);
            return { eq: eqMock };
          },
          select: selectMock,
        };
      }
      return {};
    },
  },
}));

import {
  salvarComplementoFinanceiroAlocacao,
  buscarCamposFinanceirosAlocacao,
} from "@/services/financeiro/centralFinanceiroService";

beforeEach(() => {
  calls.length = 0;
  updateMock.mockClear();
  eqMock.mockClear();
  selectMock.mockClear();
  selectEqMock.mockClear();
  maybeSingleMock.mockClear();
  selectMock.mockReturnValue({ eq: selectEqMock });
  selectEqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
});

describe("A31B — salvarComplementoFinanceiroAlocacao", () => {
  it("grava campos oficiais em alocacoes_escala", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    const res = await salvarComplementoFinanceiroAlocacao("aloc-1", {
      km_realizados: 120,
      valor_frete: 800,
      valor_pedagio: 45.5,
      valor_desconto: 10,
    });
    expect(res.success).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      { coluna: "km_realizados", valor: 120 },
      { coluna: "valor_frete", valor: 800 },
      { coluna: "valor_pedagio", valor: 45.5 },
      { coluna: "valor_desconto", valor: 10 },
    ]);
  });

  it("ignora chaves fora da whitelist (sem base paralela)", async () => {
    eqMock.mockResolvedValueOnce({ error: null });
    const res = await salvarComplementoFinanceiroAlocacao("aloc-2", {
      km_realizados: 50,
      // @ts-expect-error chave não oficial intencionalmente
      tabela_paralela: 999,
    });
    expect(res.success).toBe(true);
    expect(calls).toEqual([{ coluna: "km_realizados", valor: 50 }]);
  });

  it("falha sem alocação", async () => {
    const res = await salvarComplementoFinanceiroAlocacao("", { km_realizados: 1 });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Alocação não informada");
  });

  it("falha sem nenhum campo válido", async () => {
    const res = await salvarComplementoFinanceiroAlocacao("aloc-3", {});
    expect(res.success).toBe(false);
    expect(res.error).toContain("Nenhum campo");
  });

  it("propaga erro do banco", async () => {
    eqMock.mockResolvedValueOnce({ error: { message: "permission denied" } });
    const res = await salvarComplementoFinanceiroAlocacao("aloc-4", { km_realizados: 10 });
    expect(res.success).toBe(false);
    expect(res.error).toBe("permission denied");
  });
});

describe("A31B — buscarCamposFinanceirosAlocacao", () => {
  it("retorna null sem alocação", async () => {
    const r = await buscarCamposFinanceirosAlocacao("");
    expect(r).toBeNull();
  });

  it("retorna campos selecionados da alocação", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { km_realizados: 120, valor_frete: 800 },
      error: null,
    });
    const r = await buscarCamposFinanceirosAlocacao("aloc-5");
    expect(r).toEqual({ km_realizados: 120, valor_frete: 800 });
  });

  it("retorna null em erro", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    const r = await buscarCamposFinanceirosAlocacao("aloc-6");
    expect(r).toBeNull();
  });
});