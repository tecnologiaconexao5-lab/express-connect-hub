/**
 * CLIENTES-01 — Ordenação A→Z global + paginação numerada + busca global.
 *
 * Cobre a lógica de paginação (buildPageList) e o wiring da listagem
 * (ordenação no servidor ANTES da paginação; busca server-side sobre a base
 * completa). A prova real no banco é feita por script dedicado (ver relatório).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildPageList } from "@/components/ui/PaginationBar";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const LISTA = readSrc("src/components/clientes/ClientesLista.tsx");
const PAG = readSrc("src/components/ui/PaginationBar.tsx");

describe("CLIENTES-01 — paginação numerada (buildPageList)", () => {
  it("2 páginas → [1, 2]", () => {
    expect(buildPageList(1, 2)).toEqual([1, 2]);
    expect(buildPageList(2, 2)).toEqual([1, 2]);
  });

  it("muitas páginas → janela com reticências", () => {
    expect(buildPageList(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
  });

  it("primeira e última páginas corretas", () => {
    expect(buildPageList(1, 10)[0]).toBe(1);
    expect(buildPageList(10, 10).at(-1)).toBe(10);
  });

  it("total 0 → lista vazia", () => {
    expect(buildPageList(1, 0)).toEqual([]);
  });
});

describe("CLIENTES-01 — wiring da listagem (ordenação antes da paginação)", () => {
  it("ordena A→Z no servidor (razao_social asc, nulls last) + desempate nome_fantasia", () => {
    expect(LISTA).toContain('.order("razao_social", { ascending: true, nullsFirst: false })');
    expect(LISTA).toContain('.order("nome_fantasia", { ascending: true, nullsFirst: false })');
  });

  it("paginação no servidor via .range(from, to)", () => {
    expect(LISTA).toContain(".range(from, to)");
  });

  it("busca server-side sobre a BASE COMPLETA (.or + ilike nos campos suportados)", () => {
    expect(LISTA).toContain("query.or(");
    expect(LISTA).toContain("razao_social.ilike.");
    expect(LISTA).toContain("nome_fantasia.ilike.");
    expect(LISTA).toContain("cnpj.ilike.");
    expect(LISTA).toContain("email.ilike.");
    expect(LISTA).toContain("telefone.ilike.");
  });

  it("não filtra localmente a página atual (busca é global)", () => {
    expect(LISTA).not.toContain("clientes.filter(");
    expect(LISTA).toContain("const filtered = clientes;");
  });

  it("renderiza a PaginationBar (numerada)", () => {
    expect(LISTA).toContain("<PaginationBar");
  });

  it("reset para a página 1 ao mudar a busca", () => {
    expect(LISTA).toMatch(/setPage\(1\)/);
  });
});

describe("CLIENTES-01 — PaginationBar numerada", () => {
  it("expõe Anterior e Próxima", () => {
    expect(PAG).toContain("Anterior");
    expect(PAG).toContain("Próxima");
  });

  it("desabilita Anterior na primeira e Próxima na última página", () => {
    expect(PAG).toContain("canPrev");
    expect(PAG).toContain("canNext");
    expect(PAG).toContain("disabled={!canPrev");
    expect(PAG).toContain("disabled={!canNext");
  });

  it("identifica a página atual (aria-current)", () => {
    expect(PAG).toContain('aria-current={p === page ? "page"');
  });
});
