import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ============================================================================
// A31-J1.11 — Desconto/Ajuste do PRESTADOR (valor_desconto_prestador) integrado
// ao fluxo oficial: Lançamento Manual → alocacoes_escala → Central → Detalhes.
// Regra: Desconto Cliente NÃO altera Total Prestador; Desconto Prestador NÃO
// altera Total Cliente. Ambos coexistem e sobrevivem a salvar/recarregar.
// ============================================================================

const OS_ID = "os-a31j11-001";
const OS_NUMERO = "OS-202608-454545";
const ALOC_ID = "aloc-a31j11-001";

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

function resetStore() {
  for (const k of Object.keys(store)) store[k] = [];
}

function alocacaoPersistida(extra: Record<string, unknown> = {}) {
  return {
    id: ALOC_ID,
    status: "concluida",
    finalizada: true,
    data_escala: "2026-08-18",
    data_finalizacao: "2026-08-18T10:00:00.000Z",
    ordem_servico_id: OS_ID,
    ordens_servico: { id: OS_ID, numero: OS_NUMERO, romaneio: null },
    clientes: { nome_fantasia: "Cliente E2E A31J11" },
    prestadores: { nome_completo: "Prestador E2E A31J11" },
    cliente_id: "cliente-a31j11-1",
    prestador_id: "prestador-a31j11-1",
    tipo_veiculo: "Carreta",
    placa: "E2E-0001",
    origem: "São Paulo/SP",
    destino: "Campinas/SP",
    valor_frete: 1000,
    valor_repasse: 800,
    valor_pedagio: 0,
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
    valor_desconto_prestador: 0,
    km_realizados: 0,
    pedagio_cobrar_excedente: false,
    metadata: { numeroOC: "HML-A31J11-E2E", origem: "central_financeira_manual" },
    ...extra,
  };
}

beforeEach(() => {
  insertMock.mockClear();
  osInsertMock.mockClear();
  ultimoInsert = null;
  resetStore();
});

describe("A31-J1.11 — Desconto/Ajuste do Prestador integrado (valor_desconto_prestador)", () => {
  it("1. desconto cliente reduz SÓ o Total Cliente (prestador intacto)", async () => {
    store.alocacoes_escala = [alocacaoPersistida({ valor_desconto: 100 })];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J11-E2E" });
    expect(item.valorClienteTotal).toBe(900); // 1000 - 100
    expect(item.valorPrestadorTotal).toBe(800); // intacto
    expect(item.valorClienteDescontos).toBe(100);
    expect(item.valorPrestadorDescontos).toBe(0);
  });

  it("2. desconto prestador reduz SÓ o Total Prestador (cliente intacto)", async () => {
    store.alocacoes_escala = [alocacaoPersistida({ valor_desconto_prestador: 50 })];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J11-E2E" });
    expect(item.valorClienteTotal).toBe(1000); // intacto
    expect(item.valorPrestadorTotal).toBe(750); // 800 - 50
    expect(item.valorClienteDescontos).toBe(0);
    expect(item.valorPrestadorDescontos).toBe(50);
  });

  it("3. ambos os descontos coexistem sem vazar de perna", async () => {
    store.alocacoes_escala = [alocacaoPersistida({ valor_desconto: 100, valor_desconto_prestador: 50 })];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J11-E2E" });
    expect(item.valorClienteTotal).toBe(900);
    expect(item.valorPrestadorTotal).toBe(750);
    expect(item.valorClienteDescontos).toBe(100);
    expect(item.valorPrestadorDescontos).toBe(50);
  });

  it("4+5. salvar/reabrir preserva os dois (Lançamento → insert → Central)", async () => {
    const res = await lancarServicoManual({
      data_escala: "2026-08-18",
      tipo_veiculo: "Carreta",
      cliente_id: "cliente-a31j11-1",
      prestador_id: "prestador-a31j11-1",
      valor_frete: 1000,
      valor_repasse: 800,
      valor_desconto: 100,
      valor_desconto_prestador: 50,
    });
    expect(res.success).toBe(true);
    // persistidos em alocacoes_escala (fonte única)
    expect(ultimoInsert?.valor_desconto).toBe(100);
    expect(ultimoInsert?.valor_desconto_prestador).toBe(50);
    // recarregamento da Central reconstroi as duas pernas
    store.alocacoes_escala = [alocacaoPersistida({ valor_desconto: 100, valor_desconto_prestador: 50 })];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J11-E2E" });
    expect(item.valorClienteTotal).toBe(900);
    expect(item.valorPrestadorTotal).toBe(750);
  });

  it("6. Detalhes do Serviço mostra os dois descontos (campos do dossiê)", async () => {
    store.alocacoes_escala = [alocacaoPersistida({ valor_desconto: 100, valor_desconto_prestador: 50 })];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J11-E2E" });
    // linhas "Descontos" do dossiê (Financeiro Cliente / Financeiro Prestador)
    expect(item.valorClienteDescontos).toBe(100);
    expect(item.valorPrestadorDescontos).toBe(50);
    expect(item.detalhe.kmRealizados).toBe(0);
  });

  it("7. financeiro_pagar passa a gravar o desconto prestador (SQL aplicado)", async () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/20260819_a31j111_desconto_prestador.sql"),
      "utf8"
    );
    // coluna aditiva aplicada
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS valor_desconto_prestador numeric(14,2) NOT NULL DEFAULT 0");
    // trigger: prestador desconto do campo próprio
    expect(sql).toContain("COALESCE(NEW.valor_desconto_prestador, 0)");
    // financeiro_pagar grava o desconto
    expect(sql).toContain("desconto = v_desconto_valor");
    // perna cliente intocada: financeiro_receber NÃO usa o desconto prestador
    const receberBlocks = sql.match(/INSERT INTO financeiro_receber[\s\S]*?;/g) || [];
    expect(receberBlocks.length).toBeGreaterThan(0);
    expect(receberBlocks.every((s) => !s.includes("desconto"))).toBe(true);
  });

  it("8. desconto prestador coexiste com pedágio/KM sem regressão (A31-J1.9)", async () => {
    const item = alocacaoPersistida({
      valor_frete: 600,
      valor_repasse: 520,
      valor_pedagio: 66.43,
      valor_desconto: 10,
      valor_desconto_prestador: 20,
      km_realizados: 159.6,
      metadata: {
        numeroOC: "HML-A31J11-E2E",
        origem: "central_financeira_manual",
        faturamento: { franquia_km: 140, valor_km_excedente: 1 },
        repasse: { franquia_km_prestador: 140, valor_km_prestador: 1 },
      },
    });
    store.alocacoes_escala = [item];
    const [r] = await buscarCentralFinanceiro({ busca: "HML-A31J11-E2E" });
    expect(r.detalhe.valorKmExcedenteCliente).toBeCloseTo(19.6, 5);
    expect(r.detalhe.valorKmExcedentePrestador).toBeCloseTo(19.6, 5);
    expect(r.valorPrestadorAdicionais).toBeCloseTo(66.43, 5); // pedágio não duplica
    expect(r.valorClienteTotal).toBeCloseTo(600 + 19.6 - 10, 5); // 609.60
    expect(r.valorPrestadorTotal).toBeCloseTo(520 + 19.6 + 66.43 - 20, 5); // 586.03
  });
});
