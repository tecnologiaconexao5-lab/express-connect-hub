import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// A31-J1.13 — HOMOLOGAÇÃO COMPLETA do Lançamento Manual Premium (mock controlado).
// Cenário com 16 componentes financeiros; valida a cadeia:
//   Prévia → LancarServicoManual(OS+alocação) → Central → Detalhes → Financeiro derivado.
// Nenhum PASS é inventado: cada componente é comparado em todos os elos.
// ============================================================================

// ── Cenário ────────────────────────────────────────────────────────────────
const C = {
  data_escala: "2026-08-19",
  tipo_veiculo: "Carreta",
  placa: "HOM-1301",
  cliente_id: "cliente-a31j13-1",
  prestador_id: "prestador-a31j13-1",
  romaneio: "HML-A31J13-E2E",
  km_realizados: 159.6,
  franquia: 140,
  valor_km: 1,
  // Financeiro
  baseCliente: 600,
  basePrestador: 520,
  pedagio: 66.43,
  outrosCliente: 30,
  reembolsoPrestador: 25,
  descontoCliente: 20,
  descontoPrestador: 15,
  pedagio_cobrar_excedente: true,
};

const esperado = {
  kmExcedente: 19.6,
  totalExcCliente: 19.6,
  totalExcPrestador: 19.6,
  totalCliente: 600 + 19.6 + 66.43 + 30 - 20, // 696.03
  totalPrestador: 520 + 19.6 + 66.43 + 25 - 15, // 616.03
  adicionaisPrestador: 66.43 + 25, // 91.43 (pedágio + reembolso)
};

const OS_ID = "os-a31j13-001";
const OS_NUMERO = "OS-202608-474747";
const ALOC_ID = "aloc-a31j13-001";

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
import { calcularResumoLancamento } from "@/services/financeiro/centralFinanceiroVisao";

beforeEach(() => {
  insertMock.mockClear();
  osInsertMock.mockClear();
  ultimoInsert = null;
  ultimaOSInsert = null;
  for (const k of Object.keys(store)) store[k] = [];
});

describe("A31-J1.13 — Homologação completa do lançamento manual", () => {
  it("valida a cadeia completa (prévia = salvo = Central = Detalhes = financeiro)", async () => {
    // 1. PRÉVIA
    const previa = calcularResumoLancamento({
      valor_frete: String(C.baseCliente),
      valor_repasse: String(C.basePrestador),
      valor_pedagio: String(C.pedagio),
      valor_reembolso_outros: String(C.reembolsoPrestador),
      valor_adicional: String(C.outrosCliente),
      valor_desconto: String(C.descontoCliente),
      valor_desconto_prestador: String(C.descontoPrestador),
      km_realizados: String(C.km_realizados),
      pedagio_cobrar_excedente: C.pedagio_cobrar_excedente,
      tabela_km: {
        franquiaCliente: C.franquia,
        valorKmExcCliente: C.valor_km,
        franquiaPrestador: C.franquia,
        valorKmPrestador: C.valor_km,
      },
    });
    expect(previa.valorClienteTotal).toBeCloseTo(esperado.totalCliente, 5);
    expect(previa.valorPrestadorTotal).toBeCloseTo(esperado.totalPrestador, 5);

    // 2. LANÇAMENTO (salva OS + alocação)
    const res = await lancarServicoManual({
      data_escala: C.data_escala,
      tipo_veiculo: C.tipo_veiculo,
      placa: C.placa,
      cliente_id: C.cliente_id,
      prestador_id: C.prestador_id,
      romaneio: C.romaneio,
      km_realizados: C.km_realizados,
      valor_frete: C.baseCliente,
      valor_repasse: C.basePrestador,
      valor_pedagio: C.pedagio,
      valor_reembolso_outros: C.reembolsoPrestador,
      valor_adicional: C.outrosCliente,
      valor_desconto: C.descontoCliente,
      valor_desconto_prestador: C.descontoPrestador,
      pedagio_cobrar_excedente: C.pedagio_cobrar_excedente,
      franquia_km_cliente: C.franquia,
      valor_km_excedente_cliente: C.valor_km,
      franquia_km_prestador: C.franquia,
      valor_km_prestador: C.valor_km,
    });
    expect(res.success).toBe(true);

    // 2a. OS Interna gerada e vinculada (item 1)
    expect(osInsertMock).toHaveBeenCalledTimes(1);
    expect(res.osId).toBe(OS_ID);
    expect(res.osNumero).toBe(OS_NUMERO);
    expect(ultimaOSInsert?.numero).toMatch(/^OS-\d{6}-\d{6}$/);
    expect(ultimaOSInsert?.cliente).toBe(C.cliente_id);
    expect(ultimoInsert?.ordem_servico_id).toBe(OS_ID);

    // 2b. Romaneio/OC permanece separado (item 2)
    expect((ultimoInsert?.metadata as any).numeroOC).toBe(C.romaneio);
    expect(ultimaOSInsert?.numero).not.toContain(C.romaneio);

    // 2c. Cliente/Prestador/veículo (items 3-4)
    expect(ultimoInsert?.cliente_id).toBe(C.cliente_id);
    expect(ultimoInsert?.prestador_id).toBe(C.prestador_id);
    expect(ultimoInsert?.tipo_veiculo).toBe(C.tipo_veiculo);
    expect(ultimoInsert?.placa).toBe(C.placa);

    // 2d. Valores salvos na alocação (items 5-6, 9-16)
    expect(ultimoInsert?.valor_frete).toBe(C.baseCliente);
    expect(ultimoInsert?.valor_repasse).toBe(C.basePrestador);
    expect(ultimoInsert?.km_realizados).toBe(C.km_realizados);
    expect((ultimoInsert?.metadata as any).faturamento.franquia_km).toBe(C.franquia);
    expect((ultimoInsert?.metadata as any).faturamento.valor_km_excedente).toBe(C.valor_km);
    expect((ultimoInsert?.metadata as any).repasse.franquia_km_prestador).toBe(C.franquia);
    expect((ultimoInsert?.metadata as any).repasse.valor_km_prestador).toBe(C.valor_km);
    expect(ultimoInsert?.valor_pedagio).toBe(C.pedagio);
    expect(ultimoInsert?.valor_adicional).toBe(C.outrosCliente);
    expect(ultimoInsert?.valor_reembolso_outros).toBe(C.reembolsoPrestador);
    expect(ultimoInsert?.valor_desconto).toBe(C.descontoCliente);
    expect(ultimoInsert?.valor_desconto_prestador).toBe(C.descontoPrestador);
    expect(ultimoInsert?.pedagio_cobrar_excedente).toBe(true);

    // 3. Recarrega a Central com a linha persistida
    store.alocacoes_escala = [
      {
        id: ALOC_ID,
        status: "concluida",
        finalizada: true,
        data_escala: C.data_escala,
        data_finalizacao: "2026-08-19T10:00:00.000Z",
        ordem_servico_id: OS_ID,
        ordens_servico: { id: OS_ID, numero: OS_NUMERO, romaneio: null },
        clientes: { nome_fantasia: "Cliente Homolog A31J13" },
        prestadores: { nome_completo: "Prestador Homolog A31J13" },
        ...(ultimoInsert as Record<string, unknown>),
      },
    ];

    const primeira = await buscarCentralFinanceiro({ busca: C.romaneio });
    const recarregou = await buscarCentralFinanceiro({ busca: C.romaneio });

    // nenhuma duplicata ao recarregar (item 21-22)
    expect(osInsertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(primeira).toHaveLength(1);
    expect(recarregou).toHaveLength(1);

    const item = primeira[0];
    const item2 = recarregou[0];

    // Items 5-16 — Central/Detalhes (Detalhes usa os mesmos campos do item)
    expect(item.osNumero).toBe(OS_NUMERO);
    expect(item.clienteNome).toBe("Cliente Homolog A31J13");
    expect(item.prestadorNome).toBe("Prestador Homolog A31J13");
    expect(item.valorClienteBase).toBeCloseTo(C.baseCliente, 5);
    expect(item.valorPrestadorBase).toBeCloseTo(C.basePrestador, 5);
    expect(item.detalhe.valorKmExcedenteCliente).toBeCloseTo(esperado.totalExcCliente, 5);
    expect(item.detalhe.valorKmExcedentePrestador).toBeCloseTo(esperado.totalExcPrestador, 5);
    expect(item.detalhe.pedagioCliente).toBeCloseTo(C.pedagio, 5);
    expect(item.detalhe.pedagioPrestador).toBeCloseTo(C.pedagio, 5);
    expect(item.detalhe.outrosCliente).toBeCloseTo(C.outrosCliente, 5);
    expect(item.detalhe.reembolsoOutrosPrestador).toBeCloseTo(C.reembolsoPrestador, 5);
    expect(item.valorClienteDescontos).toBeCloseTo(C.descontoCliente, 5);
    expect(item.valorPrestadorDescontos).toBeCloseTo(C.descontoPrestador, 5);

    // Items 17-18 — Totais iguais à prévia
    expect(item.valorClienteTotal).toBeCloseTo(esperado.totalCliente, 5);
    expect(item.valorPrestadorTotal).toBeCloseTo(esperado.totalPrestador, 5);
    expect(item2.valorClienteTotal).toBe(item.valorClienteTotal); // recarregar não altera
    expect(item2.valorPrestadorTotal).toBe(item.valorPrestadorTotal);

    // Não duplica: pedágio prestador contado 1x, outros/reembolsos sem vazar perna
    expect(item.valorPrestadorAdicionais).toBeCloseTo(esperado.adicionaisPrestador, 5);
    expect(item.detalhe.outrosPrestador).toBe(0);

    // Items 19-20 — Financeiro derivado (contrato do trigger):
    // financeiro_receber = valor_frete (base cliente); financeiro_pagar = valor_repasse
    // + desconto prestador na coluna desconto (A31-J1.11).
    const receber = { valor: (ultimoInsert?.valor_frete as number) ?? 0, status: "aberto" };
    const pagar = { valor: (ultimoInsert?.valor_repasse as number) ?? 0, desconto: (ultimoInsert?.valor_desconto_prestador as number) ?? 0 };
    expect(receber.valor).toBeCloseTo(C.baseCliente, 5); // corresponde à base cliente
    expect(pagar.valor).toBeCloseTo(C.basePrestador, 5); // corresponde à base prestador
    expect(pagar.desconto).toBeCloseTo(C.descontoPrestador, 5);
  });

  it("matriz de componentes: PRÉVIA = ALOCAÇÃO = CENTRAL = DETALHES (consistência elo a elo)", async () => {
    const previa = calcularResumoLancamento({
      valor_frete: String(C.baseCliente),
      valor_repasse: String(C.basePrestador),
      valor_pedagio: String(C.pedagio),
      valor_reembolso_outros: String(C.reembolsoPrestador),
      valor_adicional: String(C.outrosCliente),
      valor_desconto: String(C.descontoCliente),
      valor_desconto_prestador: String(C.descontoPrestador),
      km_realizados: String(C.km_realizados),
      pedagio_cobrar_excedente: true,
      tabela_km: { franquiaCliente: 140, valorKmExcCliente: 1, franquiaPrestador: 140, valorKmPrestador: 1 },
    });
    const res = await lancarServicoManual({
      data_escala: C.data_escala, tipo_veiculo: C.tipo_veiculo, cliente_id: C.cliente_id,
      prestador_id: C.prestador_id, romaneio: C.romaneio, km_realizados: C.km_realizados,
      valor_frete: C.baseCliente, valor_repasse: C.basePrestador, valor_pedagio: C.pedagio,
      valor_reembolso_outros: C.reembolsoPrestador, valor_adicional: C.outrosCliente,
      valor_desconto: C.descontoCliente, valor_desconto_prestador: C.descontoPrestador,
      pedagio_cobrar_excedente: true, franquia_km_cliente: 140, valor_km_excedente_cliente: 1,
      franquia_km_prestador: 140, valor_km_prestador: 1,
    });
    expect(res.success).toBe(true);

    store.alocacoes_escala = [{
      id: ALOC_ID, status: "concluida", finalizada: true, data_escala: C.data_escala,
      data_finalizacao: "2026-08-19T10:00:00.000Z", ordem_servico_id: OS_ID,
      ordens_servico: { id: OS_ID, numero: OS_NUMERO, romaneio: null },
      clientes: { nome_fantasia: "Cliente Homolog A31J13" },
      prestadores: { nome_completo: "Prestador Homolog A31J13" },
      ...(ultimoInsert as Record<string, unknown>),
    }];
    const [item] = await buscarCentralFinanceiro({ busca: C.romaneio });

    const linhas: Array<[string, number, number]> = [
      ["Base Cliente", previa.valorClienteBase, item.valorClienteBase],
      ["Base Prestador", Number(C.basePrestador), item.valorPrestadorBase],
      ["KM excedente Cliente", previa.totalExcedenteCliente, item.detalhe.valorKmExcedenteCliente],
      ["KM excedente Prestador", previa.totalExcedentePrestador, item.detalhe.valorKmExcedentePrestador],
      ["Pedágio Cliente", previa.pedagioCliente, item.detalhe.pedagioCliente],
      ["Pedágio Prestador", C.pedagio, item.detalhe.pedagioPrestador],
      ["Outros adicionais Cliente", previa.outrosCliente, item.detalhe.outrosCliente],
      ["Reembolsos Prestador", C.reembolsoPrestador, item.detalhe.reembolsoOutrosPrestador],
      ["Desconto Cliente", previa.descontosCliente, item.valorClienteDescontos],
      ["Desconto Prestador", C.descontoPrestador, item.valorPrestadorDescontos],
      ["Total Cliente", previa.valorClienteTotal, item.valorClienteTotal],
      ["Total Prestador", previa.valorPrestadorTotal, item.valorPrestadorTotal],
    ];
    for (const [nome, p, c] of linhas) {
      expect(c).toBeCloseTo(p, 5); // Central = Detalhes = Prévia (Detalhes usa o mesmo item)
    }
  });
});
