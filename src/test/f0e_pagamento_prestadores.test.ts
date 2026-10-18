import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// F0-E / F0-E2 — Pagamento de Prestadores: única fonte de escrita via service.
// F0-E2: `valor` NÃO existe em public.pagamentos_prestadores (confirmado em
// produção via information_schema) — valor oficial é `valor_liquido`.
// Valida que:
//   * nenhum INSERT/UPDATE usa coluna inexistente de pagamentos_prestadores;
//   * NUNCA envia `valor` (coluna inexistente — corrigido no F0-E2);
//   * arquivo/conta_pagamento/forma_pagamento/cliente_id/cliente_nome/tenant_id
//     NUNCA vão ao banco (mapeamentos seguros: forma→tipo_pagamento; conta/arquivo→observacao);
//   * retry não duplica OS/fechamento (idempotência);
//   * manuais sem OS podem se repetir (dedup restrito);
//   * atualizarStatusPagamento aplica whitelist de status + motivo em observacao.
// Nenhuma chamada real a Supabase — banco NÃO ALTERADO.
// ============================================================================

const COLUNAS_REAIS = new Set([
  "id", "prestador_id", "prestador_nome", "prestador_documento",
  "periodo_inicio", "periodo_fim", "quantidade_os", "valor_servicos",
  "valor_reembolsos", "valor_bonus", "valor_descontos", "valor_adiantamentos",
  "valor_liquido", "status", "data_pagamento", "created_at", "updated_at",
  "os_id", "qtd_os", "pedagio", "reembolsos", "adicionais", "descontos",
  "adiantamentos", "multas", "ajustes", "status_conferencia", "status_aprovacao",
  "status_pagamento", "origem_lancamento", "tipo_pagamento", "categoria_financeira",
  "centro_custo", "conta_contabil", "competencia", "data_prevista_pagamento",
  "elegivel_lote", "lote_id", "impacto_dre", "impacto_fluxo_caixa", "observacao",
  "os_numero", "tipo_lancamento", "natureza", "data_competencia",
  // F0-E2 — contrato REAL confirmado em produção (information_schema, 45 colunas):
  // `valor` NÃO EXISTE em public.pagamentos_prestadores. O valor financeiro
  // oficial é `valor_liquido`. `valor` existe apenas na tabela legada
  // `pagamento_prestadores` (singular, 6 colunas) e no migration stale
  // 20260510090000_baseline_external_tables.sql. F0-E havia divergido por
  // confiar no migration file em vez do schema vivo.
]);

const COLUNAS_ITENS_REAIS = new Set([
  "id", "pagamento_id", "os_id", "os_numero", "valor_servico", "pedagio",
  "adicional", "valor_reembolso", "valor_bonus", "valor_desconto", "status",
  "created_at",
]);

const PROIBIDAS = ["arquivo", "conta_pagamento", "forma_pagamento", "cliente_id", "cliente_nome", "tenant_id"];

// ── mock chainable ────────────────────────────────────────────────────────────
const inserts: Record<string, Record<string, unknown>[]> = {};
const updates: { tabela: string; payload: Record<string, unknown> }[] = [];

const maybeSingleMock = vi.fn();
const singleMock = vi.fn();
const selectMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const rpcMock = vi.fn();

function fluentFrom(tabela: string) {
  const builder: any = {};
  builder.select = (cols?: string) => {
    selectMock(tabela, cols);
    builder.eq = (_k: string, _v: unknown) => builder;
    builder.limit = (_n: number) => builder;
    builder.order = (_c: string, _o: unknown) => builder;
    builder.range = (_a: number, _b: number) => builder;
    builder.maybeSingle = () => maybeSingleMock();
    builder.single = () => singleMock();
    return builder;
  };
  builder.insert = (rows: Record<string, unknown>[]) => {
    inserts[tabela] = inserts[tabela] || [];
    inserts[tabela].push(...rows);
    insertMock(tabela, rows);
    return { select: () => ({ single: () => singleMock() }) };
  };
  builder.update = (payload: Record<string, unknown>) => {
    updates.push({ tabela, payload });
    updateMock(tabela, payload);
    builder.eq = (_k: string, _v: unknown) => builder;
    return builder;
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (t: string) => fluentFrom(t), rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import {
  criarPagamento,
  criarFechamento,
  atualizarFechamento,
  confirmarPagamento,
  atualizarStatusPagamento,
  vincularItensFechamento,
} from "@/services/financeiro/pagamentoPrestadorService";

beforeEach(() => {
  Object.keys(inserts).forEach((k) => delete inserts[k]);
  updates.length = 0;
  maybeSingleMock.mockReset();
  singleMock.mockReset();
  insertMock.mockReset();
  updateMock.mockReset();
  rpcMock.mockReset();
});

describe("F0-E — criarPagamento (colunas reais + mapeamentos)", () => {
  it("INSERT usa somente colunas reais e NÃO envia campos inexistentes", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    singleMock.mockResolvedValueOnce({ data: { id: "p1" }, error: null });

    await criarPagamento({
      prestador_id: "prest-1",
      prestador_nome: "Motorista X",
      valor: 500,
      tipo_pagamento: "PIX",
      conta_pagamento: "Itaú PJ",
      arquivo: "comprovante.pdf",
    });

    const payload = inserts["pagamentos_prestadores"][0];
    for (const chave of Object.keys(payload)) {
      expect(COLUNAS_REAIS.has(chave), `coluna inexistente: ${chave}`).toBe(true);
    }
    for (const proibida of PROIBIDAS) {
      expect(payload).not.toHaveProperty(proibida);
    }
    // F0-E2: valor não existe em produção — nunca no payload.
    expect(payload).not.toHaveProperty("valor");
    expect(payload.valor_liquido).toBe(500);
  });

  it("conta_pagamento e arquivo viram referência textual em observacao", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    singleMock.mockResolvedValueOnce({ data: { id: "p2" }, error: null });

    await criarPagamento({
      prestador_id: "prest-1",
      prestador_nome: "Motorista X",
      valor: 100,
      conta_pagamento: "Itaú PJ",
      arquivo: "comprovante.pdf",
    });

    const payload = inserts["pagamentos_prestadores"][0];
    expect(payload.observacao).toContain("[Conta de pagamento: Itaú PJ]");
    expect(payload.observacao).toContain("[Anexo: comprovante.pdf]");
  });

  it("valor_liquido é preservado e valor_servicos default = valor", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    singleMock.mockResolvedValueOnce({ data: { id: "p3" }, error: null });

    await criarPagamento({
      prestador_id: "prest-1",
      prestador_nome: "Motorista X",
      valor: 100,
      valor_liquido: -100,
      natureza: "debito",
    });

    const payload = inserts["pagamentos_prestadores"][0];
    expect(payload.valor_liquido).toBe(-100);
    expect(payload.valor_servicos).toBe(100);
    expect(payload.valor_descontos).toBe(0);
  });
});

describe("F0-E — anti-duplicidade (idempotência de retry)", () => {
  it("mesmo os_id em retry retorna existente (não cria duplicata)", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "existente-1" }, error: null });

    const res = await criarPagamento({
      prestador_id: "prest-1",
      prestador_nome: "Motorista X",
      os_id: "os-1",
      os_numero: "OS-1",
      valor: 500,
      origem_lancamento: "os",
    });

    expect(res.id).toBe("existente-1");
    expect(inserts["pagamentos_prestadores"] || []).toHaveLength(0);
  });

  it("manual sem OS NÃO é bloqueado por dedup (valores iguais são legítimos)", async () => {
    // dedup sem os_id/os_numero retorna null → cria
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    singleMock.mockResolvedValueOnce({ data: { id: "manual-1" }, error: null });

    await criarPagamento({
      prestador_id: "prest-1",
      prestador_nome: "Motorista X",
      valor: 100,
      origem_lancamento: "manual",
    });

    expect(inserts["pagamentos_prestadores"] || []).toHaveLength(1);
  });

  it("mesmo fechamento (prestador + período) em retry retorna existente", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { id: "fech-1" }, error: null });

    const res = await criarFechamento("prest-1", {
      valor_total: 1000,
      periodo_inicio: "2026-08-01",
      periodo_fim: "2026-08-31",
    });

    expect(res.id).toBe("fech-1");
    expect(inserts["pagamentos_prestadores"] || []).toHaveLength(0);
  });
});

describe("F0-E — fechamento (colunas reais + vínculo)", () => {
  it("INSERT do fechamento usa somente colunas reais e grava qtd_os/tipo_pagamento", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    singleMock.mockResolvedValueOnce({ data: { id: "fech-2" }, error: null });

    await criarFechamento("prest-1", {
      valor_total: 1000,
      valor_servicos: 900,
      valor_descontos: 100,
      periodo_inicio: "2026-08-01",
      periodo_fim: "2026-08-31",
      qtd_os: 3,
      itens_ids: ["os-a", "os-b", "os-c"],
      prestador_nome: "Motorista X",
    });

    const payload = inserts["pagamentos_prestadores"][0];
    for (const chave of Object.keys(payload)) {
      expect(COLUNAS_REAIS.has(chave), `coluna inexistente: ${chave}`).toBe(true);
    }
    // F0-E2: valor não existe em produção — nunca no payload.
    expect(payload).not.toHaveProperty("valor");
    expect(payload.valor_liquido).toBe(1000);
    expect(payload.tipo_pagamento).toBe("fechamento");
    expect(payload.qtd_os).toBe(3);
    expect(payload.quantidade_os).toBe(3);
    expect(payload.valor_servicos).toBe(900);
    expect(payload.valor_descontos).toBe(100);
  });

  it("atualizarFechamento grava somente colunas reais", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "fech-2" }, error: null });
    await atualizarFechamento("fech-2", { valor_total: 1200, qtd_os: 4 });

    const upd = updates.find((u) => u.tabela === "pagamentos_prestadores");
    for (const chave of Object.keys(upd!.payload)) {
      expect(COLUNAS_REAIS.has(chave), `coluna inexistente: ${chave}`).toBe(true);
    }
    // F0-E2: valor não existe em produção — atualização usa valor_liquido como valor oficial.
    expect(upd!.payload).not.toHaveProperty("valor");
    expect(upd!.payload.valor_liquido).toBe(1200);
    expect(upd!.payload.qtd_os).toBe(4);
  });

  it("vincularItensFechamento insere somente colunas reais de pagamentos_prestadores_itens", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "x" }, error: null });
    await vincularItensFechamento("fech-2", [
      { os_id: "os-1", os_numero: "OS-1", valor_servico: 300, pedagio: 10, adicional: 5 },
    ]);

    const linhas = inserts["pagamentos_prestadores_itens"];
    for (const chave of Object.keys(linhas[0])) {
      expect(COLUNAS_ITENS_REAIS.has(chave), `coluna inexistente: ${chave}`).toBe(true);
    }
    expect(linhas[0].pagamento_id).toBe("fech-2");
  });
});

describe("F0-E — status (whitelist + motivo em observacao)", () => {
  it("confirmarPagamento delega a conciliacao atomica e nao faz update direto", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "p1", status_pagamento: "pendente", prestador_id: "prest-1", valor_liquido: 500 }, error: null });
    rpcMock.mockResolvedValueOnce({ data: [{ sucesso: true, pagamento_id: "p1", valor_liquidado: 500, status_pagamento: "pago" }], error: null });

    await confirmarPagamento("p1", "2026-08-18");

    expect(updates.filter((u) => u.tabela === "pagamentos_prestadores")).toHaveLength(0);
    expect(rpcMock).toHaveBeenCalledWith("f_confirmar_pagamento_prestador", {
      p_pagamento_id: "p1",
      p_data_pagamento: "2026-08-18",
    });
  });

  it("falha financeira nao altera o status para pago", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "p1", status_pagamento: "pendente", prestador_id: "prest-1", valor_liquido: 500 }, error: null });
    rpcMock.mockResolvedValueOnce({ data: [{ sucesso: false, mensagem: "Titulo financeiro nao encontrado" }], error: null });

    await expect(confirmarPagamento("p1", "2026-08-18")).rejects.toThrow("Titulo financeiro nao encontrado");
    expect(updates.filter((u) => u.tabela === "pagamentos_prestadores")).toHaveLength(0);
  });

  it("atualizarStatusPagamento aplica whitelist e descarta chaves inexistentes", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: "p1", status_pagamento: "pendente", status_conferencia: "em_aberto", observacao: "obs inicial" }, error: null });
    singleMock.mockResolvedValueOnce({ data: { id: "p1" }, error: null });

    await atualizarStatusPagamento(
      "p1",
      { status_aprovacao: "aprovado", liberado_com_justificativa: true } as any,
      "Liberação manual: comprovante por e-mail"
    );

    const upd = updates.find((u) => u.tabela === "pagamentos_prestadores");
    for (const chave of Object.keys(upd!.payload)) {
      expect(COLUNAS_REAIS.has(chave), `coluna inexistente: ${chave}`).toBe(true);
    }
    expect(upd!.payload).not.toHaveProperty("liberado_com_justificativa");
    expect(upd!.payload.status_aprovacao).toBe("aprovado");
    expect(upd!.payload.observacao).toContain("Liberação manual");
  });
});
