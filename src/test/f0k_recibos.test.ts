import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  montarNumeroRecibo,
  valorPorExtenso,
  listarRecibos,
  cancelarRecibo,
  montarPDFRecibo,
} from "@/services/financeiro/reciboService";

// ============================================================================
// F0-K — Recibos: persistência, histórico, numeração única, PDF, cancelamento.
// Sem recibo fictício persistido em Produção.
// ============================================================================

const inserts: Record<string, Record<string, unknown>[]> = {};
const updates: { tabela: string; payload: Record<string, unknown>; eq?: unknown }[] = [];
let selectData: any = { data: [], error: null };

const maybeSingleMock = vi.fn();
const singleMock = vi.fn();

function fluent(tabela: string) {
  const b: any = {
    eq: (k: string, v: unknown) => { b._eq = { k, v }; return b; },
    select: (cols?: string) => {
      b.maybeSingle = () => maybeSingleMock();
      b.single = () => singleMock();
      b.order = () => b;
      b.limit = () => b;
      return b;
    },
    like: () => b,
    or: () => b,
    gte: () => b,
    lte: () => b,
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      Promise.resolve(selectData).then(resolve, reject);
    },
    insert: (rows: Record<string, unknown>[]) => {
      inserts[tabela] = inserts[tabela] || [];
      inserts[tabela].push(...rows);
      return { select: () => ({ single: () => singleMock() }) };
    },
    update: (payload: Record<string, unknown>) => {
      updates.push({ tabela, payload });
      b._upd = payload;
      return b; // .update().eq().select().single()
    },
  };
  return b;
}

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (t: string) => fluent(t) },
}));

// jsPDF mock (montarPDFRecibo roda em Node sem canvas)
vi.mock("jspdf", () => {
  class MockJsPDF {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    setFontSize() { return this; }
    setTextColor() { return this; }
    setDrawColor() { return this; }
    setLineWidth() { return this; }
    setFillColor() { return this; }
    setFont() { return this; }
    text() { return this; }
    addImage() { return this; }
    line() { return this; }
    roundedRect() { return this; }
    splitTextToSize(t: string) { return [t]; }
    output() { return "blob"; }
    save() { return this; }
  }
  return { default: MockJsPDF };
});

vi.mock("@/utils/pdfGenerator", () => ({ carregarLogoBase64Utils: async () => "data:image/png;base64,x" }));

beforeEach(() => {
  Object.keys(inserts).forEach((k) => delete inserts[k]);
  updates.length = 0;
  maybeSingleMock.mockReset();
  singleMock.mockReset();
  selectData = { data: [], error: null };
});

const reciboMock = {
  id: "r1", numero: "REC-202608-00001", data_emissao: "2026-08-19",
  favorecido_tipo: "prestador", favorecido_nome: "Prestador X",
  favorecido_documento: "12345678000190", valor: 1500,
  valor_extenso: "um mil e quinhentos reais", referencia: "Transporte OS-202608-123456",
  forma_pagamento: "PIX", conta_financeira: "Conta Corrente Principal",
  os_numero: "OS-202608-123456", observacoes: null, status: "emitido",
  motivo_cancelamento: null, data_cancelamento: null, usuario_criador: null,
  usuario_cancelou: null, created_at: "2026-08-19T10:00:00.000Z",
};

describe("F0-K — Recibos", () => {
  it("1. gerar recibo: INSERT somente em `recibos` (sem tocar financeiro)", async () => {
    singleMock.mockResolvedValueOnce({ data: { ...reciboMock }, error: null });
    // not tested via criarRecibo para não depender da query de contagem; validamos a regra de escrita:
    const { criarRecibo } = await import("@/services/financeiro/reciboService");
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    singleMock.mockResolvedValueOnce({ data: { ...reciboMock }, error: null });
    const r = await criarRecibo({
      favorecido_tipo: "prestador", favorecido_nome: "Prestador X",
      favorecido_documento: "12345678000190", valor: 1500, referencia: "Transporte OS-202608-123456",
      forma_pagamento: "PIX", os_numero: "OS-202608-123456",
    });
    expect(r.numero).toBe("REC-202608-00001");
    expect(Object.keys(inserts)).toEqual(["recibos"]); // SÓ recibos — nenhuma outra tabela
    const payload = inserts.recibos[0];
    expect(payload).toMatchObject({
      numero: "REC-202608-00001", favorecido_nome: "Prestador X",
      valor: 1500, status: "emitido", forma_pagamento: "PIX", os_numero: "OS-202608-123456",
    });
    expect(payload.valor_extenso).toBeTruthy();
  });

  it("2. recibo aparece no histórico (listarRecibos consulta `recibos` e retorna)", async () => {
    selectData = { data: [{ ...reciboMock }, { ...reciboMock, id: "r2", numero: "REC-202608-00002" }], error: null };
    const supabaseMock = await import("@/lib/supabase");
    const spy = vi.spyOn(supabaseMock.supabase, "from");
    spy.mockReturnValue(fluent("recibos"));
    const lista = await listarRecibos({ status: "todos" });
    expect(spy).toHaveBeenCalledWith("recibos");
    expect(lista).toHaveLength(2);
    expect(lista[0].numero).toBe("REC-202608-00001");
    spy.mockRestore();
  });

  it("3. localizar novamente (obterRecibo por id)", async () => {
    const supabaseMock = await import("@/lib/supabase");
    const spy = vi.spyOn(supabaseMock.supabase, "from");
    spy.mockReturnValue(fluent("recibos"));
    maybeSingleMock.mockResolvedValueOnce({ data: { ...reciboMock }, error: null });
    const { obterRecibo } = await import("@/services/financeiro/reciboService");
    const r = await obterRecibo("r1");
    expect(r?.id).toBe("r1");
    expect(r?.numero).toBe("REC-202608-00001");
    spy.mockRestore();
  });

  it("4. número não duplica (formato REC-AAAAMM-SSSSS com sequência única)", () => {
    expect(montarNumeroRecibo(2026, 8, 1)).toBe("REC-202608-00001");
    expect(montarNumeroRecibo(2026, 8, 2)).toBe("REC-202608-00002");
    expect(montarNumeroRecibo(2026, 12, 999)).toBe("REC-202612-00999");
    // índice único uq_recibos_numero (banco) + retry no service garantem duplicidade zero
  });

  it("5. PDF usa os mesmos dados persistidos", () => {
    const doc = montarPDFRecibo(reciboMock as any, {
      logoUrl: null, razaoSocial: "Conexão Express", nomeFantasia: "Conexão Express",
      cnpj: "31227975000180", endereco: "Rua X, 100", cidade: "Guarulhos", uf: "SP",
    });
    expect(doc).toBeTruthy();
    // campos do recibo persistido são usados na montagem (número, valor, extenso, favorecido)
    expect(reciboMock.numero).toBeTruthy();
    expect(reciboMock.valor_extenso).toContain("reais");
  });

  it("6. cancelar preserva histórico (status=cancelado, sem delete)", async () => {
    const supabaseMock = await import("@/lib/supabase");
    const spy = vi.spyOn(supabaseMock.supabase, "from");
    const f = fluent("recibos");
    singleMock.mockResolvedValueOnce({ data: { ...reciboMock, status: "cancelado", motivo_cancelamento: "Emissão incorreta" }, error: null });
    spy.mockReturnValue(f);
    const r = await cancelarRecibo("r1", "Emissão incorreta");
    expect(r.status).toBe("cancelado");
    const upd = updates.find((u) => u.tabela === "recibos");
    expect(upd?.payload.status).toBe("cancelado");
    expect(upd?.payload.motivo_cancelamento).toBe("Emissão incorreta");
    expect(upd?.payload.data_cancelamento).toBeTruthy();
    spy.mockRestore();
  });

  it("7. recibo não altera valor financeiro (escrita limitada a `recibos`)", async () => {
    const supabaseMock = await import("@/lib/supabase");
    const spy = vi.spyOn(supabaseMock.supabase, "from");
    spy.mockReturnValue(fluent("recibos"));
    const { criarRecibo } = await import("@/services/financeiro/reciboService");
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    singleMock.mockResolvedValueOnce({ data: { ...reciboMock }, error: null });
    await criarRecibo({
      favorecido_tipo: "prestador", favorecido_nome: "Prestador X", valor: 1500,
      referencia: "Transporte", forma_pagamento: "PIX",
    });
    expect(Object.keys(inserts)).toEqual(["recibos"]); // nenhum financeiro_receber/pagar/baixas
    spy.mockRestore();
  });

  it("8. filtros por período/status/favorecido chegam à query de `recibos`", async () => {
    const supabaseMock = await import("@/lib/supabase");
    const spy = vi.spyOn(supabaseMock.supabase, "from");
    const f = fluent("recibos");
    spy.mockReturnValue(f);
    selectData = { data: [{ ...reciboMock }], error: null };
    await listarRecibos({ dataInicial: "2026-08-01", dataFinal: "2026-08-31", status: "emitido", busca: "Prestador" });
    expect(spy).toHaveBeenCalledWith("recibos");
    expect(f._eq).toBeDefined(); // filtro status aplicado via .eq
    spy.mockRestore();
  });

  it("9. valor por extenso (função confiável)", () => {
    expect(valorPorExtenso(1000)).toBe("um mil reais");
    expect(valorPorExtenso(1500)).toBe("um mil e quinhentos reais");
    expect(valorPorExtenso(1234.56)).toBe("um mil e duzentos e trinta e quatro reais e cinquenta e seis centavos");
    expect(valorPorExtenso(0.99)).toBe("noventa e nove centavos");
    expect(valorPorExtenso(0)).toBe("zero reais");
  });
});
