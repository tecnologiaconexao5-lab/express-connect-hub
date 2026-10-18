import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// A31E — Lançamento manual premium na Central Financeira.
// Garante que lancarServicoManual grava prestador_id/cliente_id REAIS em
// alocacoes_escala (mesma fonte da Escala), NUNCA cria base paralela e que o
// veículo/placa do prestador são preenchidos a partir do cadastro oficial.
// ============================================================================

const insertMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();
const osInsertMock = vi.fn();
let ultimoInsert: Record<string, unknown> | null = null;
let ultimaOSInsert: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === "ordens_servico") {
        return {
          insert: (payload: Record<string, unknown>[]) => {
            ultimaOSInsert = payload[0] || null;
            osInsertMock(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "os-real-001", numero: "OS-202608-123456" },
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
  ultimaOSInsert = null;
  selectMock.mockReturnValue({ single: singleMock });
});

describe("A31E — lancarServicoManual premium", () => {
  it("grava prestador_id real do cadastro oficial e cria a OS interna vinculada", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31e-1" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-16",
      tipo_veiculo: "Carreta",
      prestador_id: "prestador-real-001",
      cliente_id: "cliente-real-001",
      romaneio: "HML-A31E-001",
      valor_frete: 950,
      valor_repasse: 700,
    });
    expect(res.success).toBe(true);
    expect(ultimoInsert?.prestador_id).toBe("prestador-real-001");
    expect(ultimoInsert?.cliente_id).toBe("cliente-real-001");
    // A31-J1.7 — alocação vinculada à OS oficial criada via criarOrdemServico
    expect(osInsertMock).toHaveBeenCalledTimes(1);
    expect(ultimoInsert?.ordem_servico_id).toBe("os-real-001");
    expect(res.osId).toBe("os-real-001");
    expect(res.osNumero).toBe("OS-202608-123456");
  });

  it("grava veículo/placa do prestador quando selecionado", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31e-2" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-16",
      tipo_veiculo: "Carreta",
      placa: "XYZ-9876",
      prestador_id: "prestador-real-002",
    });
    expect(res.success).toBe(true);
    expect(ultimoInsert?.tipo_veiculo).toBe("Carreta");
    expect(ultimoInsert?.placa).toBe("XYZ-9876");
  });

  it("grava reembolso/combustível/outros na perna prestador", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31e-3" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-16",
      tipo_veiculo: "Truck",
      prestador_id: "prestador-real-003",
      valor_pedagio: 120,
      valor_combustivel: 450,
      valor_reembolso_outros: 80,
      valor_ajudante: 150,
    });
    expect(res.success).toBe(true);
    expect(ultimoInsert?.valor_pedagio).toBe(120);
    expect(ultimoInsert?.valor_combustivel).toBe(450);
    expect(ultimoInsert?.valor_reembolso_outros).toBe(80);
    expect(ultimoInsert?.valor_ajudante).toBe(150);
  });

  it("com cliente cria 1 OS + 1 alocação — sem base paralela", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31e-4" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-16",
      tipo_veiculo: "VUC",
      prestador_id: "prestador-real-004",
      cliente_id: "cliente-real-004",
      romaneio: "HML-A31E-004",
    });
    expect(res.success).toBe(true);
    // exatamente 1 OS e 1 alocação — sem segunda tabela paralela
    expect(osInsertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(ultimaOSInsert?.cliente).toBe("cliente-real-004");
    expect(ultimaOSInsert?.status).toBe("finalizada");
    expect(ultimoInsert?.ordem_servico_id).toBe("os-real-001");
    // Romaneio/OC permanece separado (metadata.numeroOC), NÃO vira número da OS
    expect(ultimoInsert?.metadata).toEqual({
      numeroOC: "HML-A31E-004",
      origem: "central_financeira_manual",
    });
  });

  it("sem cliente NÃO cria OS — mantém fluxo romaneio-only", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31e-4b" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-16",
      tipo_veiculo: "VUC",
      romaneio: "HML-A31E-004B",
    });
    expect(res.success).toBe(true);
    expect(osInsertMock).not.toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(ultimoInsert?.ordem_servico_id).toBeNull();
    expect(ultimoInsert?.metadata).toEqual({
      numeroOC: "HML-A31E-004B",
      origem: "central_financeira_manual",
    });
  });

  it("mantem validacoes obrigatorias (data e tipo de veiculo)", async () => {
    const semData = await lancarServicoManual({ data_escala: "", tipo_veiculo: "Carreta" });
    expect(semData.success).toBe(false);
    expect(semData.error).toContain("Data do serviço");
    const semVeiculo = await lancarServicoManual({ data_escala: "2026-08-16", tipo_veiculo: "" });
    expect(semVeiculo.success).toBe(false);
    expect(semVeiculo.error).toContain("Tipo de veículo");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("permite lançar SEM prestador_id (prestador pode ser vinculado depois na Escala)", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31e-5" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-16",
      tipo_veiculo: "Carreta",
      cliente_id: "cliente-real-005",
    });
    expect(res.success).toBe(true);
    expect(ultimoInsert?.prestador_id).toBeNull();
    expect(ultimoInsert?.cliente_id).toBe("cliente-real-005");
    expect(ultimoInsert?.ordem_servico_id).toBe("os-real-001");
  });
});