// ═══════════════════════════════════════════════════════════════════════════════
// FIN-BUG-06 — BADGE × TABELA da Caixa de Entrada (fim do "filtro esquizofrênico")
// Determinístico, sem banco:
//   1. Predicado da inbox NÃO considera período/datas → pendência antiga aparece.
//   2. A busca da inbox (fetchPendentesAprovacao) NÃO usa dataInicio/dataFim.
//   3. Badge e tabela consomem o MESMO array (filaAprovacao) → mesmo length.
//   4. Revalidação da inbox nos fluxos (mount, Atualizar, criar, aprovar).
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { estaPendenteAprovacao, resumirFilaAprovacao } from "@/helpers/pagamentoPrestadorView";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const COMP = "src/components/financeiro/PagamentoPrestadores.tsx";
const src = read(COMP);

const pendente = {
  prestador_id: "p1",
  prestador_nome: "PRESTADOR A",
  valor_liquido: 810.4,
  status: "pendente",
  status_aprovacao: "aguardando_aprovacao",
  status_pagamento: "pendente",
  is_teste: false,
};

describe("FIN-BUG-06 — predicado da inbox ignora período", () => {
  it("pendência de mês anterior continua pendente (nenhuma data no predicado)", () => {
    // data antiga no payload NÃO é considerada pelo predicado
    expect(estaPendenteAprovacao({ ...pendente, data_competencia: "2026-06-29", periodo_inicio: "2026-06-01", periodo_fim: "2026-06-30" })).toBe(true);
    expect(estaPendenteAprovacao({ ...pendente, data_competencia: "2026-10-07" })).toBe(true);
  });

  it("sai da fila apenas quando aprovado/reprovado/cancelado/teste", () => {
    expect(estaPendenteAprovacao({ ...pendente, status_aprovacao: "aprovado" })).toBe(false);
    expect(estaPendenteAprovacao({ ...pendente, status_aprovacao: "rejeitado" })).toBe(false);
    expect(estaPendenteAprovacao({ ...pendente, status: "cancelado" })).toBe(false);
    expect(estaPendenteAprovacao({ ...pendente, status_pagamento: "cancelado" })).toBe(false);
    expect(estaPendenteAprovacao({ ...pendente, is_teste: true })).toBe(false);
  });

  it("badge (resumo) e tabela (length) convergem para o mesmo conjunto", () => {
    const rows = [
      { ...pendente, id: "a", data_competencia: "2026-06-29" }, // mês anterior
      { ...pendente, id: "b", data_competencia: "2026-10-07" },
      { ...pendente, id: "c", status_aprovacao: "aprovado" },
    ];
    const fila = rows.filter(estaPendenteAprovacao);
    const resumo = resumirFilaAprovacao(rows);
    expect(fila).toHaveLength(2);              // tabela
    expect(resumo.pendentes.qtd).toBe(2);      // badge / card
  });
});

describe("FIN-BUG-06 — busca da inbox sem filtro de período", () => {
  const ini = src.indexOf("const fetchPendentesAprovacao");
  const fim = src.indexOf("const fetchPagamentos = async", ini);
  const fetchBody = src.slice(ini, fim);

  it("fetchPendentesAprovacao não referencia dataInicio/dataFim", () => {
    expect(ini).toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(ini);
    expect(fetchBody).not.toContain("dataInicio");
    expect(fetchBody).not.toContain("dataFim");
    expect(fetchBody).not.toContain("periodo_inicio");
    expect(fetchBody).not.toContain("filtroPrestadorId");
    expect(fetchBody).not.toContain("filtroOrigem");
  });

  it("busca apenas status_aprovacao = aguardando_aprovacao (somente leitura)", () => {
    expect(fetchBody).toContain('.eq("status_aprovacao", "aguardando_aprovacao")');
    expect(fetchBody).toContain('.eq("is_teste", false)');
    expect(fetchBody).toContain('.select("*")');
    expect(fetchBody).not.toContain(".insert(");
    expect(fetchBody).not.toContain(".update(");
    expect(fetchBody).not.toContain(".delete(");
  });

  it("a inbox não depende do estado `pagamentos` (recortado por data)", () => {
    const iniFila = src.indexOf("const filaAprovacao = useMemo(");
    const fila = src.slice(iniFila, src.indexOf(");", iniFila));
    expect(fila).toContain("pendentesAprovacao");
    expect(fila).not.toContain("pagamentos ||");
    expect(fila).toContain("estaPendenteAprovacao");
  });
});

describe("FIN-BUG-06 — badge e tabela usam a MESMA fonte", () => {
  it("badge da aba e empty-state/tabela usam filaAprovacao", () => {
    expect(src).toContain("{filaAprovacao.length}");            // badge laranja
    expect(src).toContain("filaAprovacao.length === 0 ?");      // empty state
    expect(src).toContain("filaAprovacao.map((p) => {");        // linhas da tabela
  });

  it("inbox é recarregada nos fluxos (mount, Atualizar, criar, aprovar/status)", () => {
    const ocorrencias = (src.match(/fetchPendentesAprovacao\(\)/g) || []).length;
    // definição + 1 dentro da chamada do service? não: chamadas explícitas
    expect(ocorrencias).toBeGreaterThanOrEqual(5); // mount, Atualizar, criar, status, aprovarDaFila
    expect(src).toContain("fetchPendentesAprovacao(); }");
  });

  it("card 'Aguardando aprovação' reflete a fila global; período só nos cards de período", () => {
    expect(src).toContain("resumoFila.pendentes.valor");
    expect(src).toContain("resumoPeriodo.aprovados.valor");
    expect(src).toContain("resumoPeriodo.pagosMes.valor");
    expect(src).toContain("Fila global — independe do filtro de período");
  });
});
