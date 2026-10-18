import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// A31C — Lançamento manual de serviço pela Central Financeira.
// Garante que lancarServicoManual escreve SOMENTE em alocacoes_escala
// (fonte única — sem base paralela, sem criar OS falsa) com status "concluida",
// finalizada=true e romaneio em metadata.numeroOC.
// ============================================================================

const insertMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();
const osInsertMock = vi.fn();
let ultimoInsert: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === "ordens_servico") {
        return {
          insert: (payload: Record<string, unknown>[]) => {
            osInsertMock(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "os-nova-1", numero: "OS-202607-654321" },
                  error: null,
                }),
              }),
            };
          },
        };
      }
      if (tabela === "alocacoes_escala") {
        return {
          insert: (payload: Record<string, unknown>[]) => {
            ultimoInsert = payload[0] || null;
            insertMock(payload);
            return { select: selectMock };
          },
        };
      }
      return {};
    },
  },
}));

import { lancarServicoManual } from "@/services/financeiro/centralFinanceiroService";

beforeEach(() => {
  insertMock.mockClear();
  selectMock.mockClear();
  singleMock.mockClear();
  osInsertMock.mockClear();
  ultimoInsert = null;
  selectMock.mockReturnValue({ single: singleMock });
});

describe("A31C — lancarServicoManual", () => {
  it("exige data_escala", async () => {
    const res = await lancarServicoManual({ data_escala: "", tipo_veiculo: "Carreta" });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Data do serviço");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("exige tipo_veiculo", async () => {
    const res = await lancarServicoManual({ data_escala: "2026-07-16", tipo_veiculo: "" });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Tipo de veículo");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("grava em alocacoes_escala com status concluida + finalizada=true e cria a OS interna", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-nova-1" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-07-16",
      tipo_veiculo: "Carreta",
      cliente_id: "cliente-1",
      romaneio: "HML-MANUAL-001",
      origem: "São Paulo/SP",
      destino: "Guarulhos/SP",
      placa: "ABC-1234",
      km_realizados: 120,
      valor_frete: 800,
      valor_repasse: 600,
    });
    expect(res.success).toBe(true);
    expect(res.alocacaoId).toBe("aloc-nova-1");
    expect(osInsertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(ultimoInsert).toMatchObject({
      status: "concluida",
      status_pagamento: "pendente",
      finalizada: true,
      km_realizados: 120,
      valor_frete: 800,
      valor_repasse: 600,
      cliente_id: "cliente-1",
    });
    // A31-J1.7 — alocação vinculada à OS oficial; Romaneio/OC segue em metadata.numeroOC
    expect(ultimoInsert?.ordem_servico_id).toBe("os-nova-1");
    expect(ultimoInsert?.metadata).toEqual({
      numeroOC: "HML-MANUAL-001",
      origem: "central_financeira_manual",
    });
    expect(typeof ultimoInsert?.data_finalizacao).toBe("string");
  });

  it("grava romaneio vazio como metadata.numeroOC null (sem OS falsa)", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-nova-2" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-07-16",
      tipo_veiculo: "VUC",
      romaneio: "   ",
    });
    expect(res.success).toBe(true);
    expect(ultimoInsert?.metadata).toEqual({
      numeroOC: null,
      origem: "central_financeira_manual",
    });
    // sem cliente → sem OS criada, vínculo nulo
    expect(osInsertMock).not.toHaveBeenCalled();
    expect(ultimoInsert?.ordem_servico_id).toBeNull();
  });

  it("propaga erro do banco", async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { message: "RLS violation" } });
    const res = await lancarServicoManual({ data_escala: "2026-07-16", tipo_veiculo: "Truck" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("RLS violation");
  });
});
