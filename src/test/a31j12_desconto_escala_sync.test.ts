import { describe, it, expect, vi, beforeEach } from "vitest";
import { dividirDescontosEscala, reconstruirDescontosEscala } from "@/services/escala/escalaFinanceiroDesconto";

// ============================================================================
// A31-J1.12 — Sincroniza o desconto do prestador na Escala com o contrato da
// Central: desconto cliente → valor_desconto; desconto prestador →
// valor_desconto_prestador. Nunca usar valor_desconto para reduzir as duas pernas.
// ============================================================================

describe("A31-J1.12 — Split de descontos da Escala (payload → campos oficiais)", () => {
  it("1. desconto cliente (ajuste negativo) vai para valor_desconto", () => {
    const d = dividirDescontosEscala(-100, 0, 600);
    expect(d.valorDescontoCliente).toBe(100); // → valor_desconto
    expect(d.valorDescontoPrestador).toBe(0);
  });

  it("2. desconto prestador vai para valor_desconto_prestador", () => {
    const d = dividirDescontosEscala(0, 50, 600);
    expect(d.valorDescontoPrestador).toBe(50); // → valor_desconto_prestador
    expect(d.valorDescontoCliente).toBe(0);
  });

  it("3. reabrir preserva ambos (valor_desconto → campo Cliente; valor_desconto_prestador → campo Prestador)", () => {
    const r = reconstruirDescontosEscala(100, 50);
    expect(r.ajusteCliente).toBe(-100); // desconto cliente volta como ajuste negativo
    expect(r.descontoPrestador).toBe(50);
  });

  it("3b. legado: valor_desconto_prestador=0 com valor_desconto preenchido é tratado como prestador", () => {
    const r = reconstruirDescontosEscala(50, 0);
    expect(r.descontoPrestador).toBe(50); // alocação antiga (Escala legada)
    expect(r.ajusteCliente).toBe(0);
  });

  it("4. Total Cliente usa somente o desconto cliente (frete − valor_desconto = base + ajuste)", () => {
    // ajuste cliente -100 (desconto) sobre base 600 → Escala totalCliente = 500
    const d = dividirDescontosEscala(-100, 0, 600);
    expect(d.valorFrete).toBe(600); // base sem o desconto
    // reconstrução da Central: Total Cliente = frete − descontoCliente
    expect(d.valorFrete - d.valorDescontoCliente).toBe(500);
    // prestador NÃO é afetado pelo desconto do cliente
    expect(d.valorDescontoPrestador).toBe(0);
  });

  it("5. Total Prestador usa somente o desconto prestador (base + adicionais − valor_desconto_prestador)", () => {
    const d = dividirDescontosEscala(0, 50, 600);
    expect(d.valorDescontoPrestador).toBe(50);
    // cliente NÃO é afetado pelo desconto do prestador
    expect(d.valorDescontoCliente).toBe(0);
    expect(d.valorFrete).toBe(600);
  });

  it("5b. ambos coexistem sem vazar de perna", () => {
    const d = dividirDescontosEscala(-100, 50, 600);
    expect(d.valorDescontoCliente).toBe(100);
    expect(d.valorDescontoPrestador).toBe(50);
    expect(d.valorFrete - d.valorDescontoCliente).toBe(500); // cliente
  });

  it("6. nenhum impacto em KM/pedágio (split não toca outros campos)", () => {
    const d = dividirDescontosEscala(-100, 50, 600);
    expect(Object.keys(d).sort()).toEqual(["valorDescontoCliente", "valorDescontoPrestador", "valorFrete"]);
    // ajuste positivo continua embutido no frete (adicional do cliente), não vira desconto
    const positivo = dividirDescontosEscala(80, 0, 600);
    expect(positivo.valorFrete).toBe(680);
    expect(positivo.valorDescontoCliente).toBe(0);
  });
});

// ============================================================================
// Sincronização Escala → alocacoes_escala → Central Financeira (mesmos campos).
// ============================================================================
const OS_ID = "os-a31j12-001";
const OS_NUMERO = "OS-202608-464646";
const ALOC_ID = "aloc-a31j12-001";

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
  return { supabase: { from: (tabela: string) => chainable(tabela) } };
});

import { buscarCentralFinanceiro } from "@/services/financeiro/centralFinanceiroService";

beforeEach(() => {
  for (const k of Object.keys(store)) store[k] = [];
});

function alocacaoPersistida(extra: Record<string, unknown> = {}) {
  return {
    id: ALOC_ID,
    status: "concluida",
    finalizada: true,
    data_escala: "2026-08-18",
    data_finalizacao: "2026-08-18T10:00:00.000Z",
    ordem_servico_id: OS_ID,
    ordens_servico: { id: OS_ID, numero: OS_NUMERO, romaneio: null },
    clientes: { nome_fantasia: "Cliente E2E A31J12" },
    prestadores: { nome_completo: "Prestador E2E A31J12" },
    cliente_id: "cliente-a31j12-1",
    prestador_id: "prestador-a31j12-1",
    tipo_veiculo: "Carreta",
    placa: "E2E-0001",
    origem: "São Paulo/SP",
    destino: "Campinas/SP",
    valor_frete: 600,
    valor_repasse: 500,
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
    metadata: { numeroOC: "HML-A31J12-E2E", origem: "escala" },
    ...extra,
  };
}

describe("A31-J1.12 — Sincronização Escala → Central (mesmos dois campos)", () => {
  it("desconto prestador salvo na Escala aparece na Central; desconto cliente não contamina o prestador", async () => {
    const d = dividirDescontosEscala(-100, 50, 600); // ajuste cliente -100, prestador 50
    store.alocacoes_escala = [
      alocacaoPersistida({
        valor_frete: d.valorFrete,
        valor_desconto: d.valorDescontoCliente,
        valor_desconto_prestador: d.valorDescontoPrestador,
      }),
    ];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J12-E2E" });
    // Total Cliente = frete(600) − desconto cliente(100) = 500
    expect(item.valorClienteTotal).toBe(500);
    // Total Prestador = repasse(500) − desconto prestador(50) = 450
    expect(item.valorPrestadorTotal).toBe(450);
    expect(item.valorClienteDescontos).toBe(100);
    expect(item.valorPrestadorDescontos).toBe(50);
  });

  it("Central salva desconto cliente → Escala reabre no campo Cliente sem contaminar o Prestador", async () => {
    // alocação criada pela Central com desconto cliente 80 e desconto prestador 30
    store.alocacoes_escala = [
      alocacaoPersistida({ valor_desconto: 80, valor_desconto_prestador: 30 }),
    ];
    const [item] = await buscarCentralFinanceiro({ busca: "HML-A31J12-E2E" });
    // reabertura na Escala
    const r = reconstruirDescontosEscala(item.valorClienteDescontos, item.valorPrestadorDescontos);
    expect(r.ajusteCliente).toBe(-80); // campo Cliente (desconto)
    expect(r.descontoPrestador).toBe(30); // campo Prestador
    expect(item.valorClienteTotal).toBe(600 - 80);
    expect(item.valorPrestadorTotal).toBe(500 - 30);
  });
});
