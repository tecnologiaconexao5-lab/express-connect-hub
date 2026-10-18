// ═══════════════════════════════════════════════════════════════════════════════
// FIN-UX-02B — PAGINAÇÃO REAL EM CONTAS A PAGAR
// Testes determinísticos (sem banco), com render + verificações estruturais:
//   1. sem cap silencioso (352 registros > 300, "de 352")
//   2. páginas numeradas + Anterior/Próxima
//   3. última página parcial
//   4. busca global (encontra registro que NÃO está na página 1) + reset à pág. 1
//   5. filtros/ordenação antes da paginação (estrutural)
//   6. nenhum fluxo financeiro disparado no carregamento
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";
import { buildPageList } from "@/components/ui/PaginationBar";

// 352 = 14 páginas cheias (25) + 1 página parcial (2)
const H = vi.hoisted(() => {
  type AnyRow = Record<string, unknown>;
  const mk = (i: number): AnyRow => ({
    id: `id-${i}`,
    fornecedor: i === 350 ? "ZZZ Alvo Global Unico" : `Fornecedor ${String(i).padStart(3, "0")}`,
    fornecedor_documento: `000${i}`,
    documento: `NF-${i}`,
    tipo_documento: "NF",
    categoria: "Outros",
    plano_contas: "",
    centro_resultado: "",
    unidade_filial: "Matriz (SP)",
    despesa_fixa_base: "Variável",
    competencia: "2026-09",
    data_emissao: "2026-09-01",
    data_vencimento: "2099-01-01",
    data_previsao_pagamento: "2099-01-01",
    valor: 100,
    valor_bruto: 100,
    desconto: 0,
    multa: 0,
    juros: 0,
    impostos_retidos: 0,
    valor_liquido: 100,
    data_pagamento: null,
    status: "aberto",
    recorrencia: "nenhuma",
    observacoes: "",
    is_teste: false,
  });
  const ROWS: AnyRow[] = Array.from({ length: 352 }, (_, i) => mk(i));
  const chain = (data: AnyRow[]) => {
    const build = (): Record<string, unknown> => {
      const methods: Record<string, unknown> = {
        select: build, eq: build, neq: build, in: build, gte: build, lte: build,
        order: build, range: build, maybeSingle: build, single: build,
        contains: build, returns: build, maybeThen: build, limit: build,
        insert: build, update: build, delete: build,
      };
      methods.then = (onf?: (v: { data: AnyRow[]; error: null }) => unknown) =>
        Promise.resolve({ data, error: null }).then(onf);
      return methods;
    };
    return build();
  };
  return { ROWS, chain };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (t: string) => H.chain(t === "financeiro_pagar" ? H.ROWS : []),
    rpc: vi.fn(),
  },
}));

vi.mock("@/services/financeiro/pagarService", () => ({
  criarPagavel: vi.fn(),
  atualizarPagavel: vi.fn(),
  baixarPagavel: vi.fn(),
  cancelarPagavel: vi.fn(),
  criarParcelasPagavel: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import ContasPagar from "@/components/financeiro/ContasPagar";
import * as pagarService from "@/services/financeiro/pagarService";

afterEach(cleanup);

const SRC = fs.readFileSync(
  path.join(process.cwd(), "src/components/financeiro/ContasPagar.tsx"),
  "utf8"
);

async function renderTela() {
  render(<MemoryRouter><ContasPagar /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/Exibindo 1–25 de 352/)).toBeTruthy());
}

describe("FIN-UX-02B — Contas a Pagar (render)", () => {
  it("1) sem cap silencioso: 352 registros (>300) aparecem como 'de 352'", async () => {
    await renderTela();
    expect(screen.getByText(/de 352/)).toBeTruthy();
    // 25 linhas na página 1 (não as 352)
    const linhas = document.querySelectorAll("tbody tr");
    expect(linhas.length).toBe(25);
  });

  it("2) páginas numeradas + Anterior desabilitado na página 1", async () => {
    await renderTela();
    expect(screen.getByTitle("Página 1")).toBeTruthy();
    expect(screen.getByTitle("Página 2")).toBeTruthy();
    expect(screen.getByTitle("Página 15")).toBeTruthy();
    const anterior = screen.getByTitle("Anterior") as HTMLButtonElement;
    expect(anterior.disabled).toBe(true);
  });

  it("3) Próxima/Anterior navegam e mostram o intervalo correto", async () => {
    await renderTela();
    fireEvent.click(screen.getByTitle("Próxima"));
    await waitFor(() => expect(screen.getByText(/Exibindo 26–50 de 352/)).toBeTruthy());
    fireEvent.click(screen.getByTitle("Anterior"));
    await waitFor(() => expect(screen.getByText(/Exibindo 1–25 de 352/)).toBeTruthy());
  });

  it("4) última página é parcial (351–352 de 352)", async () => {
    await renderTela();
    fireEvent.click(screen.getByTitle("Página 15"));
    await waitFor(() => expect(screen.getByText(/Exibindo 351–352 de 352/)).toBeTruthy());
    expect(document.querySelectorAll("tbody tr").length).toBe(2);
  });

  it("5) busca é GLOBAL: encontra registro fora da página 1 e volta para a página 1", async () => {
    await renderTela();
    // vai para a página 2 (para provar o reset)
    fireEvent.click(screen.getByTitle("Página 2"));
    await waitFor(() => expect(screen.getByText(/Exibindo 26–50 de 352/)).toBeTruthy());
    const input = screen.getByPlaceholderText(/Buscar favorecido, doc, NF, categoria/);
    fireEvent.change(input, { target: { value: "ZZZ Alvo Global" } });
    // o registro está no índice 350 (fora da página 1) -> resultado único, página 1
    await waitFor(() => expect(screen.getByText(/Exibindo 1–1 de 1/)).toBeTruthy());
    expect(document.body.textContent).toContain("ZZZ Alvo Global Unico");
  });

  it("6) nenhum fluxo financeiro é disparado no carregamento", async () => {
    await renderTela();
    expect(pagarService.criarPagavel).not.toHaveBeenCalled();
    expect(pagarService.atualizarPagavel).not.toHaveBeenCalled();
    expect(pagarService.baixarPagavel).not.toHaveBeenCalled();
    expect(pagarService.cancelarPagavel).not.toHaveBeenCalled();
  });
});

describe("FIN-UX-02B — Contas a Pagar (estrutura do código)", () => {
  it("PAGE_SIZE=25 e PaginationBar com totalCount do conjunto filtrado", () => {
    expect(SRC).toContain("PAGE_SIZE_PAGAR = 25");
    expect(SRC).toContain("<PaginationBar");
    expect(SRC).toContain("totalCount={lancFiltrados.length}");
    expect(SRC).toContain("lancPagina.map((l) => (");
    expect(SRC).not.toContain("{lancFiltrados.map((l) => (");
  });

  it("ordenação/filtros/busca ocorrem ANTES da paginação (lancFiltrados -> lancPagina)", () => {
    // filtro sobre o conjunto completo
    expect(SRC).toContain("const lancFiltrados = useMemo(");
    expect(SRC).toMatch(/lancamentos\.filter\(/);
    // ordenação sobre o conjunto completo
    expect(SRC).toContain("result.sort(");
    // paginação recorta o conjunto já filtrado/ordenado
    expect(SRC).toMatch(/return lancFiltrados\.slice\(inicio, inicio \+ PAGE_SIZE_PAGAR\)/);
  });

  it("reset para página 1 em busca/filtro/período", () => {
    expect(SRC).toMatch(/useEffect\(\(\) => \{\s*setPagina\(1\);\s*\}, \[buscaRapida, filtrosAtivos, periodoEfetivo\.inicio, periodoEfetivo\.fim\]\)/);
  });

  it("sem cap silencioso na query da listagem (nenhum .limit após financeiro_pagar)", () => {
    expect(SRC).not.toMatch(/financeiro_pagar[\s\S]{0,300}\.limit\(/);
  });
});

describe("FIN-UX-02B — PaginationBar (páginas numeradas)", () => {
  it("gera 1..N e reticências (primeira/última)", () => {
    expect(buildPageList(1, 1)).toEqual([1]);
    expect(buildPageList(1, 3)).toEqual([1, 2, 3]);
    expect(buildPageList(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
    expect(buildPageList(1, 15)).toEqual([1, 2, "…", 15]);
    expect(buildPageList(15, 15)).toEqual([1, "…", 14, 15]);
  });
});
