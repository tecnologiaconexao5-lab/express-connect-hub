// ═══════════════════════════════════════════════════════════════════════════════
// FIN-BUG-04 — LANÇAMENTO MANUAL / PRESTADOR FANTASMA + CAIXA DE ENTRADA
// Determinístico, sem banco:
//   A. normalizarPagamento: nome via cadastro, valor legado (valor_servicos),
//      fantasma (sem prestador_id) e bloqueio — corrige "Não informado / R$ 0,00".
//   B. resumirFilaAprovacao: cards bancários (pendentes/aprovados/bloqueados/pagos).
//   C. ordenarFilaAprovacao: manuais primeiro, mais recentes primeiro.
//   D. Componente: Caixa de Entrada premium + payload do lançamento manual
//      (prestador_id, valor, descrição) intacto via RPC oficial.
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  normalizarPagamento,
  resumirFilaAprovacao,
  ordenarFilaAprovacao,
} from "@/helpers/pagamentoPrestadorView";
import { criarLancamentoManualPrestador } from "@/services/financeiro/pagamentoPrestadorService";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const COMP = "src/components/financeiro/PagamentoPrestadores.tsx";
const SVC = "src/services/financeiro/pagamentoPrestadorService.ts";

describe("FIN-BUG-04 — normalizarPagamento (fim do 'Não informado / R$ 0,00')", () => {
  it("usa prestador_nome quando presente", () => {
    const r = normalizarPagamento({ prestador_id: "p1", prestador_nome: "CESAR", valor_liquido: 100 });
    expect(r.prestadorNome).toBe("CESAR");
    expect(r.valor).toBe(100);
    expect(r.valorLegado).toBe(false);
    expect(r.podeAprovar).toBe(true);
  });

  it("resolve o nome pelo cadastro quando prestador_nome é NULL (fantasma)", () => {
    const r = normalizarPagamento(
      { prestador_id: "p1", prestador_nome: null, valor_liquido: 1000 },
      { p1: "PRESTADOR CADASTRADO" },
    );
    expect(r.prestadorNome).toBe("PRESTADOR CADASTRADO");
    expect(r.semPrestador).toBe(false);
  });

  it("valor_liquido = 0 (legado) cai para valor_servicos e sinaliza 'legado'", () => {
    const r = normalizarPagamento({ prestador_id: "p1", prestador_nome: "X", valor_liquido: 0, valor_servicos: 1000 });
    expect(r.valor).toBe(1000);
    expect(r.valorLegado).toBe(true);
    expect(r.podeAprovar).toBe(true);
  });

  it("registro sem prestador_id é fantasma e NÃO pode ser aprovado", () => {
    const r = normalizarPagamento({ prestador_id: null, prestador_nome: null, valor_liquido: 500 });
    expect(r.semPrestador).toBe(true);
    expect(r.motivoBloqueio).toBe("SEM_PRESTADOR");
    expect(r.podeAprovar).toBe(false);
    expect(r.prestadorNome).toBeNull();
  });

  it("valor <= 0 é bloqueado como VALOR_INVALIDO", () => {
    const r = normalizarPagamento({ prestador_id: "p1", prestador_nome: "X", valor_liquido: 0 });
    expect(r.motivoBloqueio).toBe("VALOR_INVALIDO");
    expect(r.podeAprovar).toBe(false);
    expect(r.valor).toBe(0);
  });

  it("aceita string numérica (PostgREST) sem quebrar", () => {
    const r = normalizarPagamento({ prestador_id: "p1", prestador_nome: " X ", valor_liquido: "3220.10" });
    expect(r.prestadorNome).toBe("X");
    expect(r.valor).toBeCloseTo(3220.1, 2);
  });
});

describe("FIN-BUG-04 — resumirFilaAprovacao (cards bancários)", () => {
  const nomePorId = { p1: "PRESTADOR A" };
  const base = { prestador_id: "p1", prestador_nome: "PRESTADOR A", valor_liquido: 100 };

  it("separa pendentes, aprovados a pagar e pagos", () => {
    const r = resumirFilaAprovacao([
      { ...base, status_aprovacao: "aguardando_aprovacao", status_pagamento: "pendente" },
      { ...base, status_aprovacao: "aprovado", status_pagamento: "pendente" },
      { ...base, status_aprovacao: "aprovado", status_pagamento: "pago" },
    ], nomePorId);
    expect(r.pendentes).toEqual({ qtd: 1, valor: 100 });
    expect(r.aprovados).toEqual({ qtd: 1, valor: 100 });
    expect(r.pagosMes).toEqual({ qtd: 1, valor: 100 });
    expect(r.bloqueados.qtd).toBe(0);
  });

  it("conta bloqueados (sem prestador / valor inválido) e fantasmas", () => {
    const r = resumirFilaAprovacao([
      { prestador_id: null, prestador_nome: null, valor_liquido: 500, status_aprovacao: "aguardando_aprovacao", status_pagamento: "pendente" },
      { prestador_id: "p1", prestador_nome: "P", valor_liquido: 0, status_aprovacao: "aguardando_aprovacao", status_pagamento: "pendente" },
    ], nomePorId);
    expect(r.pendentes.qtd).toBe(2);
    expect(r.bloqueados.qtd).toBe(2);
    expect(r.fantasmas.qtd).toBe(1);
  });

  it("ignora testes e cancelados", () => {
    const r = resumirFilaAprovacao([
      { ...base, is_teste: true, status_aprovacao: "aguardando_aprovacao", status_pagamento: "pendente" },
      { ...base, status: "cancelado", status_aprovacao: "aguardando_aprovacao", status_pagamento: "pendente" },
      { ...base, status_aprovacao: "aguardando_aprovacao", status_pagamento: "cancelado" },
    ], nomePorId);
    expect(r.pendentes.qtd).toBe(0);
    expect(r.fantasmas.qtd).toBe(0);
  });
});

describe("FIN-BUG-04 — ordenarFilaAprovacao", () => {
  it("manuais primeiro e mais recentes primeiro", () => {
    const ordenado = ordenarFilaAprovacao([
      { origem_lancamento: "os_direta", data_competencia: "2026-10-01", prestador_id: "p" },
      { origem_lancamento: "manual", data_competencia: "2026-09-01", prestador_id: "p" },
      { origem_lancamento: "manual", data_competencia: "2026-10-07", prestador_id: "p" },
    ]);
    expect(ordenado.map((r) => r.data_competencia)).toEqual(["2026-10-07", "2026-09-01", "2026-10-01"]);
  });
});

describe("FIN-BUG-04 — payload do lançamento manual (sem perda de dados)", () => {
  it("mapeia prestador_id, valor e descrição para a RPC oficial", async () => {
    const rpc = async (fn: string, args: Record<string, unknown>) => ({
      data: [{ sucesso: true, mensagem: "LANCAMENTO_CRIADO", pagamento_prestador_id: "pp", financeiro_pagar_id: "fp", idempotente: false }],
      error: null,
      fn,
      args,
    });
    const chamadas: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        chamadas.push({ fn, args });
        return rpc(fn, args);
      },
    };

    const res = await criarLancamentoManualPrestador({
      prestador_id: "prestador-123",
      tipo_lancamento: "Reembolso",
      data: "2026-10-07",
      valor: 810.4,
      descricao: "Reembolso de pedágio romaneio 344504",
      forma_pagamento: "PIX",
      conta_pagamento: "Cora",
      idempotencyKey: "k1",
    }, client as never);

    expect(res.sucesso).toBe(true);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].fn).toBe("f_criar_lancamento_manual_prestador");
    expect(chamadas[0].args).toMatchObject({
      p_prestador_id: "prestador-123",
      p_tipo_lancamento: "Reembolso",
      p_data: "2026-10-07",
      p_valor: 810.4,
      p_descricao: "Reembolso de pedágio romaneio 344504",
      p_forma_pagamento: "PIX",
      p_conta_pagamento: "Cora",
    });
  });

  it("componente envia prestadorId/valor/descricao sem alteração no handler", () => {
    const src = read(COMP);
    const handler = src.slice(src.indexOf("const handleSalvarNovoPagamento"), src.indexOf("const handleMarcarPago"));
    expect(handler).toContain("prestador_id: novoPagamento.prestadorId");
    expect(handler).toContain("valor: novoPagamento.valor");
    expect(handler).toContain("descricao: novoPagamento.descricao");
    expect(handler).toContain("criarLancamentoManualPrestador");
    expect(src).toContain("criarLancamentoManualPrestador");
    // service continua sendo o único caminho (RPC), sem INSERT direto
    expect(read(SVC)).toContain('rpc("f_criar_lancamento_manual_prestador"');
  });
});

describe("FIN-BUG-04 — Caixa de Entrada premium na tela", () => {
  const src = read(COMP);

  it("aba 'Pendentes de Aprovação' é a primeira e é o estado inicial", () => {
    expect(src).toContain('useState("pendentes")');
    const tabs = src.slice(src.indexOf('<TabsList className="h-auto w-full justify-start gap-1 rounded-lg border border-border/60 bg-card p-1"'));
    expect(tabs.indexOf('value="pendentes"')).toBeGreaterThan(-1);
    expect(tabs.indexOf('value="pendentes"')).toBeLessThan(tabs.indexOf('value="periodo"'));
    expect(src).toContain("Pendentes de Aprovação");
  });

  it("cards bancários com os 4 indicadores", () => {
    for (const t of ["Aguardando aprovação", "Aprovados a pagar", "Bloqueados", "Pago no período"]) {
      expect(src).toContain(t);
    }
    expect(src).toContain("resumoFila.pendentes.valor");
    expect(src).toContain("resumoPeriodo.aprovados.valor");
    expect(src).toContain("resumoFila.bloqueados.valor");
    expect(src).toContain("resumoPeriodo.pagosMes.valor");
  });

  it("caixa de entrada usa normalização e ação oficial com tooltips", () => {
    expect(src).toContain("Caixa de Entrada — Pendentes de Aprovação");
    expect(src).toContain("normalizarPagamento(p, nomePrestadorPorId)");
    expect(src).toContain("aprovarDaFila");
    expect(src).toContain('title="Conferir e aprovar"');
    expect(src).toContain("filaAprovacao");
  });

  it("expõe aviso de registros fantasma (sem mascará-los)", () => {
    expect(src).toContain("registro fantasma");
    expect(src).toContain("Estes registros não podem ser aprovados nem pagos pela RPC oficial");
  });

  it("normaliza nome/valor nas visões legadas (período, manuais e conta corrente)", () => {
    expect(src).toContain("legado</span>");
    expect(src).toContain("normalizarPagamento(pag).valor");
    expect(src).toContain("Sem prestador vinculado");
  });
});
