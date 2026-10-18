import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// A31-J1.7 — OS Interna oficial no lançamento manual (Financeiro → Central).
// Garante que lancarServicoManual:
//   1. cria EXATAMENTE 1 OS via criarOrdemServico (fluxo oficial existente);
//   2. recebe os_id/os_numero e grava ordem_servico_id na alocação;
//   3. preserva Romaneio/OC do cliente separado (metadata.numeroOC);
//   4. NÃO inventa numeração (usa o número retornado pelo fluxo oficial);
//   5. repassa os valores reais do lançamento para a OS (M66/M80 propagam);
//   6. sem cliente → NÃO cria OS (fluxo romaneio-only preservado).
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
                  data: { id: "os-a31j17-001", numero: "OS-202608-777777" },
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

describe("A31-J1.7 — OS Interna oficial no lançamento manual", () => {
  it("1 lançamento com cliente = 1 OS criada + 1 alocação vinculada", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31j17-1" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-18",
      tipo_veiculo: "Carreta",
      cliente_id: "cliente-a31j17-1",
      romaneio: "343646",
      origem: "São Paulo/SP",
      destino: "Campinas/SP",
      valor_frete: 1200,
      valor_repasse: 900,
    });
    expect(res.success).toBe(true);
    expect(osInsertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(ultimoInsert?.ordem_servico_id).toBe("os-a31j17-001");
    expect(res.osId).toBe("os-a31j17-001");
  });

  it("numero da OS vem do fluxo oficial (criarOrdemServico) — nada inventado no financeiro", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31j17-2" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-18",
      tipo_veiculo: "Truck",
      cliente_id: "cliente-a31j17-2",
      valor_frete: 800,
    });
    expect(res.success).toBe(true);
    // numero retornado pelo fluxo oficial (criarOrdemServico) — nada inventado no financeiro
    expect(res.osNumero).toBe("OS-202608-777777");
    // a própria criarOrdemServico gera a numeração oficial (formato OS-AAAAMM-XXXXXX)
    expect(ultimaOSInsert?.numero).toMatch(/^OS-\d{6}-\d{6}$/);
  });

  it("OS criada com dados reais do lançamento (cliente, origem, destino, data, valor, finalizada)", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31j17-3" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-18",
      tipo_veiculo: "VUC",
      cliente_id: "cliente-a31j17-3",
      origem: "Guarulhos/SP",
      destino: "Osasco/SP",
      valor_frete: 500,
      observacoes: "Entrega refrigerada",
    });
    expect(res.success).toBe(true);
    expect(ultimaOSInsert).toMatchObject({
      cliente: "cliente-a31j17-3",
      cliente_id: "cliente-a31j17-3",
      origem: "Guarulhos/SP",
      destino: "Osasco/SP",
      status: "finalizada",
      data_programada: "2026-08-18",
      valor_cliente: 500,
      observacoes_gerais: "Entrega refrigerada",
    });
  });

  it("Romaneio/OC permanece SEPARADO da OS (metadata.numeroOC) — não vira número da OS", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31j17-4" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-18",
      tipo_veiculo: "Carreta",
      cliente_id: "cliente-a31j17-4",
      romaneio: "343646",
    });
    expect(res.success).toBe(true);
    expect(ultimoInsert?.metadata).toEqual({
      numeroOC: "343646",
      origem: "central_financeira_manual",
    });
    expect(ultimaOSInsert?.numero).toMatch(/^OS-\d{6}-\d{6}$/);
    expect(ultimaOSInsert?.numero).not.toContain("343646");
  });

  it("valores financeiros do lançamento são repassados à OS (M66/M80 propagam sem duplicar)", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31j17-5" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-18",
      tipo_veiculo: "Truck",
      cliente_id: "cliente-a31j17-5",
      valor_frete: 1500,
      valor_repasse: 1100,
      valor_pedagio: 200,
    });
    expect(res.success).toBe(true);
    expect(ultimaOSInsert?.valor_cliente).toBe(1500);
    expect(ultimoInsert?.valor_frete).toBe(1500);
    expect(ultimoInsert?.valor_repasse).toBe(1100);
    expect(ultimoInsert?.valor_pedagio).toBe(200);
  });

  it("sem cliente NÃO cria OS — apenas a alocação romaneio-only", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31j17-6" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-18",
      tipo_veiculo: "VUC",
      romaneio: "343646",
    });
    expect(res.success).toBe(true);
    expect(osInsertMock).not.toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(ultimoInsert?.ordem_servico_id).toBeNull();
  });

  it("falha da criação da OS aborta o lançamento (sem alocação órfã)", async () => {
    // Força criarOrdemServico a falhar (ordens_servico sem insert configurado)
    osInsertMock.mockImplementationOnce(() => {
      throw new Error("RPC falhou");
    });
    singleMock.mockResolvedValueOnce({ data: { id: "aloc-a31j17-7" }, error: null });
    const res = await lancarServicoManual({
      data_escala: "2026-08-18",
      tipo_veiculo: "Carreta",
      cliente_id: "cliente-a31j17-7",
    });
    expect(res.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });
});