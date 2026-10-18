// ═══════════════════════════════════════════════════════════════════════════════
// PP-UX-03 — REORGANIZAÇÃO VISUAL PROFISSIONAL (Pagamento de Prestadores)
// Testes determinísticos, sem banco:
//   1. Relatório: cards de totais ACIMA da tabela
//   2. Visão do Período: resumo acima da tabela + empty state limpo
//   3. Aptos para Lote: indicadores acima; ações próximas da tabela
//   4. Conta Corrente: resumo (saldo/créditos/débitos) antes do extrato
//   5. Períodos sem "— a —" (fmtPeriodo)
//   6. Repasses: somente consulta (sem Gerar Repasse)
//   7. Empty states profissionais
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fmtPeriodo, nomeOuNaoInformado } from "@/helpers/periodoHelper";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const PP_SRC = "src/components/financeiro/PagamentoPrestadores.tsx";
const src = read(PP_SRC);

describe("PP-UX-03 — fmtPeriodo nunca exibe '— a —'", () => {
  it("ambos ausentes => 'Não informado'", () => {
    expect(fmtPeriodo(null, null)).toBe("Não informado");
    expect(fmtPeriodo("", "")).toBe("Não informado");
    expect(fmtPeriodo(undefined, undefined)).toBe("Não informado");
  });

  it("um lado só => 'A partir de'/'Até' (sem dangling 'a')", () => {
    expect(fmtPeriodo("2026-09-18", null)).toBe("A partir de 18/09/2026");
    expect(fmtPeriodo(null, "2026-09-30")).toBe("Até 30/09/2026");
  });

  it("mesmo dia => data única; intervalo => 'X a Y'", () => {
    expect(fmtPeriodo("2026-09-18", "2026-09-18")).toBe("18/09/2026");
    expect(fmtPeriodo("2026-09-01", "2026-09-30")).toBe("01/09/2026 a 30/09/2026");
  });

  it("nome ausente => 'Não informado'", () => {
    expect(nomeOuNaoInformado("")).toBe("Não informado");
    expect(nomeOuNaoInformado(null)).toBe("Não informado");
    expect(nomeOuNaoInformado("  ")).toBe("Não informado");
    expect(nomeOuNaoInformado("PRESTADOR TESTE APP")).toBe("PRESTADOR TESTE APP");
  });

  it("o componente não contém mais o padrão antigo '— a —'", () => {
    expect(src).not.toContain('{l.periodoInicio || "—"} a ');
    expect(src).not.toContain("?.slice(0,10)} a {");
    expect(src).toContain("fmtPeriodo(");
  });
});

describe("PP-UX-03 — Relatório Financeiro: totais ACIMA da tabela", () => {
  it("os 4 cards aparecem antes do <Table> do relatório", () => {
    const rel = src.slice(src.indexOf("Relatório Financeiro de Prestadores"));
    const posServicos = rel.indexOf("Total Serviços");
    const posTable = rel.indexOf("<Table>");
    expect(posServicos).toBeGreaterThan(-1);
    expect(posTable).toBeGreaterThan(-1);
    expect(posServicos).toBeLessThan(posTable);
  });

  it("ordem dos cards: Serviços, Adicionais, Descontos, Líquido", () => {
    const rel = src.slice(src.indexOf("Relatório Financeiro de Prestadores"));
    const seq = ["Total Serviços", "Total Adicionais", "Total Descontos", "Total Líquido"].map((t) => rel.indexOf(t));
    expect(seq.every((i) => i > -1)).toBe(true);
    expect(seq).toEqual([...seq].sort((a, b) => a - b));
  });

  it("filtros/status/imprimir/exportar entre os cards e a tabela", () => {
    const rel = src.slice(src.indexOf("Relatório Financeiro de Prestadores"));
    const posCards = rel.indexOf("Total Serviços");
    const posStatus = rel.indexOf("filtroStatusRelatorio");
    const posTable = rel.indexOf("<Table>");
    expect(posCards).toBeLessThan(posStatus);
    expect(posStatus).toBeLessThan(posTable);
  });
});

describe("PP-UX-03 — Visão do Período", () => {
  it("resumo financeiro (cards) antes da tabela", () => {
    const per = src.slice(src.indexOf('<TabsContent value="periodo"'));
    expect(per.indexOf("Total títulos no período")).toBeLessThan(per.indexOf("<Table>"));
  });

  it("empty state limpo quando não há registros", () => {
    expect(src).toContain("prestadorRows.length === 0");
    expect(src).toContain("Ajuste os filtros de período, prestador ou origem");
  });
});

describe("PP-UX-03 — Aptos para Lote", () => {
  it("indicadores acima da tabela", () => {
    const apt = src.slice(src.indexOf('<TabsContent value="aptos"'));
    const posCards = apt.indexOf("Total líquido (filtro)");
    const posTable = apt.indexOf("<Table>");
    expect(posCards).toBeGreaterThan(-1);
    expect(posCards).toBeLessThan(posTable);
  });

  it("ações de seleção/lote ficam abaixo dos indicadores (próximas da tabela)", () => {
    const apt = src.slice(src.indexOf('<TabsContent value="aptos"'));
    const posIndic = apt.indexOf("Total líquido (filtro)");
    const posAcoes = apt.indexOf("Gerar Ordem/Lote de Pagamento");
    const posTable = apt.indexOf("<Table>");
    expect(posIndic).toBeLessThan(posAcoes);
    expect(posAcoes).toBeLessThan(posTable);
  });
});

describe("PP-UX-03 — Conta Corrente", () => {
  it("resumo (saldo/créditos/débitos) ANTES do extrato", () => {
    const cc = src.slice(src.indexOf("Conta Corrente do Prestador"));
    const posSaldo = cc.indexOf("Saldo atual");
    const posCreditos = cc.indexOf("Total créditos");
    const posDebitos = cc.indexOf("Total débitos");
    const posTable = cc.indexOf("<Table>");
    expect([posSaldo, posCreditos, posDebitos].every((i) => i > -1)).toBe(true);
    expect(posSaldo).toBeLessThan(posTable);
    expect(posCreditos).toBeLessThan(posTable);
    expect(posDebitos).toBeLessThan(posTable);
  });

  it("empty state profissional do extrato", () => {
    expect(src).toContain("Nenhum lançamento na conta corrente deste prestador");
  });

  it("seleção responsiva (sem largura fixa w-1/3)", () => {
    expect(src).toContain("w-full sm:w-1/2 lg:w-1/3");
    expect(src).not.toContain('className="w-1/3"');
  });
});

describe("PP-UX-03 — Repasses da Programação (somente consulta)", () => {
  it("sem ação duplicadora 'Gerar Repasse'", () => {
    expect(src).not.toContain("Gerar Repasse");
    expect(src).not.toContain("handleGerarRepasse");
  });

  it("título e empty state profissionais", () => {
    expect(src).toContain("Repasses da Programação Operacional");
    expect(src).toContain("Nenhum repasse pendente da Programação Operacional");
    expect(src).toContain("provisionados automaticamente pela Programação Operacional");
  });
});

describe("PP-UX-03 — Empty states", () => {
  it("Aptos para lote possui empty state", () => {
    expect(src).toContain("Nenhum pagamento apto para lote");
  });
});
