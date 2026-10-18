import { describe, it, expect } from "vitest";
import { isAptoLote, filtrarAptosLote, totalLiquidoAptos, type LinhaLote } from "@/helpers/lotePagamentoHelper";
import { paginarLinhas } from "@/helpers/relatorioPrestadorHelper";

const apto = (over: Partial<LinhaLote> = {}): LinhaLote => ({
  id: "x", prestador_id: "pr1", prestador_nome: "P1", cliente_id: "cliA", cliente_nome: "Cliente A",
  valor_liquido: 100, valor_servicos: 100, pedagio: 0, adicionais: 0,
  periodo_inicio: "2026-05-10", periodo_fim: "2026-05-10",
  status_conferencia: "conferido", status_aprovacao: "aprovado", elegivel_lote: true,
  status_pagamento: "pendente", lote_id: null, is_teste: false, tipo_pagamento: null,
  origem_lancamento: "os_direta", os_numero: "OS-1", ...over,
});

describe("TMS-FIN-PROG-05D.7B.3 — Fila Aptos para Lote (todas as origens)", () => {
  it("A/B/C) os_direta, escala_direta e manual legitimas sao aptas", () => {
    const rows = [
      apto({ id: "os", origem_lancamento: "os_direta" }),
      apto({ id: "esc", origem_lancamento: "escala_direta" }),
      apto({ id: "man", origem_lancamento: "manual" }),
    ];
    expect(filtrarAptosLote(rows, {}).map((r) => r.id).sort()).toEqual(["esc", "man", "os"]);
  });

  it("D-I) teste/pago/cancelado/agregado/ja-em-lote/aprovado+elegivel=false NAO entram", () => {
    const rows = [
      apto({ id: "ok" }),
      apto({ id: "teste", is_teste: true }),
      apto({ id: "pago", status_pagamento: "pago" }),
      apto({ id: "canc", status_pagamento: "cancelado" }),
      apto({ id: "agreg", tipo_pagamento: "fechamento" }),
      apto({ id: "loteado", lote_id: "L1" }),
      apto({ id: "sem_eleg", elegivel_lote: false }),
    ];
    const out = filtrarAptosLote(rows, {}).map((r) => r.id);
    expect(out).toEqual(["ok"]);
    expect(isAptoLote(rows[1])).toBe(false);
    expect(isAptoLote(rows[6])).toBe(false);
  });

  it("filtro ORIGEM Programação retorna somente escala_direta", () => {
    const rows = [apto({ id: "os", origem_lancamento: "os_direta" }), apto({ id: "esc", origem_lancamento: "escala_direta" })];
    expect(filtrarAptosLote(rows, { origem: "escala" }).map((r) => r.id)).toEqual(["esc"]);
  });

  it("filtro PRESTADOR e CLIENTE por ID real", () => {
    const rows = [apto({ id: "a", prestador_id: "pr1", cliente_id: "cliA" }), apto({ id: "b", prestador_id: "pr2", cliente_id: "cliB" })];
    expect(filtrarAptosLote(rows, { prestadorId: "pr2" }).map((r) => r.id)).toEqual(["b"]);
    expect(filtrarAptosLote(rows, { clienteId: "cliA" }).map((r) => r.id)).toEqual(["a"]);
  });

  it("BUSCA por OS e por Prestador", () => {
    const rows = [apto({ id: "a", os_numero: "OS-777", prestador_nome: "Alfa" }), apto({ id: "b", os_numero: "OS-888", prestador_nome: "Beta" })];
    expect(filtrarAptosLote(rows, { busca: "OS-777" }).map((r) => r.id)).toEqual(["a"]);
    expect(filtrarAptosLote(rows, { busca: "Beta" }).map((r) => r.id)).toEqual(["b"]);
  });

  it("PERIODO pela data do servico (periodo_inicio)", () => {
    const rows = [apto({ id: "mai", periodo_inicio: "2026-05-10" }), apto({ id: "jun", periodo_inicio: "2026-06-10" })];
    expect(filtrarAptosLote(rows, { dataInicio: "2026-06-01", dataFim: "2026-06-30" }).map((r) => r.id)).toEqual(["jun"]);
  });

  it("PAGINACAO: >25 aptos, pagina 1/2 sem overlap; total/soma independentes da pagina", () => {
    const rows = Array.from({ length: 30 }, (_, i) => apto({ id: `p${i}`, valor_liquido: 10, os_numero: `OS-${i}` }));
    const filtrados = filtrarAptosLote(rows, {});
    expect(filtrados.length).toBe(30);
    const p1 = paginarLinhas(filtrados, 1, 25);
    const p2 = paginarLinhas(filtrados, 2, 25);
    expect(p1.length).toBe(25);
    expect(p2.length).toBe(5);
    const ids1 = new Set(p1.map((r) => r.id));
    expect(p2.some((r) => ids1.has(r.id))).toBe(false);
    expect(totalLiquidoAptos(filtrados)).toBe(300);
    expect(totalLiquidoAptos(p1)).toBe(250); // soma da pagina difere do total (cards usam o conjunto completo)
  });

  it("selecao so pode incluir aptos (nunca teste/pago/cancelado/lote)", () => {
    const rows = [apto({ id: "ok" }), apto({ id: "teste", is_teste: true }), apto({ id: "pago", status_pagamento: "pago" })];
    const selecionaveis = filtrarAptosLote(rows, {}).map((r) => r.id);
    expect(selecionaveis).toEqual(["ok"]);
  });
});
