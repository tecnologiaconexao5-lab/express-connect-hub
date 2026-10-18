import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// PP-UX-02C1C — Wiring das ações oficiais de prestador.
// Garante: service chama EXATAMENTE a RPC oficial, repassa parâmetros e resultado,
// NÃO executa DML direto (sem .from/.insert/.update/.delete) e não usa funções
// legadas de escrita. Também valida as regras de visibilidade dos botões.
// ============================================================================

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => {
      fromMock(...args);
      throw new Error("DML direto proibido (S1/S2) — use RPC oficial");
    },
  },
}));

import {
  reprovarPagamento,
  cancelarPagamento,
  estornarPagamento,
} from "@/services/financeiro/pagamentoPrestadorService";
import {
  podeReprovarPagamento,
  podeCancelarPagamento,
  podeEstornarPagamento,
} from "@/helpers/acoesPagamentoPrestador";

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("PP-UX-02C1C — service usa SOMENTE RPC oficial", () => {
  it("reprovarPagamento chama f_reprovar_pagamento_prestador com id e motivo", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ sucesso: true, mensagem: "REPROVADO", pagamento_id: "pp-1", status_aprovacao: "reprovado" }],
      error: null,
    });
    const res = await reprovarPagamento("pp-1", "duplicado");
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("f_reprovar_pagamento_prestador", {
      p_pagamento_id: "pp-1",
      p_motivo: "duplicado",
    });
    expect(res.sucesso).toBe(true);
    expect(res.status_aprovacao).toBe("reprovado");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("reprovarPagamento aceita motivo ausente (null)", async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ sucesso: true, mensagem: "REPROVADO" }], error: null });
    await reprovarPagamento("pp-2");
    expect(rpcMock).toHaveBeenCalledWith("f_reprovar_pagamento_prestador", {
      p_pagamento_id: "pp-2",
      p_motivo: null,
    });
  });

  it("cancelarPagamento chama f_cancelar_pagamento_prestador e propaga NECESSARIO_ESTORNO", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ sucesso: false, mensagem: "NECESSARIO_ESTORNO", pagamento_id: "pp-3", status_pagamento: "pendente" }],
      error: null,
    });
    const res = await cancelarPagamento("pp-3", "erro de cadastro");
    expect(rpcMock).toHaveBeenCalledWith("f_cancelar_pagamento_prestador", {
      p_pagamento_id: "pp-3",
      p_motivo: "erro de cadastro",
    });
    expect(res.sucesso).toBe(false);
    expect(res.mensagem).toBe("NECESSARIO_ESTORNO");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("cancelarPagamento sucesso devolve status cancelado", async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ sucesso: true, mensagem: "CANCELADO", status_pagamento: "cancelado" }], error: null });
    const res = await cancelarPagamento("pp-4");
    expect(res.sucesso).toBe(true);
    expect(res.status_pagamento).toBe("cancelado");
  });

  it("estornarPagamento chama f_estornar_pagamento_prestador com motivo obrigatorio e propaga BLOCKED_PAGAMENTO_PARCIAL", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ sucesso: false, mensagem: "BLOCKED_PAGAMENTO_PARCIAL", pagamento_id: "pp-5", status_pagamento: "pago" }],
      error: null,
    });
    const res = await estornarPagamento("pp-5", "estorno indevido");
    expect(rpcMock).toHaveBeenCalledWith("f_estornar_pagamento_prestador", {
      p_pagamento_id: "pp-5",
      p_motivo: "estorno indevido",
    });
    expect(res.mensagem).toBe("BLOCKED_PAGAMENTO_PARCIAL");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("estornarPagamento sucesso devolve baixa_id e fp_status", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ sucesso: true, mensagem: "ESTORNADO", baixa_id: "b-1", fp_status: "aberto", status_pagamento: "pendente" }],
      error: null,
    });
    const res = await estornarPagamento("pp-6", "motivo");
    expect(res.sucesso).toBe(true);
    expect(res.baixa_id).toBe("b-1");
    expect(res.fp_status).toBe("aberto");
  });

  it("erro de transporte da RPC e propagado como excecao", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "network down" } });
    await expect(reprovarPagamento("pp-7")).rejects.toThrow("network down");
  });

  it("resposta invalida (sem sucesso) e rejeitada", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await expect(cancelarPagamento("pp-8")).rejects.toThrow(/Resposta invalida/);
  });
});

describe("PP-UX-02C1C — regras de visibilidade dos botoes", () => {
  it("REPROVAR aparece somente em conferido + aguardando_aprovacao e nao terminal", () => {
    expect(podeReprovarPagamento({ status_conferencia: "conferido", status_aprovacao: "aguardando_aprovacao", status_pagamento: "pendente" })).toBe(true);
    expect(podeReprovarPagamento({ status_conferencia: "conferido", status_aprovacao: null, status_pagamento: "pendente" })).toBe(true);
    expect(podeReprovarPagamento({ status_conferencia: "em_aberto", status_aprovacao: "aguardando_aprovacao", status_pagamento: "pendente" })).toBe(false);
    expect(podeReprovarPagamento({ status_conferencia: "conferido", status_aprovacao: "aprovado", status_pagamento: "pendente" })).toBe(false);
    expect(podeReprovarPagamento({ status_conferencia: "conferido", status_aprovacao: "aguardando_aprovacao", status_pagamento: "pago" })).toBe(false);
    expect(podeReprovarPagamento({ status_conferencia: "conferido", status_aprovacao: "aguardando_aprovacao", status_pagamento: "cancelado" })).toBe(false);
  });

  it("CANCELAR aparece em pendente/nao_vencido/em_lote e NUNCA em pago/cancelado", () => {
    expect(podeCancelarPagamento({ status_pagamento: "pendente" })).toBe(true);
    expect(podeCancelarPagamento({ status_pagamento: "nao_vencido" })).toBe(true);
    expect(podeCancelarPagamento({ status_pagamento: "em_lote" })).toBe(true);
    expect(podeCancelarPagamento({ status_pagamento: "pago" })).toBe(false);
    expect(podeCancelarPagamento({ status_pagamento: "cancelado" })).toBe(false);
    expect(podeCancelarPagamento({ status_pagamento: undefined })).toBe(false);
  });

  it("ESTORNAR aparece somente em pago (integral)", () => {
    expect(podeEstornarPagamento({ status_pagamento: "pago" })).toBe(true);
    expect(podeEstornarPagamento({ status_pagamento: "pendente" })).toBe(false);
    expect(podeEstornarPagamento({ status_pagamento: "em_lote" })).toBe(false);
    expect(podeEstornarPagamento({ status_pagamento: "cancelado" })).toBe(false);
  });
});
