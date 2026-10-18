// ═══════════════════════════════════════════════════════════════════════════════
// FIN-PP-FUNC-01 — NOVO LANÇAMENTO (obrigação manual) — UI → service → RPC → FP+PP
// Testes determinísticos:
//   A. Service chama a RPC oficial com os parâmetros corretos (sem INSERT direto).
//   B. Validações locais bloqueiam entradas inválidas.
//   C. Erro da RPC não gera falso sucesso.
//   D. Componente: botão habilitado, sem DML direto no fluxo manual.
//   E. Migration: RPC criada + fallback manual nas RPCs de Aprovar/Lote.
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const PP_SRC = "src/components/financeiro/PagamentoPrestadores.tsx";
const MIG = "supabase/migrations/20260926000001_fin_pp_func01_novo_lancamento.sql";

import { criarLancamentoManualPrestador } from "@/services/financeiro/pagamentoPrestadorService";

function fakeClient(res: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(res);
  return { rpc };
}

describe("FIN-PP-FUNC-01 — service criarLancamentoManualPrestador", () => {
  it("chama a RPC oficial com os argumentos corretos", async () => {
    const client = fakeClient({
      data: [{ sucesso: true, mensagem: "LANCAMENTO_CRIADO", pagamento_prestador_id: "pp-1", financeiro_pagar_id: "fp-1", idempotente: false }],
      error: null,
    });

    const r = await criarLancamentoManualPrestador({
      prestador_id: "prest-1",
      tipo_lancamento: "Serviço Avulso",
      data: "2026-09-26",
      valor: 123.45,
      descricao: "  serviço avulso  ",
      forma_pagamento: "PIX",
      conta_pagamento: "Cora",
      idempotencyKey: "key-1",
    }, client as any);

    expect(client.rpc).toHaveBeenCalledWith("f_criar_lancamento_manual_prestador", {
      p_prestador_id: "prest-1",
      p_tipo_lancamento: "Serviço Avulso",
      p_data: "2026-09-26",
      p_valor: 123.45,
      p_descricao: "serviço avulso",
      p_forma_pagamento: "PIX",
      p_conta_pagamento: "Cora",
      p_idempotency_key: "key-1",
    });
    expect(r.sucesso).toBe(true);
    expect(r.pagamento_prestador_id).toBe("pp-1");
    expect(r.financeiro_pagar_id).toBe("fp-1");
  });

  it("bloqueia validações locais sem chamar a RPC", async () => {
    const client = fakeClient({ data: null, error: null });
    await expect(criarLancamentoManualPrestador({ prestador_id: "", tipo_lancamento: "Ajuste", data: "2026-09-26", valor: 1, descricao: "x" }, client as any)).rejects.toThrow(/Prestador/);
    await expect(criarLancamentoManualPrestador({ prestador_id: "p", tipo_lancamento: "", data: "2026-09-26", valor: 1, descricao: "x" }, client as any)).rejects.toThrow(/Tipo/);
    await expect(criarLancamentoManualPrestador({ prestador_id: "p", tipo_lancamento: "Ajuste", data: "", valor: 1, descricao: "x" }, client as any)).rejects.toThrow(/Data/);
    await expect(criarLancamentoManualPrestador({ prestador_id: "p", tipo_lancamento: "Ajuste", data: "2026-09-26", valor: 0, descricao: "x" }, client as any)).rejects.toThrow(/Valor/);
    await expect(criarLancamentoManualPrestador({ prestador_id: "p", tipo_lancamento: "Ajuste", data: "2026-09-26", valor: 1, descricao: "   " }, client as any)).rejects.toThrow(/Descrição/);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("erro da RPC não gera falso sucesso", async () => {
    const client = fakeClient({ data: [{ sucesso: false, mensagem: "VALOR_INVALIDO" }], error: null });
    await expect(criarLancamentoManualPrestador({ prestador_id: "p", tipo_lancamento: "Ajuste", data: "2026-09-26", valor: 1, descricao: "x" }, client as any)).rejects.toThrow(/VALOR_INVALIDO/);
  });

  it("erro de transporte é propagado", async () => {
    const client = fakeClient({ data: null, error: { message: "boom" } });
    await expect(criarLancamentoManualPrestador({ prestador_id: "p", tipo_lancamento: "Ajuste", data: "2026-09-26", valor: 1, descricao: "x" }, client as any)).rejects.toThrow(/boom/);
  });
});

describe("FIN-PP-FUNC-01 — componente (Novo Lançamento)", () => {
  const src = read(PP_SRC);

  it("fluxo manual usa o service (RPC) e NÃO chama criarPagamento (INSERT direto)", () => {
    const handler = src.slice(src.indexOf("const handleSalvarNovoPagamento"), src.indexOf("const handleMarcarPago"));
    expect(handler).toContain("criarLancamentoManualPrestador");
    expect(handler).not.toContain("criarPagamento(");
    expect(handler).toContain("idempotencyKey");
    expect(handler).toContain("criandoLancamento");
  });

  it("botão habilitado e sem title de indisponível", () => {
    expect(src).toContain("Novo Lançamento");
    expect(src).not.toContain('title="Disponível após conclusão do fluxo de lançamento manual."');
  });

  it("campos mínimos do formulário e tipos suportados", () => {
    for (const label of ["Prestador *", "Tipo do Lançamento *", "Data *", "Valor *", "Descrição / Observação *"]) {
      expect(src).toContain(label);
    }
    expect(src).toContain('"Serviço Avulso"');
    expect(src).toContain('"Ajuste"');
    expect(src).toContain('"Reembolso"');
    expect(src).toContain('"Adiantamento"');
    expect(src).not.toContain("OS Vinculada");
  });
});

describe("FIN-PP-FUNC-01 — migration", () => {
  const sql = read(MIG);

  it("cria a RPC oficial atômica e idempotente", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.f_criar_lancamento_manual_prestador");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path TO 'public'");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("[IDEMP:");
    expect(sql).toContain("INSERT INTO public.pagamentos_prestadores");
    expect(sql).toContain("INSERT INTO public.financeiro_pagar");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.f_criar_lancamento_manual_prestador");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.f_criar_lancamento_manual_prestador");
  });

  it("habilita manual (origem='manual', os_id NULL) em Aprovar e Lote sem mexer no resto", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.f_aprovar_pagamento_prestadores");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.f_gerar_lote_pagamentos");
    const ocorrencias = sql.match(/COALESCE\(b\.origem_lancamento,''\) <> 'manual'/g) || [];
    expect(ocorrencias.length).toBe(2);
    // Regra de OS/Programação preservada
    expect(sql).toContain("WHEN b.row_tenant IS NOT NULL AND b.row_tenant <> v_tenant THEN 'CROSS_TENANT'");
  });
});
