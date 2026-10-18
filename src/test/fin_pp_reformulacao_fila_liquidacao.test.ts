// ═══════════════════════════════════════════════════════════════════════════════
// REFORMULACAO-UI-PAGAMENTOS-E-INTEGRACAO
//
// 1. UI — nova visão primária "Fila de Liquidação" (Prestador | Serviço/OS |
//    Valor Bruto | Descontos | Valor Líquido | Liberar Pagamento).
// 2. INTEGRAÇÃO — contrato dos triggers de finalização (OS e Programação
//    Operacional) que alimentam pagamentos_prestadores com status pendente.
// 3. TESTE REAL DE LANÇAMENTO — simula uma OS finalizada e executa a baixa
//    financeira completa validando soma, subtração de taxas e status.
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  calcularFilaValores,
  isItemFilaLiquidacao,
  filtrarFilaLiquidacao,
  resumoFilaLiquidacao,
} from "@/helpers/filaLiquidacaoHelper";
import { liberarPagamentoPrestador, confirmarPagamento } from "@/services/financeiro/pagamentoPrestadorService";

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const COMP = "src/components/financeiro/PagamentoPrestadores.tsx";

// ── Fixture: linha criada pelos triggers ao finalizar uma OS no App ───────────
function osFinalizada(overrides: Record<string, unknown> = {}): any {
  return {
    id: "pp-os-1",
    prestador_id: "prest-1",
    prestador_nome: "TRANSPORTES TESTE",
    prestador_documento: "123.456.789-00",
    os_id: "os-1",
    os_numero: "OS-1001",
    origem_lancamento: "os_direta",
    valor_servicos: 1000,
    pedagio: 100,
    adicionais: 50,
    valor_reembolsos: 0,
    valor_bonus: 0,
    valor_descontos: 30,
    valor_adiantamentos: 20,
    valor_liquido: 1100,
    status: "pendente",
    status_conferencia: "em_aberto",
    status_aprovacao: "aguardando_aprovacao",
    status_pagamento: "pendente",
    is_teste: false,
    ...overrides,
  };
}

function makeClient(row: any, calls: Array<{ fn: string; args: any }>) {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: any) => ({
          single: async () => ({ data: row, error: null }),
        }),
      }),
    }),
    rpc: async (fn: string, args: any) => {
      calls.push({ fn, args });
      if (fn === "f_aprovar_pagamento_prestadores") {
        return { data: [{ solicitados: 1, aprovados: 1, ja_aprovados: 0, bloqueados: 0, detalhes: [] }], error: null };
      }
      if (fn === "f_confirmar_pagamento_prestador") {
        return { data: [{ sucesso: true, mensagem: "Pagamento confirmado", status_pagamento: "pago" }], error: null };
      }
      return { data: null, error: null };
    },
  };
}

// ── 1. UI ─────────────────────────────────────────────────────────────────────
describe("REFORMULACAO — Fila de Liquidação (UI)", () => {
  const comp = read(COMP);

  it("nova visão primária 'Fila de Liquidação' (aba default)", () => {
    expect(comp).toContain('<TabsTrigger value="fila">Fila de Liquidação</TabsTrigger>');
    expect(comp).toContain('<TabsContent value="fila"');
    expect(comp).toMatch(/searchParams\.get\("aba"\) \|\| "fila"/);
  });

  it("colunas exigidas na fila", () => {
    for (const h of ["Prestador", "Serviço / OS", "Valor Bruto", "Descontos", "Valor Líquido"]) {
      expect(comp).toContain(h);
    }
  });

  it("botão 'Liberar Pagamento' conectado ao service oficial (sem DML direto)", () => {
    expect(comp).toContain("Liberar Pagamento");
    expect(comp).toContain("handleLiberarPagamentoFila");
    expect(comp).toContain("liberarPagamentoPrestador");
    expect(/from\("pagamentos_prestadores"\)[\s\S]{0,120}\.(update|insert|delete)\(/.test(comp)).toBe(false);
  });

  it("visões anteriores preservadas (nenhuma capacidade removida)", () => {
    for (const v of ["dashboard", "listagem", "relatorio", "conta-corrente"]) {
      expect(comp).toContain(`value="${v}"`);
    }
  });
});

// ── 2. INTEGRAÇÃO — contrato dos triggers de finalização ──────────────────────
describe("INTEGRAÇÃO — finalização (OS/Programação) alimenta pagamentos_prestadores", () => {
  it("trigger da Programação Operacional grava escala_direta pendente/em_aberto", () => {
    const mig = read("supabase/migrations/20260924000002_fin_prog05b_ar_single_source.sql");
    expect(mig).toContain("INSERT INTO pagamentos_prestadores");
    expect(mig).toContain("'escala_direta'");
    expect(mig).toMatch(/CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END/);
  });

  it("trigger da OS Direta grava os_direta em_aberto/pendente", () => {
    const mig = read("supabase/migrations/20260924000012_fin_prog05d6c_data_canonica_prestador.sql");
    expect(mig).toContain("INSERT INTO pagamentos_prestadores");
    expect(mig).toContain("'os_direta'");
    expect(mig).toContain("'em_aberto'");
    expect(mig).toContain("'pendente'");
  });
});

// ── 3. Cálculo: soma de créditos e subtração de taxas ─────────────────────────
describe("Fila de Liquidação — soma e subtração de taxas", () => {
  it("bruto = serviços + pedágio + adicionais; descontos = descontos + adiantamentos", () => {
    const v = calcularFilaValores(osFinalizada());
    expect(v.bruto).toBe(1150);
    expect(v.descontos).toBe(50);
    expect(v.liquido).toBe(1100);
  });

  it("líquido derivado quando valor_liquido ausente (bruto - descontos)", () => {
    const v = calcularFilaValores(osFinalizada({ valor_liquido: null }));
    expect(v.liquido).toBe(1100);
  });

  it("resumo agrega bruto/descontos/líquido da fila", () => {
    const rows = [
      osFinalizada(),
      osFinalizada({ id: "pp-os-2", valor_servicos: 200, pedagio: 0, adicionais: 0, valor_descontos: 0, valor_adiantamentos: 0, valor_liquido: 200 }),
    ];
    const r = resumoFilaLiquidacao(rows);
    expect(r.qtd).toBe(2);
    expect(r.bruto).toBe(1350);
    expect(r.descontos).toBe(50);
    expect(r.liquido).toBe(1300);
  });

  it("fila inclui OS/Programação não pagas e exclui manual/pago/teste", () => {
    const rows = [
      osFinalizada(),
      osFinalizada({ id: "esc", origem_lancamento: "escala_direta" }),
      osFinalizada({ id: "manual", origem_lancamento: "manual" }),
      osFinalizada({ id: "pago", status_pagamento: "pago" }),
      osFinalizada({ id: "teste", is_teste: true }),
    ];
    expect(isItemFilaLiquidacao(rows[0])).toBe(true);
    expect(filtrarFilaLiquidacao(rows).map((x) => x.id)).toEqual(["pp-os-1", "esc"]);
  });
});

// ── 3b. Baixa financeira completa (OS finalizada → liberado) ──────────────────
describe("Fila de Liquidação — baixa financeira completa", () => {
  it("liberarPagamentoPrestador aprova e baixa uma OS finalizada (sem DML direto)", async () => {
    const calls: Array<{ fn: string; args: any }> = [];
    const row = osFinalizada();
    const client = makeClient(row, calls);

    const r = await liberarPagamentoPrestador(row.id, "2026-10-09", client);

    expect(r.pago).toBe(true);
    expect(r.ja_pago).toBe(false);
    expect(calls.map((c) => c.fn)).toEqual([
      "f_aprovar_pagamento_prestadores",
      "f_confirmar_pagamento_prestador",
    ]);
    expect(calls[0].args).toEqual({ p_ids: [row.id] });
    expect(calls[1].args).toEqual({ p_pagamento_id: row.id, p_data_pagamento: "2026-10-09" });
  });

  it("não re-aprova quando já aprovado (somente baixa)", async () => {
    const calls: Array<{ fn: string; args: any }> = [];
    const row = osFinalizada({ status_conferencia: "conferido", status_aprovacao: "aprovado" });
    const client = makeClient(row, calls);

    await liberarPagamentoPrestador(row.id, "2026-10-09", client);
    expect(calls.map((c) => c.fn)).toEqual(["f_confirmar_pagamento_prestador"]);
  });

  it("idempotente: já pago não dispara RPC", async () => {
    const calls: Array<{ fn: string; args: any }> = [];
    const client = makeClient(osFinalizada({ status: "pago", status_pagamento: "pago" }), calls);

    const r = await liberarPagamentoPrestador("pp-os-1", undefined, client);
    expect(r.ja_pago).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("cancelado é recusado (sem RPC)", async () => {
    const calls: Array<{ fn: string; args: any }> = [];
    const client = makeClient(osFinalizada({ status_pagamento: "cancelado" }), calls);

    await expect(liberarPagamentoPrestador("pp-os-1", undefined, client)).rejects.toThrow(/cancelado/i);
    expect(calls).toHaveLength(0);
  });

  it("confirmarPagamento executa a baixa e retorna status pago", async () => {
    const calls: Array<{ fn: string; args: any }> = [];
    const client = makeClient(osFinalizada(), calls);

    const res = await confirmarPagamento("pp-os-1", "2026-10-09", client);
    expect(res.status_pagamento).toBe("pago");
    expect(calls[0].fn).toBe("f_confirmar_pagamento_prestador");
  });
});
