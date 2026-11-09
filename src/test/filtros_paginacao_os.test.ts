// ============================================================
// CORREÇÃO CIRÚRGICA 3 — Filtros na query (antes do .range) e
// paginação/contagem refletindo o total FILTRADO.
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { statusesOSParaGlobalFiltro, obterStatusGlobalOS } from "@/components/operacao/osTypes";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const lista = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const osTypes = readSrc("src/components/operacao/osTypes.ts");

describe("1) Mapa status global → status brutos da OS", () => {
  it("1.1 'finalizado' cobre finalizada/encerrada", () => {
    const statuses = statusesOSParaGlobalFiltro("finalizado");
    expect(statuses).toContain("finalizada");
    expect(statuses).toContain("encerrada");
  });

  it("1.2 demais status globais relevantes", () => {
    expect(statusesOSParaGlobalFiltro("cancelado")).toContain("cancelada");
    expect(statusesOSParaGlobalFiltro("em_analise")).toContain("em_analise");
    expect(statusesOSParaGlobalFiltro("pago_prestador")).toContain("paga");
    expect(statusesOSParaGlobalFiltro("faturado")).toContain("faturada");
    expect(statusesOSParaGlobalFiltro("alocado")).toContain("agendada");
  });

  it("1.3 obterStatusGlobalOS continua mapeando (regressão)", () => {
    expect(obterStatusGlobalOS("finalizada")).toBe("finalizado");
    expect(obterStatusGlobalOS("cancelada")).toBe("cancelado");
    expect(obterStatusGlobalOS("em_analise")).toBe("em_analise");
  });
});

describe("2) Filtros aplicados na QUERY antes do .range()", () => {
  it("2.1 status vai para o banco via .in('status', …)", () => {
    expect(lista).toContain("statusesOSParaGlobalFiltro(");
    expect(lista).toContain('.in("status", statusFiltrados)');
  });

  it("2.2 demais filtros vão para o banco", () => {
    expect(lista).toContain('.in("cliente", clientesFiltroIds)');
    expect(lista).toContain('.eq("tipo_operacao", filtroTipo)');
    expect(lista).toContain('.ilike("veiculo_tipo", filtroTipoVeiculo)');
    expect(lista).toContain('.ilike("carga_tipo", filtroTipoCarga)');
    expect(lista).toContain('.is("prestador", null)');
    expect(lista).toContain('.gte("data"');
    expect(lista).toContain("termoBusca");
    expect(lista).toContain("query = query.or(");
  });

  it("2.3 count exato e filtros são aplicados ANTES do range", () => {
    expect(lista).toContain('{ count: "exact" }');
    const idxFiltroStatus = lista.indexOf('.in("status", statusFiltrados)');
    const idxRange = lista.indexOf(".range(from, to)");
    expect(idxFiltroStatus).toBeGreaterThan(-1);
    expect(idxRange).toBeGreaterThan(idxFiltroStatus);
  });

  it("2.4 não há mais filtro client-side sobre a página", () => {
    expect(lista).not.toContain("const filtradas = ordens.filter(");
    expect(lista).toContain("const filtradas = ordens;");
  });
});

describe("3) Paginação/contagem refletem o total filtrado", () => {
  it("3.1 count do Supabase alimenta o totalCount", () => {
    expect(lista).toContain("if (count !== null) setTotalCount(count)");
    expect(lista).toContain("totalCount={totalCount}");
    expect(lista).toContain("{totalCount ?? filtradas.length} OS encontrada(s)");
  });

  it("3.2 mudar filtro volta para a página 1 e refaz a query", () => {
    expect(lista).toContain("const filtrosKey = [");
    expect(lista).toContain("filtrosKeyAnterior");
    expect(lista).toContain("setPage(1)");
    expect(lista).toContain("}, [page, filtrosKey]);");
  });

  it("3.3 busca com debounce e opções de cliente fora da página", () => {
    expect(lista).toContain("buscaAplicada");
    expect(lista).toContain("setBuscaAplicada(busca.trim())");
    expect(lista).toContain("clientesFiltro");
    expect(lista).toContain("const clientesDisponiveis = clientesFiltro;");
  });
});
