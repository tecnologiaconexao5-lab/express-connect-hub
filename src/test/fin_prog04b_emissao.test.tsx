import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

// ============================================================================
// TMS-FIN-PROG-04B — EMISSÃO OFICIAL
// Prova SERVICE = UI para Nº Conexão / Nº Cliente / status / AR vinculado.
// (O lado BANCO foi provado por scripts/_prog04b_provas.mjs em transação.)
// ============================================================================

const EMITIDA = {
  id: "f1", tenant_id: "t", numero: "FAT-2026-000010", numero_cliente: 7,
  cliente_id: "c1", modelo: "conexao_express", descricao: "Teste",
  data_emissao: "2026-09-24", competencia_inicio: null, competencia_fim: null,
  vencimento: "2026-10-24", valor_bruto: 100, descontos: 0, acrescimos: 0,
  valor_total: 100, status: "emitida", observacao: null, observacao_fiscal: null,
  conta_receber_id: "ar1", criado_por: null, criado_em: "2026-09-24T00:00:00Z",
  atualizado_por: null, atualizado_em: "2026-09-24T00:00:00Z", cancelado_em: null,
  cancelado_por: null, motivo_cancelamento: null, metadata: {},
};
const RASCUNHO = { ...EMITIDA, numero: null, numero_cliente: null, status: "rascunho", conta_receber_id: null };
const ITEM = {
  id: "i1", fatura_id: "f1", os_id: null, alocacao_id: null, cliente_id: "c1",
  romaneio: null, descricao: "Serviço teste", data_servico: "2026-09-24",
  valor_base: 100, valor_adicionais: 0, valor_descontos: 0, valor_total: 100,
  km_excedente: 0, pedagio_cliente: 0, ajudante_cliente: 0, diaria_cliente: 0,
  saidas_adicionais_cliente: 0, status: "ativo", criado_por: null,
  criado_em: "2026-09-24T00:00:00Z", atualizado_em: "2026-09-24T00:00:00Z",
};

vi.mock("@/lib/supabase", () => {
  const makeBuilder = (table: string): any => {
    const rows = () => {
      if (table === "faturas") return [(globalThis as any).__PROG04B_FATURA || EMITIDA];
      if (table === "fatura_itens") return [ITEM];
      if (table === "clientes") return [{ id: "c1", razao_social: "CLIENTE TESTE", nome_fantasia: "Cliente Teste", cnpj: "00.000.000/0001-00" }];
      return [];
    };
    const b: any = {};
    for (const m of ["select", "eq", "in", "neq", "gte", "lte", "lt", "or", "ilike", "order", "limit"]) b[m] = () => b;
    b.single = async () => ({ data: rows()[0] ?? null, error: null });
    b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
    b.then = (resolve: any) => resolve({ data: rows(), error: null });
    return b;
  };
  return {
    supabase: {
      from: (t: string) => makeBuilder(t),
      rpc: async () => ({ data: { success: true, numero: "FAT-2026-000010", numero_cliente: 7, conta_receber_id: "ar1" }, error: null }),
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => {},
    },
  };
});

vi.mock("recharts", () => new Proxy({}, { get: () => () => null }));

import { MemoryRouter } from "react-router-dom";
import { buscarFaturaComItens } from "@/services/financeiro/faturaService";
import { FaturaPanel } from "@/components/financeiro/FaturaPanel";

afterEach(cleanup);

describe("TMS-FIN-PROG-04B — SERVICE mapeia Nº Conexão e Nº Cliente", () => {
  it("buscarFaturaComItens retorna numero e numero_cliente", async () => {
    (globalThis as any).__PROG04B_FATURA = EMITIDA;
    const f = await buscarFaturaComItens("f1");
    expect(f?.numero).toBe("FAT-2026-000010");
    expect(f?.numero_cliente).toBe(7);
    expect(f?.status).toBe("emitida");
    expect(f?.conta_receber_id).toBe("ar1");
  });
});

describe("TMS-FIN-PROG-04B — UI (FaturaPanel)", () => {
  it("fatura emitida exibe Nº Conexão e Nº Cliente reais", async () => {
    (globalThis as any).__PROG04B_FATURA = EMITIDA;
    render(<MemoryRouter><FaturaPanel open onOpenChange={() => {}} itens={[]} clienteNome="Cliente Teste" onEmitida={() => {}} faturaId="f1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText("Nº Conexão").length).toBeGreaterThan(0));
    expect(screen.getByText("FAT-2026-000010")).toBeTruthy();
    expect(screen.getAllByText("Nº Cliente").length).toBeGreaterThan(0);
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("rascunho mostra 'será gerado na emissão' (sem números definitivos)", async () => {
    (globalThis as any).__PROG04B_FATURA = RASCUNHO;
    render(<MemoryRouter><FaturaPanel open onOpenChange={() => {}} itens={[]} clienteNome="Cliente Teste" onEmitida={() => {}} faturaId="f1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText("Nº Conexão").length).toBeGreaterThan(0));
    expect(screen.getAllByText("será gerado na emissão").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("FAT-2026-000010")).toBeNull();
  });
});
