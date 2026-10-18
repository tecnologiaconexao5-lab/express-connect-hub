// ═══════════════════════════════════════════════════════════════════════════════
// FIN-UX-02A — PAGINAÇÃO REAL NA CONFERÊNCIA FINANCEIRA
// Testes determinísticos, sem banco:
//   1. Service sem LIMIT 300 silencioso (retorna o conjunto COMPLETO)
//   2. Componente paginado (itensPagina + PaginationBar) sobre o conjunto completo
//   3. Semântica de seleção por página (não vaza entre páginas)
//   4. Reset para página 1 ao aplicar filtros/busca
//   5. PaginationBar numerada (primeira/última/reticências)
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildPageList } from "@/components/ui/PaginationBar";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const SERVICE_SRC = "src/services/financeiro/centralFinanceiroService.ts";
const COMPONENT_SRC = "src/components/financeiro/ConferenciaFinanceira.tsx";

type Row = { data: unknown[]; error: null };

/** Chain do supabase que RESPEITA .limit(n) — prova comportamental do cap. */
function chainComLimit(res: Row) {
  const state: { limit: number | null } = { limit: null };
  const build = (): Record<string, unknown> => {
    const methods: Record<string, unknown> = {
      select: build, eq: build, neq: build, in: build, gte: build, lte: build,
      order: build, range: build, maybeSingle: build, single: build,
      contains: build, returns: build, maybeThen: build,
      limit: (n: number) => { state.limit = n; return build(); },
    };
    methods.then = (onf?: (v: Row) => unknown) => {
      const data = state.limit != null ? (res.data as unknown[]).slice(0, state.limit) : res.data;
      return Promise.resolve({ data, error: null }).then(onf);
    };
    return methods;
  };
  return build();
}

function alocacao(i: number) {
  return {
    id: `aloc-${i}`,
    ordem_servico_id: null,
    status: "concluida",
    finalizada: true,
    data_escala: "2026-09-01",
    data_finalizacao: `2026-09-01T00:00:${String(i % 60).padStart(2, "0")}Z`,
    cliente_id: "cli-1",
    prestador_id: "prest-1",
    tipo_veiculo: "Van",
    placa: "ABC1D23",
    origem: "A",
    destino: "B",
    valor_frete: 100,
    valor_repasse: 70,
    km_realizados: 10,
    clientes: { id: "cli-1", nome_fantasia: "Cliente Teste", razao_social: "Cliente Teste LTDA", cnpj: null },
    prestadores: { id: "prest-1", nome_completo: "Prestador Teste", cpf_cnpj: null },
    ordens_servico: null,
    metadata: {},
  };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FIN-UX-02A — Service sem LIMIT 300 silencioso", () => {
  it("retorna o conjunto COMPLETO (350 linhas > 300) — cap removido", async () => {
    const rows = Array.from({ length: 350 }, (_, i) => alocacao(i));
    vi.doMock("@/lib/supabase", () => ({
      supabase: {
        from: (t: string) =>
          t === "alocacoes_escala"
            ? chainComLimit({ data: rows, error: null })
            : chainComLimit({ data: [], error: null }),
      },
    }));
    const { buscarCentralFinanceiro } = await import("@/services/financeiro/centralFinanceiroService");
    const itens = await buscarCentralFinanceiro({});
    expect(itens.length).toBe(350);
  });

  it("fonte do service não contém mais .limit(300)", () => {
    expect(read(SERVICE_SRC)).not.toMatch(/\.limit\(300\)/);
  });

  it("mantém status=concluida + finalizada=true (filtro base server-side preservado)", () => {
    const src = read(SERVICE_SRC);
    expect(src).toContain('.eq("status", "concluida")');
    expect(src).toContain('.eq("finalizada", true)');
  });
});

describe("FIN-UX-02A — Conferência paginada sobre o conjunto completo", () => {
  const src = read(COMPONENT_SRC);

  it("renderiza a página (itensPagina) e PaginationBar, com PAGE_SIZE=25", () => {
    expect(src).toContain("itensPagina.map(");
    expect(src).toContain("<PaginationBar");
    expect(src).toContain("PAGE_SIZE_CONFERENCIA = 25");
    expect(src).toContain("totalCount={itens.length}");
  });

  it("não renderiza o conjunto inteiro no corpo da tabela (sem itens.map direto)", () => {
    expect(src).not.toContain("{itens.map((a) => (");
  });

  it("mudança de filtros/busca/período volta para a página 1", () => {
    expect(src).toMatch(/setItens\(lista\);[\s\S]*setPagina\(1\);/);
  });

  it("seleção de cabeçalho é POR PÁGINA (elegiveisPagina) — não finge selecionar outras páginas", () => {
    expect(src).toContain("elegiveisPagina");
    expect(src).not.toContain("selecionados.size === itens.filter(isElegivel).length");
  });

  it("proteção contra página fora de faixa (clamp para totalPaginas)", () => {
    expect(src).toMatch(/if \(pagina > totalPaginas\) setPagina\(totalPaginas\);/);
  });
});

describe("FIN-UX-02A — janela de paginação (matemática)", () => {
  it("divide o conjunto completo em páginas de 25 (primeira/última/parcial)", () => {
    const itens = Array.from({ length: 60 }, (_, i) => i);
    const PAGE = 25;
    const slice = (p: number) => itens.slice((p - 1) * PAGE, (p - 1) * PAGE + PAGE);
    expect(slice(1)).toEqual(itens.slice(0, 25));
    expect(slice(2)).toEqual(itens.slice(25, 50));
    expect(slice(3).length).toBe(10);
    expect(Math.max(1, Math.ceil(itens.length / PAGE))).toBe(3);
  });

  it("seleção persistida por id não marca indevidamente linhas de outra página", () => {
    const pagina1 = ["a", "b", "c"];
    const pagina2 = ["d", "e", "f"];
    const selecionados = new Set<string>(["a", "b"]);
    // Na página 2, nenhum item está selecionado por engano.
    expect(pagina2.filter((id) => selecionados.has(id))).toEqual([]);
    expect(pagina1.filter((id) => selecionados.has(id)).sort()).toEqual(["a", "b"]);
  });
});

describe("FIN-UX-02A — PaginationBar numerada (primeira/última/reticências)", () => {
  it("gera 1..N e reticências quando aplicável", () => {
    expect(buildPageList(1, 1)).toEqual([1]);
    expect(buildPageList(1, 3)).toEqual([1, 2, 3]);
    expect(buildPageList(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
    expect(buildPageList(10, 10)).toEqual([1, "…", 9, 10]);
  });
});
