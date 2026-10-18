import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// FIN-SANE-02B — Testes do fluxo pagarFechamento()
//
// Objetivo: garantir que pagarFechamento() delega para o RPC transacional
// f_confirmar_pagamento_fechamento e NÃO atualiza status de pagamento
// sem baixa financeira.
//
// Nenhuma chamada real a Supabase — banco NÃO ALTERADO.
// ============================================================================

const maybeSingleMock = vi.fn();
const singleMock = vi.fn();
const selectMock = vi.fn();
const updateMock = vi.fn();
const rpcMock = vi.fn();

function fluentFrom(tabela: string) {
  const builder: any = {};
  builder.select = (cols?: string) => {
    selectMock(tabela, cols);
    builder.eq = (_k: string, _v: unknown) => builder;
    builder.neq = (_k: string, _v: unknown) => builder;
    builder.limit = (_n: number) => builder;
    builder.order = (_c: string, _o: unknown) => builder;
    builder.range = (_a: number, _b: number) => builder;
    builder.maybeSingle = () => maybeSingleMock();
    builder.single = () => singleMock();
    return builder;
  };
  builder.update = (payload: Record<string, unknown>) => {
    updateMock(tabela, payload);
    builder.eq = (_k: string, _v: unknown) => builder;
    return builder;
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (t: string) => fluentFrom(t),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { pagarFechamento } from "@/services/financeiro/fechamentoService";

beforeEach(() => {
  maybeSingleMock.mockReset();
  singleMock.mockReset();
  selectMock.mockReset();
  updateMock.mockReset();
  rpcMock.mockReset();
});

function mockFechamentoBusca(statusPagamento: string, statusAprovacao: string, statusConferencia: string, status: string) {
  singleMock.mockResolvedValueOnce({
    data: {
      id: "fech-1",
      status_pagamento: statusPagamento,
      status_aprovacao: statusAprovacao,
      status_conferencia: statusConferencia,
      status,
      observacao: null,
    },
    error: null,
  });
}

function mockBuscarFechamento() {
  singleMock.mockResolvedValueOnce({
    data: {
      id: "fech-1",
      prestador_id: "prest-1",
      prestador_nome: "BRUNO",
      periodo_inicio: "2026-09-01",
      periodo_fim: "2026-09-30",
      valor_servicos: 1050,
      valor_reembolsos: 0,
      valor_bonus: 0,
      valor_descontos: 0,
      valor_adiantamentos: 0,
      valor_liquido: 1140,
      quantidade_os: 6,
      status: "pago",
      status_conferencia: "conferido",
      status_aprovacao: "aprovado",
      status_pagamento: "pago",
      data_conferencia: null,
      data_aprovacao: null,
      data_pagamento: "2026-09-13",
      observacao: null,
    },
    error: null,
  });
  singleMock.mockResolvedValueOnce({
    data: [
      { id: "item-1", prestador_nome: "BRUNO", valor_servicos: 175, pedagio: 17.5, adicionais: 0, descontos: 0, valor_liquido: 192.5, os_id: "os-1", os_numero: "OS-1", origem_lancamento: "escala_direta", periodo_inicio: "2026-09-01" },
    ],
    error: null,
  });
}

describe("FIN-SANE-02B — pagarFechamento()", () => {
  it("deve chamar RPC f_confirmar_pagamento_fechamento para fechamento aprovado", async () => {
    mockFechamentoBusca("pendente", "aprovado", "conferido", "aprovado");
    rpcMock.mockResolvedValueOnce({
      data: { sucesso: true, mensagem: "Fechamento pago", itens_processados: 6, itens_ignorados: 0, total_baixas: 6 },
      error: null,
    });
    mockBuscarFechamento();

    await pagarFechamento("fech-1", "2026-09-13");

    expect(rpcMock).toHaveBeenCalledWith("f_confirmar_pagamento_fechamento", {
      p_fechamento_id: "fech-1",
      p_data_pagamento: "2026-09-13",
    });
  });

  it("deve retornar sem chamar RPC se fechamento ja esta pago (idempotencia)", async () => {
    mockFechamentoBusca("pago", "aprovado", "conferido", "pago");
    mockBuscarFechamento();

    await pagarFechamento("fech-1");

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("deve lancar erro se RPC retornar sucesso=false", async () => {
    mockFechamentoBusca("pendente", "aprovado", "conferido", "aprovado");
    rpcMock.mockResolvedValueOnce({
      data: { sucesso: false, mensagem: "Saldo do titulo nao reconcilia" },
      error: null,
    });

    await expect(pagarFechamento("fech-1")).rejects.toThrow(/Saldo do titulo nao reconcilia|Fechamento nao foi pago financeiramente/);
  });

  it("deve lancar erro se RPC retornar erro de comunicacao", async () => {
    mockFechamentoBusca("pendente", "aprovado", "conferido", "aprovado");
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "connection failed" },
    });

    await expect(pagarFechamento("fech-1")).rejects.toThrow(/Erro ao pagar fechamento/);
  });

  it("deve lancar erro se fechamento nao estiver aprovado", async () => {
    mockFechamentoBusca("pendente", "aguardando_aprovacao", "conferido", "conferido");

    await expect(pagarFechamento("fech-1")).rejects.toThrow(/Transi[cç][aã]o inv[aá]lida|Transicao invalida/i);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("deve registrar observacao com conta quando contaFinanceiraId fornecido", async () => {
    mockFechamentoBusca("pendente", "aprovado", "conferido", "aprovado");
    rpcMock.mockResolvedValueOnce({
      data: { sucesso: true, mensagem: "OK", itens_processados: 1, itens_ignorados: 0, total_baixas: 1 },
      error: null,
    });
    mockBuscarFechamento();

    await pagarFechamento("fech-1", "2026-09-13", "conta-cora-1");

    expect(updateMock).toHaveBeenCalledTimes(1);
    const updatePayload = (updateMock.mock.calls[0] as any[])[1];
    expect(updatePayload.observacao).toContain("conta conta-cora-1");
  });

  it("deve retornar FechamentoDetalhado apos pagamento bem-sucedido", async () => {
    mockFechamentoBusca("pendente", "aprovado", "conferido", "aprovado");
    rpcMock.mockResolvedValueOnce({
      data: { sucesso: true, mensagem: "OK", itens_processados: 1, itens_ignorados: 0, total_baixas: 1 },
      error: null,
    });
    mockBuscarFechamento();

    const resultado = await pagarFechamento("fech-1");

    expect(resultado.id).toBe("fech-1");
    expect(resultado.status).toBe("pago");
    expect(resultado.valor_liquido).toBe(1140);
  });

  it("NAO deve fazer UPDATE direto de status_pagamento sem RPC", async () => {
    mockFechamentoBusca("pendente", "aprovado", "conferido", "aprovado");
    rpcMock.mockResolvedValueOnce({
      data: { sucesso: true, mensagem: "OK", itens_processados: 1, itens_ignorados: 0, total_baixas: 1 },
      error: null,
    });
    mockBuscarFechamento();

    await pagarFechamento("fech-1");

    // O único UPDATE permitido é o de observacao opcional; nunca status direto.
    const updatesDeStatus = (updateMock.mock?.calls || []).filter(
      ([_tabela, payload]: [string, any]) =>
        payload && (payload.status_pagamento === "pago" || payload.status === "pago")
    );
    expect(updatesDeStatus).toHaveLength(0);
  });
});

// ============================================================================
// Cenários SQL documentados (requerem banco de teste com migration aplicada):
//
// 1. base sem complemento     → fp.valor = pp.valor_liquido = base
// 2. base + pedágio           → fp.valor = base + pedágio
// 3. base + adicional         → fp.valor = base + adicional
// 4. pedágio + adicional      → fp.valor = base + pedágio + adicional
// 5. desconto                 → fp.valor = base - desconto
// 6. combinação créditos/débitos → fp.valor = valor_liquido
// 7. fechamento 1 item        → 1 baixa
// 8. fechamento vários itens  → N baixas
// 9. segunda execução         → 0 baixas novas (idempotente)
// 10. item já pago            → ignorado pelo RPC
// 11. título inexistente      → RPC retorna false
// 12. falha parcial           → rollback total via RPC transacional
//
// Esses cenários devem ser validados em ambiente QA/HML após aplicar
// supabase/migrations/20260913_fin_sane_02b_unifica_valor_pagar.sql.
// ============================================================================
