// ═══════════════════════════════════════════════════════════════════════════════
// TMS-FIN-AR-UX-01 — Nome / Ordenação global / Editar recebível
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ordenarRecebiveis } from "@/helpers/ordenacaoRecebiveis";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const SIDEBAR = "src/lib/sidebarData.ts";
const TOPBAR = "src/components/AppTopbar.tsx";
const SRC_CR = "src/components/financeiro/ContasReceberEnterprise.tsx";
const SRC_SVC = "src/services/financeiro/receberService.ts";

const H = vi.hoisted(() => {
  const rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const updates: Array<Record<string, unknown>> = [];
  const chain = (result: unknown) => {
    const m: Record<string, unknown> = {};
    const self = () => m;
    ["select", "eq", "neq", "in", "gte", "lte", "order", "limit", "range", "contains", "returns"].forEach((k) => { m[k] = self; });
    m.update = (p: Record<string, unknown>) => { updates.push(p); return self(); };
    m.insert = () => self();
    m.maybeSingle = () => Promise.resolve(result);
    m.single = () => Promise.resolve(result);
    m.then = (onf?: (v: unknown) => unknown) => Promise.resolve(result).then(onf);
    return m;
  };
  const from = () => chain({ data: { id: "r1", status: "aberto", observacoes: "ok" }, error: null });
  const rpc = (name: string, args: Record<string, unknown>) => {
    rpcs.push({ name, args });
    return Promise.resolve({ data: { recebivel_id: "novo", criado: true }, error: null });
  };
  return { rpcs, updates, from, rpc };
});

vi.mock("@/lib/supabase", () => ({ supabase: { from: H.from, rpc: H.rpc } }));

beforeEach(() => { vi.resetModules(); H.rpcs.length = 0; H.updates.length = 0; });
afterEach(() => { vi.restoreAllMocks(); });

describe("TMS-FIN-AR-UX-01 — A) Nomenclatura visível", () => {
  it('sidebar e topbar exibem "Gestão Financeira" e não "Financeiro Enterprise"', () => {
    const side = read(SIDEBAR);
    const top = read(TOPBAR);
    expect(side).toContain('title: "Gestão Financeira"');
    expect(top).toContain('titulo: "Gestão Financeira"');
    expect(side).not.toContain("Financeiro Enterprise");
    expect(top).not.toContain("Financeiro Enterprise");
  });
});

describe("TMS-FIN-AR-UX-01 — B/C/D) Ordenação GLOBAL por created_at antes da paginação", () => {
  const base = [
    { id: "e", createdAt: "2026-09-10T10:00:00Z" },
    { id: "c", createdAt: "2026-09-26T00:24:13Z" }, // mais recente (FAT-2026-000020-like)
    { id: "a", createdAt: "2026-09-01T10:00:00Z" },
    { id: "d", createdAt: "2026-09-15T10:00:00Z" },
    { id: "b", createdAt: "2026-09-20T10:00:00Z" },
  ];

  it("B) mais recente -> mais antigo (createdAt desc) com desempate por id", () => {
    const ord = ordenarRecebiveis(base, "recente_desc").map((x) => x.id);
    expect(ord).toEqual(["c", "b", "d", "e", "a"]);
  });

  it("C/D) página 1 recebe os mais recentes; página 2 os posteriores, sem duplicar/omitir", () => {
    const PAGE = 2;
    const all = [...base, { id: "f", createdAt: "2026-09-05T10:00:00Z" }];
    const sorted = ordenarRecebiveis(all, "recente_desc");
    const page1 = sorted.slice(0, PAGE);
    const page2 = sorted.slice(PAGE, 2 * PAGE);
    expect(page1.map((x) => x.id)).toEqual(["c", "b"]);
    expect(page2.map((x) => x.id)).toEqual(["d", "e"]);
    // sem duplicação/omissão
    expect([...page1, ...page2].map((x) => x.id)).toEqual(sorted.slice(0, 4).map((x) => x.id));
    expect(new Set(sorted.map((x) => x.id)).size).toBe(all.length);
  });

  it("desempate estável por id (asc) quando createdAt é igual", () => {
    const t = "2026-09-25T00:00:00Z";
    const ord = ordenarRecebiveis([{ id: "a", createdAt: t }, { id: "c", createdAt: t }, { id: "b", createdAt: t }], "recente_desc").map((x) => x.id);
    expect(ord).toEqual(["a", "b", "c"]);
  });
});

describe("TMS-FIN-AR-UX-01 — E/F) busca/filtros preservam a ordenação global", () => {
  const rows = [
    { id: "x1", createdAt: "2026-09-10T00:00:00Z", clienteId: "C1" },
    { id: "x2", createdAt: "2026-09-26T00:00:00Z", clienteId: "C1" },
    { id: "x3", createdAt: "2026-09-01T00:00:00Z", clienteId: "C2" },
  ];
  it("E) busca (subconjunto) mantém ordem mais recente primeiro", () => {
    const busca = rows.filter((r) => r.clienteId === "C1");
    expect(ordenarRecebiveis(busca, "recente_desc").map((r) => r.id)).toEqual(["x2", "x1"]);
  });
  it("F) filtro (subconjunto) mantém ordem mais recente primeiro", () => {
    const filtro = rows.filter((r) => r.id !== "x3");
    expect(ordenarRecebiveis(filtro, "recente_desc").map((r) => r.id)).toEqual(["x2", "x1"]);
  });
  it("componente: sort do conjunto completo ANTES do slice de paginação", () => {
    const src = read(SRC_CR);
    const iSort = src.indexOf("return ordenarRecebiveis(result, ordenacao)");
    const iSlice = src.indexOf("filtrados.slice((page - 1) * PAGE_SIZE");
    expect(iSort).toBeGreaterThan(-1);
    expect(iSlice).toBeGreaterThan(-1);
    expect(iSort).toBeLessThan(iSlice); // ordena antes de paginar
  });
});

describe("TMS-FIN-AR-UX-01 — G/H/I) Editar NÃO altera status", () => {
  it("componente: ao editar, NÃO envia status no payload", () => {
    const src = read(SRC_CR);
    expect(src).toContain('recebivelSelecionado?.id ? {} : { status: novaReceita.status || "pendente" }');
  });

  it("service: atualizarRecebivel sem status não valida status e não envia 'status'", async () => {
    const svc = await import("@/services/financeiro/receberService");
    await svc.atualizarRecebivel("r1", { observacoes: "editado", valor_bruto: 150 });
    expect(H.updates.length).toBe(1);
    expect("status" in H.updates[0]).toBe(false);
  });

  it("service: editar valores/campos permitidos preserva status (sem status no update)", async () => {
    const svc = await import("@/services/financeiro/receberService");
    await svc.atualizarRecebivel("r1", { valor_bruto: 200, data_vencimento: "2026-11-01", observacoes: "x" });
    expect("status" in H.updates[0]).toBe(false);
  });
});

describe("TMS-FIN-AR-UX-01 — J/K) PAGO continua bloqueado; baixa é o caminho oficial", () => {
  it("J) atualização direta para 'pago' é BLOQUEADA", async () => {
    const svc = await import("@/services/financeiro/receberService");
    await expect(svc.atualizarRecebivel("r1", { status: "pago" })).rejects.toThrow(/pago/i);
  });

  it("J) criação direta com 'pago' é BLOQUEADA (e não chama RPC)", async () => {
    const svc = await import("@/services/financeiro/receberService");
    await expect(
      svc.criarRecebivel({ cliente_id: "c1", data_vencimento: "2026-10-25", valor_bruto: 100, status: "pago" } as never)
    ).rejects.toThrow(/criar|pago/i);
    expect(H.rpcs.length).toBe(0);
  });

  it("K) baixarRecebivel usa a RPC oficial f_registrar_baixa_financeira", () => {
    const src = read(SRC_SVC);
    expect(src).toContain('rpc("f_registrar_baixa_financeira"');
  });

  it("status select do modal não oferece mais 'Pago' no cadastro", () => {
    const src = read(SRC_CR);
    expect(src).not.toContain('<SelectItem value="pago">Pago</SelectItem>');
  });
});
