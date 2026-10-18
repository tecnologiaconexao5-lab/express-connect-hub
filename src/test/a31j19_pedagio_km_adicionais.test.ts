import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// A31-J1.9 — Pedágio, KM excedente e adicionais separados SEM duplicidade,
// após salvar/recarregar. Prova o cenário real da missão pelo caminho completo:
//   lancarServicoManual → alocacoes_escala (persistida) → buscarCentralFinanceiro
// Compara Central = Detalhes = prévia (calcularResumoLancamento) componente a componente.
// Cenário: base 600/520 · franquia 140 · km 159,6 → excedente 19,6 · R$1/km · pedágio 66,43.
// Resultado correto: Cliente 619,60 · Prestador 606,03.
// ============================================================================

const OS_ID = "os-a31j19-001";
const OS_NUMERO = "OS-202608-434343";
const ALOC_ID = "aloc-a31j19-001";

const insertMock = vi.fn();
const osInsertMock = vi.fn();
let ultimoInsert: Record<string, unknown> | null = null;

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
import { calcularResumoLancamento } from "@/services/financeiro/centralFinanceiroVisao";

function resetStore() {
  for (const k of Object.keys(store)) store[k] = [];
}

// Monta a alocação persistida (o que o banco retornaria após salvar/recarregar).
function alocacaoPersistida(extra: Record<string, unknown> = {}) {
  return {
    id: ALOC_ID,
    status: "concluida",
    finalizada: true,
    data_escala: "2026-08-18",
    data_finalizacao: "2026-08-18T10:00:00.000Z",
    ordem_servico_id: OS_ID,
    ordens_servico: { id: OS_ID, numero: OS_NUMERO, romaneio: null },
    clientes: { nome_fantasia: "Cliente E2E A31J19" },
    prestadores: { nome_completo: "Prestador E2E A31J19" },
    cliente_id: "cliente-a31j19-1",
    prestador_id: "prestador-a31j19-1",
    tipo_veiculo: "Carreta",
    placa: "E2E-0001",
    origem: "São Paulo/SP",
    destino: "Campinas/SP",
    valor_frete: 600,
    valor_repasse: 520,
    valor_pedagio: 66.43,
    valor_combustivel: 0,
    valor_ajudante: 0,
    diarias_adicionais: 0,
    valor_diaria: 0,
    valor_segunda_saida: 0,
    valor_terceira_saida: 0,
    valor_saida_adicional: 0,
    valor_reembolso_outros: 0,
    valor_adicional: 0,
    valor_desconto: 0,
    km_realizados: 159.6,
    pedagio_cobrar_excedente: false,
    metadata: {
      numeroOC: "HML-A31J19-E2E",
      origem: "central_financeira_manual",
      faturamento: { franquia_km: 140, valor_km_excedente: 1 },
      repasse: { franquia_km_prestador: 140, valor_km_prestador: 1 },
    },
    ...extra,
  };
}

const previsaEsperada = calcularResumoLancamento({
  valor_frete: "600",
  valor_repasse: "520",
  valor_pedagio: "66.43",
  km_realizados: "159.6",
  tabela_km: { franquiaCliente: 140, valorKmExcCliente: 1, franquiaPrestador: 140, valorKmPrestador: 1 },
});

beforeEach(() => {
  insertMock.mockClear();
  osInsertMock.mockClear();
  ultimoInsert = null;
  resetStore();
});

describe("A31-J1.9 — Pedágio/KM/adicionais separados sem duplicidade (save → reload → Central = prévia)", () => {
  it("1+2. pedágio prestador NÃO duplica e NÃO vira 'Outros adicionais' do cliente", async () => {
    store.alocacoes_escala = [alocacaoPersistida()];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J19-E2E" });

    // pedágio contado 1x na perna prestador (66,43) — NÃO 132,86
    expect(item.detalhe.pedagioPrestador).toBeCloseTo(66.43, 5);
    expect(item.valorPrestadorAdicionais).toBeCloseTo(66.43, 5);
    expect(item.detalhe.reembolsoOutrosPrestador).toBe(0);
    expect(item.detalhe.outrosPrestador).toBe(0);
    // pedágio NÃO entra em "Outros adicionais" do cliente (flag desligada)
    expect(item.detalhe.pedagioCliente).toBe(0);
    expect(item.detalhe.outrosCliente).toBe(0);
  });

  it("3. pedágio cliente e prestador independentes (flag oficial) — cobrança ao cliente não altera o prestador", async () => {
    store.alocacoes_escala = [alocacaoPersistida({ pedagio_cobrar_excedente: true })];
    const [comCobranca] = await buscarCentralFinanceiro({ busca: "HML-A31J19-E2E" });
    expect(comCobranca.detalhe.pedagioCliente).toBeCloseTo(66.43, 5);
    expect(comCobranca.valorClienteTotal).toBeCloseTo(600 + 19.6 + 66.43, 5); // 686.03
    expect(comCobranca.valorPrestadorTotal).toBeCloseTo(606.03, 5); // inalterado

    store.alocacoes_escala = [alocacaoPersistida({ pedagio_cobrar_excedente: false })];
    const [semCobranca] = await buscarCentralFinanceiro({ busca: "HML-A31J19-E2E" });
    expect(semCobranca.detalhe.pedagioCliente).toBe(0);
    expect(semCobranca.valorClienteTotal).toBeCloseTo(619.6, 5);
    expect(semCobranca.valorPrestadorTotal).toBeCloseTo(606.03, 5);
  });

  it("4+5. KM excedente cliente e prestador reconstroem da persistência (franquias R$1,00 por perna)", async () => {
    store.alocacoes_escala = [alocacaoPersistida()];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J19-E2E" });
    expect(item.detalhe.valorKmExcedenteCliente).toBeCloseTo(19.6, 5);
    expect(item.detalhe.valorKmExcedentePrestador).toBeCloseTo(19.6, 5);
    // persiste/recarrega com franquias iguais no cenário; pernas diferentes são respeitadas (a31j16)
    expect(previsaEsperada.totalExcedenteCliente).toBeCloseTo(19.6, 5);
    expect(previsaEsperada.totalExcedentePrestador).toBeCloseTo(19.6, 5);
  });

  it("6+7. totais corretos do cenário real: Cliente 619,60 · Prestador 606,03", async () => {
    store.alocacoes_escala = [alocacaoPersistida()];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J19-E2E" });
    expect(item.valorClienteTotal).toBeCloseTo(619.6, 5); // 600 + 19,6 (pedágio cliente 0)
    expect(item.valorPrestadorTotal).toBeCloseTo(606.03, 5); // 520 + 19,6 + 66,43
  });

  it("8. Central = Detalhes = prévia (componente a componente, não só total)", async () => {
    store.alocacoes_escala = [alocacaoPersistida()];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J19-E2E" });

    // Base
    expect(item.valorClienteBase).toBeCloseTo(previsaEsperada.valorClienteBase, 5); // 600
    expect(item.valorPrestadorBase).toBeCloseTo(520, 5);
    // KM excedente
    expect(item.detalhe.valorKmExcedenteCliente).toBeCloseTo(previsaEsperada.totalExcedenteCliente, 5);
    expect(item.detalhe.valorKmExcedentePrestador).toBeCloseTo(previsaEsperada.totalExcedentePrestador, 5);
    // Pedágio
    expect(item.detalhe.pedagioCliente).toBeCloseTo(previsaEsperada.pedagioCliente, 5);
    expect(item.detalhe.pedagioPrestador).toBeCloseTo(66.43, 5);
    // Outros
    expect(item.detalhe.outrosCliente).toBeCloseTo(previsaEsperada.outrosCliente, 5);
    expect(item.detalhe.outrosPrestador).toBe(0);
    // Totais
    expect(item.valorClienteTotal).toBeCloseTo(previsaEsperada.valorClienteTotal, 5);
    expect(item.valorPrestadorTotal).toBeCloseTo(previsaEsperada.valorPrestadorTotal, 5);
  });

  it("regressão do bug observado: pedágio também lançado em 'Outros adicionais' NÃO duplica no prestador", async () => {
    // Dado histórico que causava 132,86 (66,43 pedágio + 66,43 "outros" na perna prestador)
    store.alocacoes_escala = [alocacaoPersistida({ valor_adicional: 66.43 })];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J19-E2E" });

    // A correção: valor_adicional ("outros cobrados") fica na perna CLIENTE e
    // NÃO alimenta a perna prestador → prestador recebe somente o pedágio (66,43).
    expect(item.valorPrestadorAdicionais).toBeCloseTo(66.43, 5); // não 132,86
    expect(item.valorPrestadorTotal).toBeCloseTo(520 + 19.6 + 66.43, 5); // 606.03
    expect(item.detalhe.outrosCliente).toBeCloseTo(66.43, 5); // cliente "outros" informado
  });

  it("lançamento manual persiste pedágio 1x + franquias/KM no metadata (fonte de reconstrução)", async () => {
    const res = await lancarServicoManual({
      data_escala: "2026-08-18",
      tipo_veiculo: "Carreta",
      cliente_id: "cliente-a31j19-1",
      prestador_id: "prestador-a31j19-1",
      romaneio: "HML-A31J19-E2E",
      km_realizados: 159.6,
      valor_frete: 600,
      valor_repasse: 520,
      valor_pedagio: 66.43,
      franquia_km_cliente: 140,
      valor_km_excedente_cliente: 1,
      franquia_km_prestador: 140,
      valor_km_prestador: 1,
      pedagio_cobrar_excedente: false,
    });
    expect(res.success).toBe(true);
    expect(ultimoInsert?.valor_pedagio).toBe(66.43);
    expect(ultimoInsert?.valor_reembolso_outros).toBe(0);
    expect(ultimoInsert?.valor_adicional).toBe(0);
    expect(ultimoInsert?.metadata).toMatchObject({
      faturamento: { franquia_km: 140, valor_km_excedente: 1 },
      repasse: { franquia_km_prestador: 140, valor_km_prestador: 1 },
    });
    expect(osInsertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
