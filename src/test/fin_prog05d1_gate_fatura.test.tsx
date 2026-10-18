import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ============================================================================
// TMS-FIN-PROG-05D.1 — GATE ADMIN: RASCUNHO -> VALIDAR E EMITIR -> 1 AR
// ============================================================================

const item = (o: Partial<Record<string, unknown>>) => ({
  id: "i1", fatura_id: "f1", os_id: null, alocacao_id: "a1", cliente_id: "c1",
  romaneio: "343646", descricao: "Serviço Guarulhos→morumbi", data_servico: "2026-08-18",
  valor_base: 600, valor_adicionais: 0, valor_descontos: 0, valor_total: 600,
  km_excedente: 0, pedagio_cliente: 0, ajudante_cliente: 0, diaria_cliente: 0,
  saidas_adicionais_cliente: 0, status: "ativo", criado_por: null,
  criado_em: "2026-09-08T00:00:00Z", atualizado_em: "2026-09-08T00:00:00Z", ...o,
});
const RASCUNHO: any = {
  id: "f1", tenant_id: "t", numero: null, numero_cliente: null, cliente_id: "c1",
  modelo: "conexao_express", descricao: null, data_emissao: "2026-09-08",
  competencia_inicio: null, competencia_fim: null, vencimento: "2026-10-08",
  valor_bruto: 1200, descontos: 0, acrescimos: 0, valor_total: 1266.43,
  status: "rascunho", observacao: null, observacao_fiscal: null, conta_receber_id: null,
  criado_por: null, criado_em: "2026-09-08T00:00:00Z", atualizado_por: null,
  atualizado_em: "2026-09-08T00:00:00Z", cancelado_em: null, cancelado_por: null,
  motivo_cancelamento: null, metadata: {},
  itens: [item({}), item({ id: "i2", romaneio: "343375", valor_adicionais: 66.43, pedagio_cliente: 66.43, valor_total: 666.43 })],
};
const EMITIDA: any = { ...RASCUNHO, numero: "FAT-2026-000016", numero_cliente: 6, status: "emitida", conta_receber_id: "ar1" };

let emitido = false;
const emitirFatura = vi.fn(async () => { emitido = true; return { success: true, numero: "FAT-2026-000016", numeroCliente: 6, contaReceberId: "ar1" }; });

vi.mock("@/services/financeiro/faturaService", () => ({
  buscarFaturaComItens: vi.fn(async () => (emitido ? EMITIDA : RASCUNHO)),
  emitirFatura: (...a: any[]) => emitirFatura(...a),
  atualizarFatura: vi.fn(async () => ({ success: true })),
  cancelarFatura: vi.fn(async () => ({ success: true })),
  removerItemFatura: vi.fn(async () => ({ success: true })),
  buscarDadosEmpresaParaFatura: vi.fn(async () => ({ razaoSocial: "Conexão Express", nomeFantasia: "Conexão Express", banco: "", agencia: "", conta: "", pix: "", cnpj: "", ie: "", endereco: "", cidade: "", uf: "", cep: "" })),
  buscarClienteParaFatura: vi.fn(async () => ({ razaoSocial: "Calvo Comercio e Importacao LTDA", nomeFantasia: "Calvo", cnpj: "61.116.828/0001-02", ie: null, inscricaoMunicipal: null, endereco: "", cidade: "", uf: "", vencimentoPadraoDias: null, tipoCobranca: null, tabelaValoresPadraoId: null })),
  montarPreviaFatura: vi.fn(() => ({ numero: "", descricao: "", cliente: "", data: "", vencimento: "", itens: [], subtotal: 0, acrescimos: 0, descontos: 0, total: 0, observacao: "", empresa: {}, dadosCliente: null })),
  montarInputPdfFatura: vi.fn(() => ({})),
  sugerirModeloFaturaParaCliente: vi.fn(async () => "conexao_express"),
  sugerirVencimentoParaCliente: vi.fn(async () => "2026-10-08"),
  montarDescricaoCalvo: vi.fn(() => ""),
  montarObservacaoRomaneios: vi.fn(() => ""),
}));
vi.mock("@/utils/pdfFatura", () => ({ baixarPDFFatura: vi.fn(async () => {}), gerarPDFFatura: vi.fn(() => ({})) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import { FaturaPanel } from "@/components/financeiro/FaturaPanel";

afterEach(cleanup);
beforeEach(() => { emitido = false; emitirFatura.mockClear(); });

async function abrirPainel() {
  render(<MemoryRouter><FaturaPanel open onOpenChange={() => {}} itens={[]} clienteNome="Calvo Comercio e Importacao LTDA" onEmitida={() => {}} faturaId="f1" /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText("Validar e Emitir Fatura")).toBeTruthy());
}

describe("TMS-FIN-PROG-05D.1 — Gate Rascunho -> Emitir", () => {
  it("A/B) rascunho: nao emite e nao cria AR (emitirFatura nao chamado)", async () => {
    await abrirPainel();
    expect(emitirFatura).not.toHaveBeenCalled();
    expect(screen.getByText("Validar e Emitir Fatura")).toBeTruthy(); // botao do gate
  });

  it("C) abre o gate com resumo real de conferencia", async () => {
    await abrirPainel();
    fireEvent.click(screen.getByText("Validar e Emitir Fatura"));
    await waitFor(() => expect(screen.getByText("Romaneios/OC")).toBeTruthy());
    expect(screen.getByText("343646, 343375")).toBeTruthy(); // resumo do modal (romaneios reais)
    expect(screen.getByText("Valor base")).toBeTruthy();
    expect(screen.getByText("Adicionais")).toBeTruthy();
    expect(screen.getByText(/não deve ser usada antes da conferência/)).toBeTruthy();
    expect(screen.getByText("Validar e Emitir")).toBeTruthy(); // acao do modal
  });

  it("D) cancelar o modal mantem rascunho e nao emite", async () => {
    await abrirPainel();
    fireEvent.click(screen.getByText("Validar e Emitir Fatura"));
    await waitFor(() => expect(screen.getByText("Cancelar")).toBeTruthy());
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => expect(screen.queryByText("Romaneios/OC")).toBeNull());
    expect(emitirFatura).not.toHaveBeenCalled();
  });

  it("E/F) confirmar emite via f_emitir_fatura e mostra Nº Conexão + Nº Cliente + EMITIDA", async () => {
    await abrirPainel();
    fireEvent.click(screen.getByText("Validar e Emitir Fatura"));
    await waitFor(() => expect(screen.getByText("Validar e Emitir")).toBeTruthy());
    fireEvent.click(screen.getByText("Validar e Emitir"));
    await waitFor(() => expect(emitirFatura).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/FAT-2026-000016 emitida com sucesso/)).toBeTruthy());
    expect(screen.getByText("Nº Conexão")).toBeTruthy();
    expect(screen.getAllByText(/emitida/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Ver em Contas a Receber")).toBeTruthy();
  });

  it("H) fatura emitida nao oferece nova emissao", async () => {
    emitido = true; // simula fatura ja emitida ao abrir
    render(<MemoryRouter><FaturaPanel open onOpenChange={() => {}} itens={[]} clienteNome="Calvo" onEmitida={() => {}} faturaId="f1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText(/emitida/i).length).toBeGreaterThan(0));
    expect(screen.queryByText("Validar e Emitir Fatura")).toBeNull();
  });
});
