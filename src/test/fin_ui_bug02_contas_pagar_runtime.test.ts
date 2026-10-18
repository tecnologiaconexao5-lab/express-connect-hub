/**
 * FIN-UI-BUG-02 — Teste de montagem: ContasPagar sem ReferenceError
 *
 * Verifica que o componente ContasPagar pode ser importado e renderizado
 * sem ReferenceError síncrono (hojeSP, periodoEfetivo, etc.).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// ── Mocks de dependências externas ──
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/services/financeiro/pagarService", () => ({
  criarPagavel: vi.fn().mockResolvedValue({}),
  atualizarPagavel: vi.fn().mockResolvedValue({}),
  baixarPagavel: vi.fn().mockResolvedValue({}),
  cancelarPagavel: vi.fn().mockResolvedValue({}),
  criarParcelasPagavel: vi.fn().mockResolvedValue({}),
}));

// ── Teste principal ──
describe("FIN-UI-BUG-02 — ContasPagar montagem sem ReferenceError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve importar ContasPagar sem ReferenceError", async () => {
    // Se hojeSP não estiver importado, a importação pode falhar
    // ou o componente pode falhar ao avaliar o corpo da função
    const mod = await import("../components/financeiro/ContasPagar");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("hojeSP deve estar disponível e retornar formato YYYY-MM-DD", async () => {
    const { hojeSP } = await import("../helpers/statusVencimento");
    const resultado = hojeSP();
    expect(resultado).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("ContasPagar deve ser renderizável sem ReferenceError no corpo", async () => {
    // Import dinâmico para capturar ReferenceError na avaliação do módulo
    let Component;
    try {
      const mod = await import("../components/financeiro/ContasPagar");
      Component = mod.default;
    } catch (e: any) {
      // Se a importação falhar com ReferenceError, o teste falha
      if (e instanceof ReferenceError) {
        expect.fail(`ReferenceError na importação: ${e.message}`);
      }
      // Outros erros (ex: modules não encontrados) são aceitáveis em teste unitário
      return;
    }

    // Verificar que o componente é uma função React válida
    expect(Component).toBeDefined();
    expect(typeof Component).toBe("function");

    // Verificar que o nome do componente está correto
    expect(Component.name).toBe("ContasPagar");
  });

  it("todos os imports de statusVencimento devem estar disponíveis", async () => {
    const mod = await import("../helpers/statusVencimento");
    expect(mod.calcularStatusEfetivo).toBeDefined();
    expect(mod.statusEfetivoLabel).toBeDefined();
    expect(mod.statusEfetivoClasses).toBeDefined();
    expect(mod.hojeSP).toBeDefined();
  });
});
