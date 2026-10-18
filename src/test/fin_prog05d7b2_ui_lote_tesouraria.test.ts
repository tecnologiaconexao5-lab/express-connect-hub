import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  isAptoLote,
  resumoLoteSelecionado,
  filtrarFilaTesouraria,
  agruparLotesTesouraria,
  loteIdCurto,
  type LinhaLote,
} from "@/helpers/lotePagamentoHelper";
import { gerarLotePagamentos } from "@/services/financeiro/pagamentoPrestadorService";

const apto = (over: Partial<LinhaLote> = {}): LinhaLote => ({
  id: "p", prestador_id: "pr1", prestador_nome: "P1", valor_liquido: 100,
  periodo_inicio: "2026-05-10", status_conferencia: "conferido",
  status_aprovacao: "aprovado", elegivel_lote: true, status_pagamento: "pendente",
  lote_id: null, is_teste: false, tipo_pagamento: null, ...over,
});

describe("TMS-FIN-PROG-05D.7B.2 — UI lote + Tesouraria", () => {
  it("A) seleção de 2 aptos -> modal mostra 2", () => {
    const sel = [apto({ id: "a" }), apto({ id: "b", prestador_id: "pr2", prestador_nome: "P2" })];
    expect(resumoLoteSelecionado(sel).quantidade).toBe(2);
  });

  it("B) total do modal = soma valor_liquido", () => {
    const sel = [apto({ id: "a", valor_liquido: 100 }), apto({ id: "b", valor_liquido: 250.5 })];
    expect(resumoLoteSelecionado(sel).totalLiquido).toBe(350.5);
    expect(resumoLoteSelecionado(sel).prestadores).toBe(1);
  });

  it("C) confirmar chama a RPC exatamente 1x com os IDs corretos", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ lote_id: "L1", solicitados: 2, incluidos: 2, ja_em_lote: 0, bloqueados: 0, detalhes: [] }], error: null });
    const res = await gerarLotePagamentos(["a", "b"], { rpc } as any);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("f_gerar_lote_pagamentos", { p_ids: ["a", "b"] });
    expect(res.lote_id).toBe("L1");
  });

  it("D) sucesso expõe lote_id e quantidade", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ lote_id: "abc12345-...", solicitados: 1, incluidos: 1, ja_em_lote: 0, bloqueados: 0, detalhes: [] }], error: null });
    const res = await gerarLotePagamentos(["a"], { rpc } as any);
    expect(res.lote_id).toBeTruthy();
    expect(res.incluidos).toBe(1);
  });

  it("E) bloqueio da RPC não apresenta sucesso", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ lote_id: null, solicitados: 2, incluidos: 0, ja_em_lote: 0, bloqueados: 1, detalhes: [{ id: "b", resultado: "PAGO", motivo: "Pagamento ja efetuado" }] }], error: null });
    const res = await gerarLotePagamentos(["a", "b"], { rpc } as any);
    expect(res.lote_id).toBeNull();
    expect(res.bloqueados).toBe(1);
  });

  it("F) item já em lote NÃO é apto (não pode ser selecionado de novo)", () => {
    expect(isAptoLote(apto({ lote_id: "L1", status_pagamento: "em_lote" }))).toBe(false);
  });

  it("F2) itens não aptos são rejeitados pelo pré-filtro", () => {
    expect(isAptoLote(apto({ is_teste: true }))).toBe(false);
    expect(isAptoLote(apto({ tipo_pagamento: "fechamento" }))).toBe(false);
    expect(isAptoLote(apto({ status_aprovacao: "aguardando_aprovacao" }))).toBe(false);
    expect(isAptoLote(apto({ elegivel_lote: false }))).toBe(false);
    expect(isAptoLote(apto({ status_pagamento: "pago" }))).toBe(false);
    expect(isAptoLote(apto({ status_pagamento: "cancelado" }))).toBe(false);
  });

  it("G) caminho antigo 'Liberar Lote' removido (sem caminho paralelo)", () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), "src/components/financeiro/PagamentoPrestadores.tsx"), "utf8");
    expect(src.includes('title="Liberar Lote"')).toBe(false);
    // e nao deve mais setar em_lote diretamente por handleAtualizarStatus
    expect(src.includes("status_pagamento: 'em_lote'")).toBe(false);
  });

  it("H) Tesouraria NÃO mostra aprovado/elegível sem lote", () => {
    const rows: LinhaLote[] = [apto({ id: "x", status_pagamento: "pendente", lote_id: null })];
    expect(filtrarFilaTesouraria(rows).length).toBe(0);
  });

  it("I) Tesouraria mostra em_lote + lote_id", () => {
    const rows: LinhaLote[] = [apto({ id: "x", status_pagamento: "em_lote", lote_id: "L1" })];
    expect(filtrarFilaTesouraria(rows).length).toBe(1);
  });

  it("J/K/L) pago, cancelado e teste NÃO aparecem", () => {
    const rows: LinhaLote[] = [
      apto({ id: "pago", status_pagamento: "pago", lote_id: "L1" }),
      apto({ id: "canc", status_pagamento: "cancelado", lote_id: "L1" }),
      apto({ id: "teste", status_pagamento: "em_lote", lote_id: "L1", is_teste: true }),
    ];
    expect(filtrarFilaTesouraria(rows).length).toBe(0);
  });

  it("M) agrupamento: 3 itens mesmo lote -> 1 grupo, 3 pagamentos, total correto", () => {
    const L = "lote-aaaa-bbbb";
    const rows: LinhaLote[] = [
      apto({ id: "1", lote_id: L, status_pagamento: "em_lote", valor_liquido: 100, prestador_id: "p1", periodo_inicio: "2026-05-10" }),
      apto({ id: "2", lote_id: L, status_pagamento: "em_lote", valor_liquido: 200, prestador_id: "p1", periodo_inicio: "2026-05-20" }),
      apto({ id: "3", lote_id: L, status_pagamento: "em_lote", valor_liquido: 300, prestador_id: "p2", periodo_inicio: "2026-05-15" }),
    ];
    const g = agruparLotesTesouraria(rows);
    expect(g.length).toBe(1);
    expect(g[0].quantidade).toBe(3);
    expect(g[0].prestadores).toBe(2);
    expect(g[0].totalLiquido).toBe(600);
    expect(g[0].periodoMin).toBe("2026-05-10");
    expect(g[0].periodoMax).toBe("2026-05-20");
    expect(g[0].statusLabel).toBe("Aguardando execução bancária");
  });

  it("N) lotes diferentes -> grupos separados", () => {
    const rows: LinhaLote[] = [
      apto({ id: "1", lote_id: "L1", status_pagamento: "em_lote", valor_liquido: 100 }),
      apto({ id: "2", lote_id: "L2", status_pagamento: "em_lote", valor_liquido: 200 }),
    ];
    const g = agruparLotesTesouraria(rows);
    expect(g.length).toBe(2);
    expect(g.map((x) => x.totalLiquido).sort()).toEqual([100, 200]);
  });

  it("O) nenhum botão bancário executável (Tesouraria: botões desabilitados)", () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), "src/components/financeiro/PagamentoCNAB.tsx"), "utf8");
    expect(src.includes("Gerar Remessa — indisponível")).toBe(true);
    expect(src.includes("Importar Retorno — indisponível")).toBe(true);
    expect(src.includes("Enviar PIX — indisponível")).toBe(true);
    // nao deve conter chamada real de pagamento/baixa/banco
    expect(src.includes("f_confirmar_pagamento_prestador")).toBe(false);
    expect(src.includes("financeiro_baixas")).toBe(false);
  });

  it("loteIdCurto retorna 8 chars", () => {
    expect(loteIdCurto("12345678-90ab-cdef-0000-000000000000")).toBe("12345678");
    expect(loteIdCurto(null)).toBe("");
  });
});
