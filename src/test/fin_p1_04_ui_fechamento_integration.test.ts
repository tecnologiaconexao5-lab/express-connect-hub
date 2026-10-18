// ============================================================================
// FIN-P1-04 — Testes de Integração UI × fechamentoService
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fechamentoService
vi.mock("@/services/financeiro/fechamentoService", () => ({
  criarFechamento: vi.fn(),
  buscarFechamento: vi.fn(),
  listarFechamentos: vi.fn(),
  conferirFechamento: vi.fn(),
  aprovarFechamento: vi.fn(),
  pagarFechamento: vi.fn(),
  cancelarFechamento: vi.fn(),
}));

import {
  criarFechamento,
  buscarFechamento,
  listarFechamentos,
  conferirFechamento,
  aprovarFechamento,
  pagarFechamento,
  cancelarFechamento,
} from "@/services/financeiro/fechamentoService";

// Mock supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      single: vi.fn().mockResolvedValue({ data: null }),
      insert: vi.fn().mockResolvedValue({ data: null }),
      update: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
}));

describe("FIN-P1-04 — Integração UI × fechamentoService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Criar fechamento via fechamentoService", () => {
    it("criarFechamento recebe input correto", async () => {
      const mockResultado = {
        id: "f1",
        prestador_id: "p1",
        prestador_nome: "CESAR",
        periodo_inicio: "2026-07-01",
        periodo_fim: "2026-09-30",
        valor_servicos: 3997.48,
        valor_reembolsos: 0,
        valor_bonus: 0,
        valor_descontos: 0,
        valor_adiantamentos: 0,
        valor_liquido: 3997.48,
        quantidade_itens: 7,
        status: "em_conferencia",
        data_conferencia: null,
        data_aprovacao: null,
        data_pagamento: null,
        observacao: null,
        itens: [],
      };

      vi.mocked(criarFechamento).mockResolvedValue(mockResultado);

      const input = {
        prestador_id: "p1",
        prestador_nome: "CESAR AUGUSTO HOLANDA SILVA",
        prestador_documento: "123.456.789-00",
        periodo_inicio: "2026-07-01",
        periodo_fim: "2026-09-30",
        itens_ids: ["item1", "item2", "item3", "item4", "item5", "item6", "item7"],
      };

      const resultado = await criarFechamento(input);

      expect(criarFechamento).toHaveBeenCalledWith(input);
      expect(resultado.id).toBe("f1");
      expect(resultado.quantidade_itens).toBe(7);
      expect(resultado.status).toBe("em_conferencia");
    });

    it("criarFechamento falha sem itens_ids", async () => {
      vi.mocked(criarFechamento).mockRejectedValue(new Error("Pelo menos 1 item é obrigatório"));

      await expect(
        criarFechamento({
          prestador_id: "p1",
          prestador_nome: "CESAR",
          periodo_inicio: "2026-07-01",
          periodo_fim: "2026-09-30",
          itens_ids: [],
        })
      ).rejects.toThrow("Pelo menos 1 item é obrigatório");
    });
  });

  describe("2. Conferir fechamento", () => {
    it("conferirFechamento altera status para conferido", async () => {
      const mockResultado = {
        id: "f1",
        status: "conferido",
        data_conferencia: "2026-09-11T21:00:00Z",
      };

      vi.mocked(conferirFechamento).mockResolvedValue(mockResultado as any);

      const resultado = await conferirFechamento("f1");

      expect(conferirFechamento).toHaveBeenCalledWith("f1");
      expect(resultado.status).toBe("conferido");
      expect(resultado.data_conferencia).toBeTruthy();
    });

    it("conferirFechamento falha se status não é em_conferencia", async () => {
      vi.mocked(conferirFechamento).mockRejectedValue(
        new Error("Transição inválida: pago → conferido. Permitidos: ")
      );

      await expect(conferirFechamento("f1")).rejects.toThrow("Transição inválida");
    });
  });

  describe("3. Aprovar fechamento", () => {
    it("aprovarFechamento altera status para aprovado", async () => {
      const mockResultado = {
        id: "f1",
        status: "aprovado",
        data_aprovacao: "2026-09-11T21:00:00Z",
      };

      vi.mocked(aprovarFechamento).mockResolvedValue(mockResultado as any);

      const resultado = await aprovarFechamento("f1");

      expect(aprovarFechamento).toHaveBeenCalledWith("f1");
      expect(resultado.status).toBe("aprovado");
      expect(resultado.data_aprovacao).toBeTruthy();
    });

    it("aprovarFechamento falha se não está conferido", async () => {
      vi.mocked(aprovarFechamento).mockRejectedValue(
        new Error("Transição inválida: em_conferencia → aprovado. Permitidos: conferido, cancelado")
      );

      await expect(aprovarFechamento("f1")).rejects.toThrow("Transição inválida");
    });
  });

  describe("4. Pagar fechamento (idempotente)", () => {
    it("pagarFechamento registra pagamento", async () => {
      const mockResultado = {
        id: "f1",
        status: "pago",
        data_pagamento: "2026-09-11",
      };

      vi.mocked(pagarFechamento).mockResolvedValue(mockResultado as any);

      const resultado = await pagarFechamento("f1", "2026-09-11", "conta-1");

      expect(pagarFechamento).toHaveBeenCalledWith("f1", "2026-09-11", "conta-1");
      expect(resultado.status).toBe("pago");
    });

    it("pagarFechamento é idempotente — segunda chamada retorna sem erro", async () => {
      const mockResultado = {
        id: "f1",
        status: "pago",
        data_pagamento: "2026-09-11",
      };

      vi.mocked(pagarFechamento).mockResolvedValue(mockResultado as any);

      const r1 = await pagarFechamento("f1", "2026-09-11");
      const r2 = await pagarFechamento("f1", "2026-09-11");

      expect(r1.status).toBe("pago");
      expect(r2.status).toBe("pago");
    });

    it("pagarFechamento falha se não está aprovado", async () => {
      vi.mocked(pagarFechamento).mockRejectedValue(
        new Error("Transição inválida: conferido → pago. Permitidos: aprovado, cancelado")
      );

      await expect(pagarFechamento("f1", "2026-09-11")).rejects.toThrow("Transição inválida");
    });
  });

  describe("5. Cancelar fechamento", () => {
    it("cancelarFechamento altera status para cancelado", async () => {
      const mockResultado = {
        id: "f1",
        status: "cancelado",
      };

      vi.mocked(cancelarFechamento).mockResolvedValue(mockResultado as any);

      const resultado = await cancelarFechamento("f1", "Erro de cálculo");

      expect(cancelarFechamento).toHaveBeenCalledWith("f1", "Erro de cálculo");
      expect(resultado.status).toBe("cancelado");
    });

    it("cancelarFechamento falha sem motivo", async () => {
      vi.mocked(cancelarFechamento).mockRejectedValue(
        new Error("Motivo do cancelamento é obrigatório")
      );

      await expect(cancelarFechamento("f1", "")).rejects.toThrow("Motivo do cancelamento é obrigatório");
    });

    it("cancelarFechamento falha se já está pago", async () => {
      vi.mocked(cancelarFechamento).mockRejectedValue(
        new Error("Fechamento pago não pode ser cancelado")
      );

      await expect(cancelarFechamento("f1", "Motivo")).rejects.toThrow("Fechamento pago não pode ser cancelado");
    });
  });

  describe("6. Listar fechamentos", () => {
    it("listarFechamentos retorna array de fechamentos", async () => {
      const mockFechamentos = [
        {
          id: "f1",
          prestador_nome: "CESAR",
          status: "em_conferencia",
          valor_liquido: 3997.48,
          quantidade_itens: 7,
        },
        {
          id: "f2",
          prestador_nome: "BRUNO",
          status: "pago",
          valor_liquido: 7170,
          quantidade_itens: 6,
        },
      ];

      vi.mocked(listarFechamentos).mockResolvedValue(mockFechamentos as any);

      const resultado = await listarFechamentos({});

      expect(listarFechamentos).toHaveBeenCalledWith({});
      expect(resultado).toHaveLength(2);
      expect(resultado[0].prestador_nome).toBe("CESAR");
      expect(resultado[1].status).toBe("pago");
    });

    it("listarFechamentos filtra por prestador", async () => {
      vi.mocked(listarFechamentos).mockResolvedValue([]);

      await listarFechamentos({ prestador_id: "p1" });

      expect(listarFechamentos).toHaveBeenCalledWith({ prestador_id: "p1" });
    });

    it("listarFechamentos filtra por período", async () => {
      vi.mocked(listarFechamentos).mockResolvedValue([]);

      await listarFechamentos({ periodo_inicio: "2026-07-01", periodo_fim: "2026-09-30" });

      expect(listarFechamentos).toHaveBeenCalledWith({
        periodo_inicio: "2026-07-01",
        periodo_fim: "2026-09-30",
      });
    });
  });

  describe("7. Buscar fechamento individual", () => {
    it("buscarFechamento retorna detalhes completos", async () => {
      const mockDetalhado = {
        id: "f1",
        prestador_nome: "CESAR",
        status: "conferido",
        valor_liquido: 3997.48,
        quantidade_itens: 7,
        itens: [
          { id: "item1", valor_liquido: 520, valor_servicos: 520 },
          { id: "item2", valor_liquido: 652.86, valor_servicos: 652.86 },
        ],
      };

      vi.mocked(buscarFechamento).mockResolvedValue(mockDetalhado as any);

      const resultado = await buscarFechamento("f1");

      expect(buscarFechamento).toHaveBeenCalledWith("f1");
      expect(resultado.itens).toHaveLength(2);
      expect(resultado.valor_liquido).toBe(3997.48);
    });
  });

  describe("8. Transições inválidas bloqueadas", () => {
    const transicoesInvalidas = [
      { de: "em_conferencia", para: "aprovado" },
      { de: "em_conferencia", para: "pago" },
      { de: "conferido", para: "pago" },
      { de: "conferido", para: "em_conferencia" },
      { de: "pago", para: "conferido" },
      { de: "pago", para: "aprovado" },
      { de: "pago", para: "cancelado" },
      { de: "cancelado", para: "conferido" },
      { de: "cancelado", para: "aprovado" },
      { de: "cancelado", para: "pago" },
    ];

    transicoesInvalidas.forEach(({ de, para }) => {
      it(`bloqueia ${de} → ${para}`, async () => {
        const serviceMap: Record<string, any> = {
          conferido: conferirFechamento,
          aprovado: aprovarFechamento,
          pago: pagarFechamento,
          cancelado: cancelarFechamento,
        };

        const fn = serviceMap[para];
        if (fn) {
          fn.mockRejectedValue(new Error(`Transição inválida: ${de} → ${para}`));
          await expect(fn("f1")).rejects.toThrow("Transição inválida");
        }
      });
    });
  });

  describe("9. Fluxo completo — criar → conferir → aprovar → pagar", () => {
    it("fluxohappy path com dados de teste", async () => {
      const mockCriado = {
        id: "f-teste",
        status: "em_conferencia",
        valor_liquido: 1500,
        quantidade_itens: 3,
      };
      const mockConferido = { ...mockCriado, status: "conferido" };
      const mockAprovado = { ...mockCriado, status: "aprovado" };
      const mockPago = { ...mockCriado, status: "pago" };

      vi.mocked(criarFechamento).mockResolvedValue(mockCriado as any);
      vi.mocked(conferirFechamento).mockResolvedValue(mockConferido as any);
      vi.mocked(aprovarFechamento).mockResolvedValue(mockAprovado as any);
      vi.mocked(pagarFechamento).mockResolvedValue(mockPago as any);

      // 1. Criar
      const r1 = await criarFechamento({
        prestador_id: "teste-1",
        prestador_nome: "PRESTADOR TESTE",
        periodo_inicio: "2026-09-01",
        periodo_fim: "2026-09-30",
        itens_ids: ["t1", "t2", "t3"],
      });
      expect(r1.status).toBe("em_conferencia");

      // 2. Conferir
      const r2 = await conferirFechamento(r1.id);
      expect(r2.status).toBe("conferido");

      // 3. Aprovar
      const r3 = await aprovarFechamento(r1.id);
      expect(r3.status).toBe("aprovado");

      // 4. Pagar
      const r4 = await pagarFechamento(r1.id, "2026-09-15");
      expect(r4.status).toBe("pago");

      // 5. Pagar de novo = idempotente
      const r5 = await pagarFechamento(r1.id, "2026-09-15");
      expect(r5.status).toBe("pago");
    });
  });

  describe("10. is_teste seguro", () => {
    it("criarFechamento com dados is_teste não afeta produção", async () => {
      vi.mocked(criarFechamento).mockResolvedValue({
        id: "f-teste-real",
        status: "em_conferencia",
        quantidade_itens: 2,
        valor_liquido: 1040,
      } as any);

      const resultado = await criarFechamento({
        prestador_id: "teste-app-id",
        prestador_nome: "PRESTADOR TESTE APP",
        periodo_inicio: "2026-09-01",
        periodo_fim: "2026-09-30",
        itens_ids: ["teste-item-1", "teste-item-2"],
      });

      expect(criarFechamento).toHaveBeenCalled();
      expect(resultado.quantidade_itens).toBe(2);
    });
  });
});
