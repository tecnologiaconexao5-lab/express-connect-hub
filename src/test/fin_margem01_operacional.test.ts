import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { montarMargens, resumirMargens, type ComposicaoRow, type OsInfo } from "@/helpers/margemOperacionalHelper";

const comp = (over: Partial<ComposicaoRow> = {}): ComposicaoRow => ({
  id: "c1", os_id: "os1", valor_cliente: 100, valor_prestador: 50, pedagio_valor: 10, margem_liquida: 45, ...over,
});

describe("TMS-FIN-MARGEM-01 — Margem Operacional (400 corrigido)", () => {
  it("A) componente NAO usa embed PostgREST os:ordens_servico!inner", () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), "src/components/financeiro/MargemOperacional.tsx"), "utf8");
    expect(src.includes("ordens_servico!inner")).toBe(false);
    expect(src.includes("os:ordens_servico")).toBe(false);
    // confirmou consulta em etapas por os_id
    expect(src.includes('.in("id", osIds)')).toBe(true);
  });

  it("B/C/D) resolve OS (numero), cliente e prestador corretos", () => {
    const osMap: Record<string, OsInfo> = { os1: { numero: "OS-777", cliente: "cli1", is_teste: false } };
    const out = montarMargens([comp()], osMap, { cli1: "Cliente Alfa" });
    expect(out[0].os_numero).toBe("OS-777");
    expect(out[0].cliente).toBe("Cliente Alfa");
    expect(out[0].valor_prestador).toBe(50);
  });

  it("E/F) receita e custo reais (separacao cliente != prestador)", () => {
    const osMap: Record<string, OsInfo> = { os1: { numero: "OS-1", cliente: "cli1", is_teste: false } };
    const out = montarMargens([comp({ valor_cliente: 1000, valor_prestador: 600, pedagio_valor: 50 })], osMap);
    expect(out[0].valor_cliente).toBe(1000);
    expect(out[0].valor_prestador).toBe(600);
    expect(out[0].pedagio_valor).toBe(50);
  });

  it("G) usa a margem REAL armazenada (nao recalcula formula)", () => {
    const osMap: Record<string, OsInfo> = { os1: { numero: "OS-1", is_teste: false, cliente: null } };
    // receita 100 - prestador 50 - pedagio 10 = 40 (calculado); armazenado = 45
    const out = montarMargens([comp({ margem_liquida: 45 })], osMap);
    expect(out[0].margem_liquida).toBe(45);
    const resumo = resumirMargens(out);
    expect(resumo.margemTotal).toBe(45);
    expect(resumo.receitaTotal).toBe(100);
    expect(resumo.custoTotal).toBe(60);
  });

  it("H) is_teste=true NAO infla o indicador", () => {
    const osMap: Record<string, OsInfo> = {
      os1: { numero: "OS-1", cliente: null, is_teste: false },
      os9: { numero: "OS-9", cliente: null, is_teste: true },
    };
    const out = montarMargens([comp({ id: "a", os_id: "os1" }), comp({ id: "b", os_id: "os9" })], osMap);
    expect(out.length).toBe(1);
    expect(out[0].os_numero).toBe("OS-1");
  });

  it("I) registro sem vinculo (OS orfa) NAO derruba a tela", () => {
    const out = montarMargens([comp({ id: "orf", os_id: "osX" })], {});
    expect(out.length).toBe(1);
    expect(out[0].os_numero).toBe("OS-osX".slice(0, 3) + "osX".slice(0, 5).slice(0, 8) || out[0].os_numero);
    expect(out[0].cliente).toBe("—");
    // sem os_id -> "Sem OS"
    const out2 = montarMargens([comp({ id: "sem", os_id: null })], {});
    expect(out2[0].os_numero).toBe("Sem OS");
  });

  it("J) filtros/pagina NAO distorcem cards (resumo usa conjunto completo)", () => {
    const osMap: Record<string, OsInfo> = {};
    const rows: ComposicaoRow[] = Array.from({ length: 30 }, (_, i) => {
      osMap[`os${i}`] = { numero: `OS-${i}`, cliente: null, is_teste: false };
      return comp({ id: `c${i}`, os_id: `os${i}`, valor_cliente: 100, valor_prestador: 50, pedagio_valor: 10, margem_liquida: 40 });
    });
    const full = montarMargens(rows, osMap);
    const pagina1 = full.slice(0, 25);
    expect(resumirMargens(full).receitaTotal).toBe(3000);
    expect(resumirMargens(pagina1).receitaTotal).toBe(2500); // pagina difere do total
    expect(resumirMargens(full).margemTotal).toBe(1200);
  });

  it("K) estado vazio funciona (sem NaN)", () => {
    const out = montarMargens([], {});
    expect(out).toEqual([]);
    const r = resumirMargens(out);
    expect(r).toEqual({ receitaTotal: 0, custoTotal: 0, margemTotal: 0, margemMedia: 0 });
  });

  it("trata valores nulos/ausentes sem NaN", () => {
    const osMap: Record<string, OsInfo> = { os1: { numero: null, cliente: null, is_teste: false } };
    const out = montarMargens([comp({ valor_cliente: null, valor_prestador: null, pedagio_valor: null, margem_liquida: null })], osMap);
    expect(Number.isFinite(out[0].valor_cliente)).toBe(true);
    expect(Number.isFinite(out[0].margem_liquida)).toBe(true);
    expect(out[0].os_numero).toBe("OS-os1".slice(0, 3) + "os1".slice(0, 5));
  });

  it("L) componente trata erro backend (setError em catch)", () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), "src/components/financeiro/MargemOperacional.tsx"), "utf8");
    expect(src.includes("setError(")).toBe(true);
    expect(src.includes("catch")).toBe(true);
    expect(src.includes("Erro ao carregar dados")).toBe(true);
  });
});
