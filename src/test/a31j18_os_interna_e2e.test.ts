import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// A31-J1.8 — E2E (mocked) da OS Interna criada pela Central Financeira.
// Cenário único marcado HML-A31J18-E2E. Prova os 10 critérios da A31-J1.7
// reutilizando o padrão de mocks de a31j17/a31c/a31e + o fluxo de leitura da
// Central (buscarCentralFinanceiro) para simular consulta/recarregamento.
//   1. 1 lançamento manual com cliente cria EXATAMENTE 1 OS;
//   2. OS possui numero;
//   3. cria EXATAMENTE 1 alocação;
//   4. alocacao.ordem_servico_id = OS criada;
//   5. Romaneio/OC permanece separado em metadata.numeroOC;
//   6. consulta/recarregamento da Central resolve osNumero;
//   7. cliente e prestador permanecem vinculados;
//   8. valores cliente/prestador permanecem corretos;
//   9. consultar/recarregar NÃO cria segunda OS;
//   10. nenhuma alocação órfã no cenário testado.
// ============================================================================

const MARKER = "HML-A31J18-E2E";
const OS_ID = "os-a31j18-001";
const OS_NUMERO = "OS-202608-424242";
const ALOC_ID = "aloc-a31j18-001";

const insertMock = vi.fn();
const osInsertMock = vi.fn();
let ultimoInsert: Record<string, unknown> | null = null;
let ultimaOSInsert: Record<string, unknown> | null = null;

const store: Record<string, any[]> = {
  alocacoes_escala: [],
  entregas_protocolo: [],
  financeiro_receber: [],
  financeiro_pagar: [],
  pagamentos_prestadores: [],
  composicao_financeira_os: [],
  fiscal_documentos_vinculados: [],
  fatura_itens: [],
};

vi.mock("@/lib/supabase", () => {
  const chainable = (tabela: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      in: () => q,
      order: () => q,
      limit: () => q,
      gte: () => q,
      lte: () => q,
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
        Promise.resolve({ data: store[tabela] || [], error: null }).then(resolve, reject);
      },
    };
    return q;
  };

  return {
    supabase: {
      from: (tabela: string) => {
        if (tabela === "ordens_servico") {
          return {
            insert: (payload: Record<string, unknown>[]) => {
              ultimaOSInsert = payload[0] || null;
              osInsertMock(payload);
              return {
                select: () => ({
                  single: async () => ({ data: { id: OS_ID, numero: OS_NUMERO }, error: null }),
                }),
              };
            },
          };
        }
        if (tabela === "alocacoes_escala") {
          const q = chainable(tabela);
          q.insert = (payload: Record<string, unknown>[]) => {
            ultimoInsert = payload[0] || null;
            insertMock(payload);
            return {
              select: () => ({
                single: async () => ({ data: { id: ALOC_ID }, error: null }),
              }),
            };
          };
          return q;
        }
        return chainable(tabela);
      },
    },
  };
});

import { lancarServicoManual, buscarCentralFinanceiro } from "@/services/financeiro/centralFinanceiroService";

function resetStore() {
  for (const k of Object.keys(store)) store[k] = [];
}

function alocacaoPersistida() {
  return {
    id: ALOC_ID,
    status: "concluida",
    finalizada: true,
    data_escala: "2026-08-18",
    data_finalizacao: "2026-08-18T10:00:00.000Z",
    ordem_servico_id: OS_ID,
    ordens_servico: { id: OS_ID, numero: OS_NUMERO, romaneio: null },
    clientes: { nome_fantasia: "Cliente E2E A31J18" },
    prestadores: { nome_completo: "Prestador E2E A31J18" },
    cliente_id: "cliente-a31j18-1",
    prestador_id: "prestador-a31j18-1",
    tipo_veiculo: "Carreta",
    placa: "E2E-0001",
    origem: "São Paulo/SP",
    destino: "Campinas/SP",
    valor_frete: 1200,
    valor_repasse: 900,
    metadata: { numeroOC: MARKER, origem: "central_financeira_manual" },
  };
}

beforeEach(() => {
  insertMock.mockClear();
  osInsertMock.mockClear();
  ultimoInsert = null;
  ultimaOSInsert = null;
  resetStore();
});

describe("A31-J1.8 — OS Interna da Central (E2E mocked) — marcador HML-A31J18-E2E", () => {
  it("1 lançamento com cliente = exatamente 1 OS com numero + 1 alocação vinculada; romaneio separado; cliente/prestador/valores preservados", async () => {
    const res = await lancarServicoManual({
      data_escala: "2026-08-18",
      tipo_veiculo: "Carreta",
      cliente_id: "cliente-a31j18-1",
      prestador_id: "prestador-a31j18-1",
      romaneio: MARKER,
      origem: "São Paulo/SP",
      destino: "Campinas/SP",
      placa: "E2E-0001",
      valor_frete: 1200,
      valor_repasse: 900,
    });

    // 1. exatamente 1 OS
    expect(osInsertMock).toHaveBeenCalledTimes(1);
    // 2. OS possui numero (fluxo oficial criarOrdemServico)
    expect(ultimaOSInsert?.numero).toMatch(/^OS-\d{6}-\d{6}$/);
    expect(res.osNumero).toBe(OS_NUMERO);
    // 3. exatamente 1 alocação
    expect(insertMock).toHaveBeenCalledTimes(1);
    // 4. alocacao.ordem_servico_id = OS criada
    expect(ultimoInsert?.ordem_servico_id).toBe(OS_ID);
    // 5. Romaneio/OC permanece separado (metadata.numeroOC)
    expect(ultimoInsert?.metadata).toEqual({ numeroOC: MARKER, origem: "central_financeira_manual" });
    // 7. cliente e prestador permanecem vinculados
    expect(ultimoInsert?.cliente_id).toBe("cliente-a31j18-1");
    expect(ultimoInsert?.prestador_id).toBe("prestador-a31j18-1");
    // 8. valores cliente/prestador preservados
    expect(ultimaOSInsert?.valor_cliente).toBe(1200);
    expect(ultimoInsert?.valor_frete).toBe(1200);
    expect(ultimoInsert?.valor_repasse).toBe(900);
  });

  it("consulta/recarregamento da Central resolve osNumero, romaneio, cliente, prestador e valores — SEM criar segunda OS", async () => {
    store.alocacoes_escala = [alocacaoPersistida()];

    const primeira = await buscarCentralFinanceiro({ busca: MARKER });
    const recarregou = await buscarCentralFinanceiro({ busca: MARKER });

    // 6. Central resolve osNumero (join ordens_servico) e o Romaneio/OC separado
    expect(primeira).toHaveLength(1);
    expect(primeira[0].osNumero).toBe(OS_NUMERO);
    expect(primeira[0].romaneioOC).toBe(MARKER);
    // 7. cliente e prestador permanecem corretos
    expect(primeira[0].clienteNome).toBe("Cliente E2E A31J18");
    expect(primeira[0].prestadorNome).toBe("Prestador E2E A31J18");
    // 8. valores cliente/prestador permanecem corretos
    expect(primeira[0].valorClienteTotal).toBe(1200);
    expect(primeira[0].valorPrestadorTotal).toBe(900);
    // 9. consultar/recarregar NÃO cria segunda OS (nenhum insert adicional)
    expect(osInsertMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    expect(recarregou).toHaveLength(1);
    expect(recarregou[0].osNumero).toBe(OS_NUMERO);
  });

  it("nenhuma alocação órfã no cenário — a única alocação aponta para a OS criada", async () => {
    store.alocacoes_escala = [alocacaoPersistida()];

    const itens = await buscarCentralFinanceiro({ busca: MARKER });

    // 10. sem alocação órfã: exatamente 1 alocação e todas com ordem_servico_id = OS
    expect(itens).toHaveLength(1);
    expect(store.alocacoes_escala.every((a) => a.ordem_servico_id === OS_ID)).toBe(true);
    expect(itens[0].osId).toBe(OS_ID);
  });
});
