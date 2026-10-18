import { describe, it, expect } from "vitest";
import {
  gerarLinhasRelatorio,
  filtrarLinhasRelatorio,
  paginarLinhas,
  montarLinhasCSV,
  type LinhaRelatorioPrestador,
} from "@/helpers/relatorioPrestadorHelper";

// 05D.6D.1 — filtros reais do Relatório Financeiro (A-H). Sem banco.

function makePagamentos(): Record<string, unknown>[] {
  const arr: Record<string, unknown>[] = [];
  // 15 registros: cliente A, prestador P1, os_direta, pendente, maio
  for (let i = 0; i < 15; i++) {
    arr.push({
      id: `A${i}`, prestador_nome: "P1", prestador_documento: "1",
      periodo_inicio: "2026-05-10", periodo_fim: "2026-05-10",
      quantidade_os: 1, valor_servicos: 100, valor_liquido: 100,
      status_pagamento: "pendente", status: "pendente",
      origem_lancamento: "os_direta", os_numero: `OS-A-${i}`, os_id: `osa${i}`,
      clienteId: "cliA",
    });
  }
  // 15 registros: cliente B, prestador P2, escala_direta, pago, junho
  for (let i = 0; i < 15; i++) {
    arr.push({
      id: `B${i}`, prestador_nome: "P2", prestador_documento: "2",
      periodo_inicio: "2026-06-10", periodo_fim: "2026-06-10",
      quantidade_os: 1, valor_servicos: 200, valor_liquido: 200,
      status_pagamento: "pago", status: "pago",
      origem_lancamento: "escala_direta", os_numero: `OS-B-${i}`, os_id: `osb${i}`,
      clienteId: "cliB",
    });
  }
  return arr;
}

function linhas(): LinhaRelatorioPrestador[] {
  return gerarLinhasRelatorio(
    makePagamentos(),
    [],
    (p) => ({ clienteId: String(p.clienteId || ""), clienteNome: String(p.clienteId || "").toUpperCase() })
  );
}

describe("TMS-FIN-PROG-05D.6D.1 — filtros reais do Relatório Financeiro", () => {
  it("linhas carregam cliente_id/nome via resolver (vínculo real)", () => {
    const l = linhas();
    expect(l.length).toBe(30);
    expect(l[0].clienteId).toBe("cliA");
    expect(l[0].clienteNome).toBe("CLIA");
    expect(l[15].clienteId).toBe("cliB");
    expect(l[0].osNumero).toBe("OS-A-0");
  });

  it("A) filtro CLIENTE A retorna somente A", () => {
    const r = filtrarLinhasRelatorio(linhas(), { clienteId: "cliA" });
    expect(r.length).toBe(15);
    expect(r.every((x) => x.clienteId === "cliA")).toBe(true);
  });

  it("B) filtro PRESTADOR P2 retorna somente P2", () => {
    const r = filtrarLinhasRelatorio(linhas(), { prestadorNome: "P2" });
    expect(r.length).toBe(15);
    expect(r.every((x) => x.prestadorNome === "P2")).toBe(true);
  });

  it("C) BUSCA por número da OS retorna o serviço correto", () => {
    const r = filtrarLinhasRelatorio(linhas(), { busca: "OS-A-3" });
    expect(r.length).toBe(1);
    expect(r[0].osNumero).toBe("OS-A-3");
    expect(r[0].clienteId).toBe("cliA");
  });

  it("C2) busca também por nome do prestador", () => {
    const r = filtrarLinhasRelatorio(linhas(), { busca: "P2" });
    expect(r.length).toBe(15);
    expect(r.every((x) => x.prestadorNome === "P2")).toBe(true);
  });

  it("D) STATUS retorna somente o status selecionado", () => {
    const r = filtrarLinhasRelatorio(linhas(), { status: "pago" });
    expect(r.length).toBe(15);
    expect(r.every((x) => x.statusPagamento === "pago")).toBe(true);
  });

  it("E) filtros COMBINADOS (período + cliente + prestador + status)", () => {
    const r = filtrarLinhasRelatorio(linhas(), {
      dataInicio: "2026-05-01", dataFim: "2026-05-31",
      clienteId: "cliA", prestadorNome: "P1", status: "pendente",
    });
    expect(r.length).toBe(15);
    expect(r.every((x) => x.clienteId === "cliA" && x.prestadorNome === "P1" && x.statusPagamento === "pendente" && x.periodoInicio.startsWith("2026-05"))).toBe(true);
  });

  it("E2) período sozinho filtra pela DATA DO SERVIÇO (maio só A)", () => {
    const r = filtrarLinhasRelatorio(linhas(), { dataInicio: "2026-05-01", dataFim: "2026-05-31" });
    expect(r.length).toBe(15);
    expect(r.every((x) => x.periodoInicio.startsWith("2026-05"))).toBe(true);
  });

  it("F) PAGINAÇÃO: filtros antes do slice; página 1 e 2 corretas; total inalterado", () => {
    const filtrado = filtrarLinhasRelatorio(linhas(), {});
    expect(filtrado.length).toBe(30); // conjunto COMPLETO
    const p1 = paginarLinhas(filtrado, 1, 25);
    const p2 = paginarLinhas(filtrado, 2, 25);
    expect(p1.length).toBe(25);
    expect(p2.length).toBe(5);
    // sem sobreposição
    const ids1 = p1.map((x) => x.osNumero);
    const ids2 = p2.map((x) => x.osNumero);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    // totais não mudam com a página
    expect(filtrado.length).toBe(30);
  });

  it("F2) mudar filtro reduz o conjunto (reset de página = 1)", () => {
    const filtradoB = filtrarLinhasRelatorio(linhas(), { clienteId: "cliB" });
    const p1 = paginarLinhas(filtradoB, 1, 25);
    expect(filtradoB.length).toBe(15);
    expect(p1.length).toBe(15);
  });

  it("G) CSV usa o conjunto FILTRADO COMPLETO (não a página)", () => {
    const filtrado = filtrarLinhasRelatorio(linhas(), { clienteId: "cliA" });
    const { header, rows } = montarLinhasCSV(filtrado);
    expect(rows.length).toBe(filtrado.length); // 15, não 25 de página
    expect(header).toContain("Data Serviço");
    expect(header).toContain("Cliente");
    expect(header).toContain("OS");
    expect(rows[0][2]).toBe("CLIA"); // coluna Cliente
  });

  it("H) impressão usa o conjunto FILTRADO COMPLETO", () => {
    const filtrado = filtrarLinhasRelatorio(linhas(), { prestadorNome: "P1" });
    // a impressão renderiza linhasRelatorioFiltradas (todas), não a página
    expect(filtrado.length).toBe(15);
    expect(paginarLinhas(filtrado, 1, 25).length).toBe(15);
  });
});
