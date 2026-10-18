// ═══════════════════════════════════════════════════════════════════════════════
// FIN-BUG-05 — LIMPEZA DE INTERFACE (Pagamento de Prestadores)
// Determinístico, sem banco — apenas estrutura do componente:
//   1. Um único botão "Novo Lançamento" (cabeçalho global) e um único "Atualizar"
//      (barra de filtros) — sem duplicados na zona inferior.
//   2. Separação de visões: só "Pendentes de Aprovação" e "Aptos para Lote"
//      expostas; as demais consolidadas em "Mais visões".
//   3. Fila de aprovação imediatamente visível (tabela antes dos cards resumo).
//   4. Nenhuma capacidade removida: todas as visões continuam renderizáveis.
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const COMP = "src/components/financeiro/PagamentoPrestadores.tsx";
const src = read(COMP);

describe("FIN-BUG-05 — sem botões duplicados", () => {
  it("apenas UM botão 'Novo Lançamento' (cabeçalho global)", () => {
    const ocorrencias = src.match(/>\s*Novo Lançamento\s*</g) || [];
    expect(ocorrencias).toHaveLength(1);
    expect((src.match(/setShowNovoPagamento\(true\)/g) || [])).toHaveLength(1);
  });

  it("apenas UM botão 'Atualizar' no corpo da tela (barra de filtros)", () => {
    const ocorrencias = src.match(/>\s*Atualizar\s*</g) || [];
    expect(ocorrencias).toHaveLength(1);
  });

  it("rótulo redundante 'Detalhamento — Fechamentos e Pagamentos' removido", () => {
    expect(src).not.toContain("Detalhamento — Fechamentos e Pagamentos");
  });
});

describe("FIN-BUG-05 — separadores consolidados", () => {
  it("TabsList interna expõe apenas Pendentes + Aptos para Lote", () => {
    const ini = src.indexOf('<TabsList className="h-auto w-full justify-start gap-1 rounded-lg border border-border/60 bg-card p-1"');
    const tabs = src.slice(ini, src.indexOf("</TabsList>", ini));
    expect(tabs).toContain('value="pendentes"');
    expect(tabs).toContain('value="aptos"');
    expect(tabs).not.toContain('value="periodo"');
    expect(tabs).not.toContain('value="manuais"');
    expect(tabs).not.toContain('value="anteriores"');
    expect(tabs).not.toContain('value="repasses"');
  });

  it("visões secundárias consolidadas no menu 'Mais visões'", () => {
    expect(src).toContain("Mais visões");
    for (const v of ["periodo", "manuais", "anteriores", "repasses"]) {
      expect(src).toContain(`setSubAba("${v}")`);
    }
    // rótulos preservados no menu (navegação continua possível)
    expect(src).toContain("Visão do Período");
    expect(src).toContain("Pagamentos Manuais");
    expect(src).toContain("Fechamentos Anteriores");
    expect(src).toContain("Repasses da Programação");
  });

  it("nenhuma capacidade removida: todas as visões continuam renderizáveis", () => {
    for (const v of ["pendentes", "periodo", "aptos", "manuais", "anteriores", "repasses"]) {
      expect(src).toContain(`<TabsContent value="${v}"`);
    }
  });

  it("abas de primeiro nível preservadas", () => {
    for (const v of ["dashboard", "listagem", "relatorio", "conta-corrente"]) {
      expect(src).toContain(`value="${v}"`);
    }
  });
});

describe("FIN-BUG-05 — fila de aprovação imediatamente visível", () => {
  const pend = src.slice(src.indexOf('<TabsContent value="pendentes"'));

  // FIN-BUG-07 moveu o resumo bancário para o TOPO da aba (hierarquia premium).
  // A tabela da fila continua imediatamente após o título da Caixa de Entrada.
  it("título e tabela da fila presentes e ordenados (resumo no topo — FIN-BUG-07)", () => {
    const posTitulo = pend.indexOf("Caixa de Entrada — Pendentes de Aprovação");
    const posTabela = pend.indexOf("<Table>");
    const posCardsResumo = pend.indexOf("lançamento(s) na fila"); // card "Aguardando aprovação"
    expect(posTitulo).toBeGreaterThan(-1);
    expect(posTabela).toBeGreaterThan(posTitulo);
    expect(posCardsResumo).toBeGreaterThan(-1);
  });

  it("cards de resumo continuam presentes (dashboard bancário)", () => {
    for (const t of ["Aguardando aprovação", "Aprovados a pagar", "Bloqueados", "Pago no período"]) {
      expect(pend).toContain(t);
    }
  });
});
