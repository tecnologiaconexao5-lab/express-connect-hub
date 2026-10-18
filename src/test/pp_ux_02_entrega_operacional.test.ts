// ═══════════════════════════════════════════════════════════════════════════════
// PP-UX-02 — PAGAMENTO DE PRESTADORES: ENTREGA OPERACIONAL VISÍVEL
// Testes determinísticos, sem banco:
//   1. Paginação zero → "Exibindo 0 de 0" (nunca "null–null de 0")
//   2. Nomenclatura visível: "Gestão Financeira" e "Novo Lançamento"
//   3. Origem profissional (OS Direta / Programação Operacional / Manual)
//   4. Ações: tooltips presentes e sem ação morta "Ver Detalhes"
//   5. Repasses: ação "Gerar Repasse" removida (não duplica obrigação)
//   6. Conta Corrente: empty state profissional
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { formatRangeLabel } from "@/components/ui/PaginationBar";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const PP_SRC = "src/components/financeiro/PagamentoPrestadores.tsx";
const FIN_SRC = "src/pages/Financeiro.tsx";
const PAG_SRC = "src/components/ui/PaginationBar.tsx";

describe("PP-UX-02 — Paginação zero sem null", () => {
  it("totalCount=0 → 'Exibindo 0 de 0' e nunca null", () => {
    const label = formatRangeLabel(1, 25, 0);
    expect(label).toBe("Exibindo 0 de 0");
    expect(label).not.toMatch(/null/i);
    expect(label).not.toContain("undefined");
  });

  it("totalCount>0 mantém a faixa existente", () => {
    expect(formatRangeLabel(1, 25, 10)).toBe("Exibindo 1–10 de 10");
    expect(formatRangeLabel(2, 25, 30)).toBe("Exibindo 26–30 de 30");
  });

  it("totalCount=null → contagem desconhecida → 'Página N'", () => {
    expect(formatRangeLabel(3, 25, null)).toBe("Página 3");
  });

  it("PaginationBar consome formatRangeLabel (sem variáveis from/to frágeis)", () => {
    const src = read(PAG_SRC);
    expect(src).toContain("formatRangeLabel(page, pageSize, totalCount)");
    expect(src).not.toMatch(/const from = totalCount \?/);
    expect(src).not.toMatch(/const to = totalCount \?/);
  });
});

describe("PP-UX-02 — Nomenclatura visível", () => {
  it("título do módulo passa a ser 'Gestão Financeira' (rota/ID preservados)", () => {
    const src = read(FIN_SRC);
    expect(src).toContain("Gestão Financeira");
    expect(src).not.toContain("Financeiro e Rentabilidade");
    // rota/tab técnica preservada
    expect(src).toContain('value="pagamento-prestadores"');
  });

  it("botão verde vira 'Novo Lançamento' e está habilitado (FIN-PP-FUNC-01)", () => {
    const src = read(PP_SRC);
    expect(src).toContain("Novo Lançamento");
    expect(src).not.toContain("Novo Pagamento");
    expect(src).toContain("Criar obrigação manual de prestador");
    expect(src).not.toContain('title="Disponível após conclusão do fluxo de lançamento manual."');
  });
});

describe("PP-UX-02 — Origens profissionais", () => {
  const src = read(PP_SRC);

  it("mapa de origem com nomenclatura profissional", () => {
    expect(src).toContain("os_direta: \"OS Direta\"");
    expect(src).toContain("escala_direta: \"Programação Operacional\"");
    expect(src).toContain("manual: \"Manual\"");
  });

  it("helper labelOrigem é aplicado e não inventa origem desconhecida", () => {
    expect(src).toContain("const labelOrigem = (origem?: string | null): string =>");
    expect(src).toContain("ORIGEM_LABEL[origem] || origem");
  });
});

describe("PP-UX-02 — Ações com tooltip e sem botão morto", () => {
  const src = read(PP_SRC);

  it("tooltips profissionais presentes", () => {
    for (const t of ["Conferir", "Aprovar", "Reprovar", "Marcar como pago", "Ver detalhes", "Mais ações"]) {
      expect(src).toContain(`title="${t}"`);
    }
  });

  it("ações secundárias em menu '...' com rótulos claros", () => {
    expect(src).toContain("DropdownMenu");
    expect(src).toContain("Cancelar");
    expect(src).toContain("Estornar pagamento");
  });

  it("botão morto 'Ver Detalhes' (sem onClick) removido", () => {
    expect(src).not.toMatch(/title="Ver Detalhes">\s*<Eye/);
  });

  it("não usa alert/confirm/prompt", () => {
    expect(src).not.toMatch(/\balert\(/);
    expect(src).not.toMatch(/\bwindow\.confirm\(/);
    expect(src).not.toMatch(/\bprompt\(/);
  });
});

describe("PP-UX-02 — Repasses não duplicam obrigação", () => {
  const src = read(PP_SRC);

  it("ação 'Gerar Repasse' removida (sem duplicador)", () => {
    expect(src).not.toContain("Gerar Repasse");
    expect(src).not.toContain("handleGerarRepasse");
    expect(src).not.toContain("gerandoRepasseId");
  });

  it("a aba mantém 'Repasses da Programação' para consulta", () => {
    expect(src).toContain('Repasses da Programação');
    expect(src).toContain("Repasses da Programação Operacional");
  });
});

describe("PP-UX-02 — Conta Corrente", () => {
  const src = read(PP_SRC);

  it("empty state profissional da conta corrente", () => {
    expect(src).toContain("Nenhum lançamento na conta corrente deste prestador");
  });

  it("origem e status legíveis + moeda BRL", () => {
    expect(src).toContain("labelOrigem(e.origem)");
    expect(src).toContain("labelStatusGenerico(e.status)");
    expect(src).toContain("fmtMoeda(e.saldo)");
  });
});
