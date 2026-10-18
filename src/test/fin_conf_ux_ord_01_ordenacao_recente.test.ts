// ═══════════════════════════════════════════════════════════════════════════════
// TMS-FIN-CONF-UX-ORD-01 — Conferência: MAIS RECENTE -> MAIS ANTIGO (antes da paginação)
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ordenarCentralFinanceiro, compararCentralFinanceiro } from "@/services/financeiro/centralFinanceiroService";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const SRC_SVC = "src/services/financeiro/centralFinanceiroService.ts";
const SRC_CONF = "src/components/financeiro/ConferenciaFinanceira.tsx";

describe("TMS-FIN-CONF-UX-ORD-01 — A) ordenação por data operacional (desc)", () => {
  it("A) 25/09, 22/09, 18/09 => 25, 22, 18", () => {
    const itens = [
      { id: "c", dataFinalizacao: "2026-09-18T10:00:00Z", data: "2026-09-18" },
      { id: "a", dataFinalizacao: "2026-09-25T22:00:00Z", data: "2026-09-25" },
      { id: "b", dataFinalizacao: "2026-09-22T21:00:00Z", data: "2026-09-22" },
    ];
    expect(ordenarCentralFinanceiro(itens).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("fallback para data_escala quando data_finalizacao é NULL (não sobe para o topo)", () => {
    const itens = [
      { id: "old", dataFinalizacao: undefined, data: "2026-06-29T03:00:00Z" },
      { id: "recente", dataFinalizacao: "2026-09-25T22:00:00Z", data: "2026-09-25T03:00:00Z" },
      { id: "old2", dataFinalizacao: undefined, data: "2026-07-12T03:00:00Z" },
    ];
    expect(ordenarCentralFinanceiro(itens).map((i) => i.id)).toEqual(["recente", "old2", "old"]);
  });

  it("HML-FAT-FINAL-01 (25/09) antes de HML-FAT-01 (22/09)", () => {
    const final01 = { id: "fin01", dataFinalizacao: "2026-09-25T22:17:10Z", data: "2026-09-25" };
    const hml01 = { id: "hml01", dataFinalizacao: "2026-09-25T21:19:14Z", data: "2026-09-22" };
    expect(ordenarCentralFinanceiro([hml01, final01]).map((i) => i.id)).toEqual(["fin01", "hml01"]);
  });

  it("desempate estável por id DESC quando a data é igual", () => {
    const t = "2026-09-25T00:00:00Z";
    const r = ordenarCentralFinanceiro([{ id: "a", dataFinalizacao: t }, { id: "c", dataFinalizacao: t }, { id: "b", dataFinalizacao: t }]);
    expect(r.map((i) => i.id)).toEqual(["c", "b", "a"]);
    expect(compararCentralFinanceiro({ id: "a", dataFinalizacao: t }, { id: "b", dataFinalizacao: t })).toBe(1);
  });
});

describe("TMS-FIN-CONF-UX-ORD-01 — B/C/D) ordena ANTES da paginação", () => {
  it("B) service ordena o conjunto completo antes de retornar (fonte)", () => {
    const src = read(SRC_SVC);
    expect(src).toContain("return ordenarCentralFinanceiro(resultado)");
  });

  it("componente pagina DEPOIS (slice sobre o conjunto já ordenado)", () => {
    const src = read(SRC_CONF);
    const iSlice = src.indexOf("itens.slice(inicio, inicio + PAGE_SIZE_CONFERENCIA)");
    expect(iSlice).toBeGreaterThan(-1);
  });

  it("C/D) página 1 = mais recentes; página 2 continua; sem duplicar/omitir", () => {
    const itens = Array.from({ length: 7 }, (_, i) => ({ id: `x${i}`, dataFinalizacao: `2026-09-${String(10 + i).padStart(2, "0")}T00:00:00Z` }));
    const PAGE = 3;
    const all = ordenarCentralFinanceiro(itens);
    const p1 = all.slice(0, PAGE), p2 = all.slice(PAGE, 2 * PAGE);
    expect(p1.map((i) => i.id)).toEqual(["x6", "x5", "x4"]);
    expect(p2.map((i) => i.id)).toEqual(["x3", "x2", "x1"]);
    expect(new Set([...p1, ...p2].map((i) => i.id)).size).toBe(p2.length + p1.length); // sem duplicados
    expect([...p1, ...p2].map((i) => i.id)).toEqual(all.slice(0, 2 * PAGE).map((i) => i.id)); // sem omissões
  });
});

describe("TMS-FIN-CONF-UX-ORD-01 — E/F/G) busca/filtros preservam a ordem", () => {
  const base = [
    { id: "n1", dataFinalizacao: "2026-09-25T00:00:00Z", clienteId: "C1" },
    { id: "n2", dataFinalizacao: "2026-09-18T00:00:00Z", clienteId: "C2" },
    { id: "n3", dataFinalizacao: "2026-09-22T00:00:00Z", clienteId: "C1" },
  ];
  it("E) busca (subconjunto) mantém mais recente primeiro", () => {
    const busca = base.filter((i) => i.clienteId === "C1");
    expect(ordenarCentralFinanceiro(busca).map((i) => i.id)).toEqual(["n1", "n3"]);
  });
  it("F) filtro (subconjunto) mantém a ordem", () => {
    const filtro = base.filter((i) => i.id !== "n2");
    expect(ordenarCentralFinanceiro(filtro).map((i) => i.id)).toEqual(["n1", "n3"]);
  });
  it("G) paginação não cria duplicidade", () => {
    const all = ordenarCentralFinanceiro(base);
    expect(new Set(all.map((i) => i.id)).size).toBe(base.length);
  });
});

// ── Mock supabase: verifica default "Não faturado" + ordem no conjunto real ──
const H = vi.hoisted(() => {
  const row = (id: string, fin: string | null, esc: string, os: string | null) => ({
    id, ordem_servico_id: os, status: "concluida", finalizada: true,
    data_escala: esc, data_finalizacao: fin, cliente_id: "cli-1", prestador_id: "pr-1",
    tipo_veiculo: "Van", placa: "ABC1D23", origem: "A", destino: "B",
    valor_frete: 100, valor_repasse: 70, km_realizados: 10,
    clientes: { id: "cli-1", nome_fantasia: "Cliente Teste", razao_social: "Cliente Teste LTDA", cnpj: null },
    prestadores: { id: "pr-1", nome_completo: "Prestador Teste", cpf_cnpj: null },
    ordens_servico: os ? { id: os, numero: "OS-" + os, romaneio: "ROM-" + os } : null, metadata: {},
  });
  const ALOC = [
    row("al-jun", null, "2026-06-29T03:00:00Z", "os-jun"),
    row("al-2509", "2026-09-25T22:17:10Z", "2026-09-25T03:00:00Z", "os-2509"),
    row("al-1809", "2026-09-18T10:00:00Z", "2026-09-18T03:00:00Z", "os-1809"),
  ];
  const ITENS = [{ os_id: "os-2509", fatura_id: "f-1", faturas: { id: "f-1", numero: "FAT-1", status: "emitida" } }];
  const tableData: Record<string, unknown[]> = { alocacoes_escala: ALOC, fatura_itens: ITENS, faturas: [] };
  const chain = (data: unknown[]) => {
    const build = (): Record<string, unknown> => {
      const m: Record<string, unknown> = {}; const self = () => m;
      ["select", "eq", "neq", "in", "gte", "lte", "order", "limit", "range", "maybeSingle", "single", "contains", "returns"].forEach((k) => { m[k] = self; });
      m.then = (onf?: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(onf);
      return m;
    };
    return build();
  };
  return { from: (t: string) => chain(tableData[t] ?? []) };
});
vi.mock("@/lib/supabase", () => ({ supabase: { from: H.from } }));
beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("TMS-FIN-CONF-UX-ORD-01 — H/I/J) service: ordem + fila default preservada", () => {
  it("H/J) default 'nao_faturado' vem ordenado (mais recente primeiro) e sem o faturado", async () => {
    const { buscarCentralFinanceiro } = await import("@/services/financeiro/centralFinanceiroService");
    const fila = await buscarCentralFinanceiro({ faturado: "nao_faturado" });
    // al-2509 está faturado -> sai; restam al-1809 e al-jun, ordenados desc
    expect(fila.map((i) => i.id)).toEqual(["al-1809", "al-jun"]);
    expect(fila.every((i) => i.faturamento.status === "nao_faturado")).toBe(true);
  });
  it("I) faturado fora do default; J) 'todos' mostra histórico ordenado", async () => {
    const { buscarCentralFinanceiro } = await import("@/services/financeiro/centralFinanceiroService");
    const todos = await buscarCentralFinanceiro({ faturado: "todos" });
    expect(todos.map((i) => i.id)).toEqual(["al-2509", "al-1809", "al-jun"]);
  });
});

describe("TMS-FIN-CONF-UX-ORD-01 — K) contratos FAT-URG-04/05B intactos", () => {
  it("f_emitir_fatura continua exigindo aprovada; guard de status intacto", () => {
    const e4 = read("supabase/migrations/20260925000002_fin_fat_urg_04_emissao_exige_aprovacao.sql");
    const e5 = read("supabase/migrations/20260925000004_fin_fat_urg_05b_hardening_portas.sql");
    expect(e4).toContain("FATURA_NAO_APROVADA");
    expect(e5).toContain("FATURA_STATUS_SOMENTE_VIA_RPC");
  });
});
