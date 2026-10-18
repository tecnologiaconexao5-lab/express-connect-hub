import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ============================================================================
// TMS-FIN-PROG-05C.3B — Contas a Receber: totais globais + paginação real
// ============================================================================

const mk = (i: number, o: { status: string; venc: string; dp?: string | null; valor?: number }) => ({
  id: `id-${i}`,
  cliente_id: "c1", cliente_nome: "Cliente X", cliente_documento: "",
  fatura: `FAT-${i}`, serie: "", numero: String(i), os_vinculadas: "",
  contrato_vinculado: "", proposta_vinculada: "", categoria: "", centro_resultado: "",
  valor_bruto: o.valor ?? 100, desconto: 0, juros: 0, multa: 0, abatimento: 0,
  valor_liquido: o.valor ?? 100,
  data_emissao: "2026-09-01", data_vencimento: o.venc, data_pagamento: o.dp ?? null,
  status: o.status, data_recebimento: null, valor_baixado: null,
  forma_recebimento: "", conta_entrada: "", recorrente: false,
  quantidade_parcelas: 1, parcela_atual: 1, plano_conta: "", observacoes: "",
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  origem: "", origem_id: "", competencia: "2026-09", fatura_id: "", fatura_numero: "", quantidade_itens: 0,
});

const ROWS = [
  ...Array.from({ length: 25 }, (_, i) => mk(i, { status: "aberto", venc: "2099-01-01", valor: 100 })),          // a_vencer = 2500
  ...Array.from({ length: 25 }, (_, i) => mk(25 + i, { status: "aberto", venc: "2020-01-01", valor: 100 })),      // atrasado = 2500
  ...Array.from({ length: 9 }, (_, i) => mk(50 + i, { status: "pago", venc: "2099-01-01", dp: "2026-09-05", valor: 100 })), // pago = 900
  mk(59, { status: "cancelado", venc: "2020-01-01", valor: 99999 }),                                              // cancelado (fora dos totais)
];

vi.mock("@/services/financeiro/receberService", () => ({
  buscarRecebiveisFiltrados: vi.fn(async () => ROWS),
  buscarClientesLista: vi.fn(async () => []),
  verificarDuplicataEscala: vi.fn(async () => false),
  buscarEscalaFaturamento: vi.fn(async () => []),
  buscarDetalheFatura: vi.fn(async () => null),
  criarRecebivel: vi.fn(), atualizarRecebivel: vi.fn(), baixarRecebivel: vi.fn(),
  excluirRecebivel: vi.fn(), renegociarRecebivel: vi.fn(),
}));
vi.mock("@/services/escala/escalaFinanceiroAdapter", () => ({
  escalaParaItemFaturamento: vi.fn(() => ({})),
  isAlocacaoFaturavel: vi.fn(() => true),
}));
vi.mock("@/services/escala/escalaMapper", () => ({ mapearBancoParaLocal: vi.fn((x: unknown) => x) }));
vi.mock("@/services/financeiro/configFinanceiraService", () => ({ buscarContasBancariasConfig: vi.fn(async () => []) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import ContasReceberEnterprise from "@/components/financeiro/ContasReceberEnterprise";
import { buscarRecebiveisFiltrados } from "@/services/financeiro/receberService";
import { buildPageList } from "@/components/ui/PaginationBar";

afterEach(cleanup);

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: string) => s.replace(/\u00a0/g, " ");

async function renderPage() {
  render(<MemoryRouter><ContasReceberEnterprise /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/Exibindo 1–25 de 60/)).toBeTruthy());
}

describe("TMS-FIN-PROG-05C.3B — Contas a Receber", () => {
  it("cards/totais representam TODO o conjunto filtrado (não só a página)", async () => {
    await renderPage();
    const body = norm(document.body.textContent || "");
    // total ativo = 2500 (pendente) + 2500 (vencido) = 5000; recebido = 900
    expect(body).toContain(norm(brl(5000)));
    expect(body).toContain(norm(brl(900)));
    // cancelado (99999) NÃO entra em nenhum total real
    expect(body).not.toContain(norm(brl(99999)));
  });

  it("paginação numerada visível + página 1 → 2 mostra registros diferentes", async () => {
    await renderPage();
    expect(screen.getByTitle("Página 2")).toBeTruthy();
    expect(screen.getByTitle("Página 3")).toBeTruthy();
    const before = document.body.textContent || "";
    fireEvent.click(screen.getByTitle("Página 2"));
    await waitFor(() => expect(screen.getByText(/Exibindo 26–50 de 60/)).toBeTruthy());
    expect(document.body.textContent).not.toBe(before);
    // cards permanecem iguais ao trocar de página
    expect(norm(document.body.textContent || "")).toContain(norm(brl(5000)));
  });

  it("cancelado fica fora dos totais ativos (mesmo presente no conjunto)", async () => {
    await renderPage();
    const tot = norm(document.body.textContent || "");
    expect(tot).toContain(norm(brl(5000)));
    expect(tot).not.toContain(norm(brl(99999)));
  });

  it("busca é enviada à consulta global (servidor) e reseta para página 1", async () => {
    await renderPage();
    fireEvent.click(screen.getByTitle("Página 2"));
    await waitFor(() => expect(screen.getByText(/Exibindo 26–50 de 60/)).toBeTruthy());
    const input = screen.getByPlaceholderText(/Buscar fatura, cliente, OS/);
    fireEvent.change(input, { target: { value: "abc" } });
    await waitFor(() =>
      expect(buscarRecebiveisFiltrados).toHaveBeenCalledWith(expect.objectContaining({ search: "abc" }))
    );
    await waitFor(() => expect(screen.getByText(/Exibindo 1–25 de 60/)).toBeTruthy());
  });
});

describe("TMS-FIN-PROG-05C.3B — buildPageList (paginação numerada)", () => {
  it("gera 1..N com reticências quando aplicável", () => {
    expect(buildPageList(1, 3)).toEqual([1, 2, 3]);
    expect(buildPageList(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
  });
});
