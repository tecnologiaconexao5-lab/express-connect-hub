import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";

// ============================================================================
// MICRO-EDICAO-FATURA — lápis da lista → FaturaPanel em MODO DE EDIÇÃO
//   1) emitida + modo="editar" → campos liberados + botão "Salvar Alterações"
//   2) emitida + modo padrão    → comportamento legado (sem campos)
//   3) rascunho + modo padrão   → regressão legado (Salvar Rascunho)
//   4) FaturaLista: lápis passa "editar"; botões de workflow não passam
//   5) FaturaPanel: um único X de fechar (built-in do Dialog shadcn)
// ============================================================================

const EMITIDA = {
  id: "f1", tenant_id: "t", numero: "FAT-2026-000010", numero_cliente: 7,
  cliente_id: "c1", modelo: "conexao_express", descricao: null,
  data_emissao: "2026-09-24", competencia_inicio: null, competencia_fim: null,
  vencimento: "2026-10-24", valor_bruto: 100, descontos: 0, acrescimos: 0,
  valor_total: 100, status: "emitida", observacao: null, observacao_fiscal: null,
  conta_receber_id: "ar1", criado_por: null, criado_em: "2026-09-24T00:00:00Z",
  atualizado_por: null, atualizado_em: "2026-09-24T00:00:00Z", cancelado_em: null,
  cancelado_por: null, motivo_cancelamento: null, metadata: {},
};
const RASCUNHO = { ...EMITIDA, numero: null, numero_cliente: null, status: "rascunho", conta_receber_id: null };
const CANCELADA = { ...EMITIDA, status: "cancelada", motivo_cancelamento: "teste" };
const ITEM = {
  id: "i1", fatura_id: "f1", os_id: null, alocacao_id: null, cliente_id: "c1",
  romaneio: null, descricao: "Serviço teste", data_servico: "2026-09-24",
  valor_base: 100, valor_adicionais: 0, valor_descontos: 0, valor_total: 100,
  km_excedente: 0, pedagio_cliente: 0, ajudante_cliente: 0, diaria_cliente: 0,
  saidas_adicionais_cliente: 0, status: "ativo", criado_por: null,
  criado_em: "2026-09-24T00:00:00Z", atualizado_em: "2026-09-24T00:00:00Z",
};

let FATURA: Record<string, unknown> = EMITIDA;
const atualizarFatura = vi.fn(async (..._args: unknown[]) => ({ success: true, fatura: { ...FATURA } }));

vi.mock("@/services/financeiro/faturaService", () => ({
  buscarFaturaComItens: vi.fn(async () => ({ ...FATURA, itens: [ITEM] })),
  atualizarFatura: (...a: unknown[]) => atualizarFatura(...a),
  emitirFatura: vi.fn(async () => ({ success: false, error: "não usado" })),
  cancelarFatura: vi.fn(async () => ({ success: true })),
  removerItemFatura: vi.fn(async () => ({ success: true })),
  enviarFaturaParaValidacao: vi.fn(async () => ({ success: true })),
  aprovarFatura: vi.fn(async () => ({ success: true })),
  devolverFaturaParaRascunho: vi.fn(async () => ({ success: true })),
  verificarNumeroFaturaManualDisponivel: vi.fn(async () => ({ disponivel: true })),
  buscarDadosEmpresaParaFatura: vi.fn(async () => ({
    razaoSocial: "Conexão Express", nomeFantasia: "Conexão Express",
    banco: "", agencia: "", conta: "", pix: "", cnpj: "", ie: "",
    endereco: "", cidade: "", uf: "", cep: "",
  })),
  buscarClienteParaFatura: vi.fn(async () => ({
    razaoSocial: "CLIENTE TESTE", nomeFantasia: "Cliente Teste", cnpj: "00.000.000/0001-00",
    ie: null, inscricaoMunicipal: null, endereco: "", cidade: "", uf: "",
    vencimentoPadraoDias: null, tipoCobranca: null, tabelaValoresPadraoId: null,
  })),
  montarPreviaFatura: vi.fn(() => ({
    numero: "", descricao: "", cliente: "", data: "", vencimento: "", itens: [],
    subtotal: 0, acrescimos: 0, descontos: 0, total: 0, observacao: "",
    empresa: {}, dadosCliente: null,
  })),
  montarInputPdfFatura: vi.fn(() => ({})),
  sugerirModeloFaturaParaCliente: vi.fn(async () => "conexao_express"),
  sugerirVencimentoParaCliente: vi.fn(async () => "2026-10-24"),
  montarDescricaoCalvo: vi.fn(() => ""),
  montarObservacaoRomaneios: vi.fn(() => ""),
}));
vi.mock("@/utils/pdfFatura", () => ({ baixarPDFFatura: vi.fn(async () => {}) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

import { FaturaPanel } from "@/components/financeiro/FaturaPanel";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

afterEach(() => { cleanup(); FATURA = EMITIDA; atualizarFatura.mockClear(); });

async function renderPanel(extra: Record<string, unknown> = {}) {
  render(
    <MemoryRouter>
      <FaturaPanel
        open
        onOpenChange={() => {}}
        itens={[]}
        clienteNome="CLIENTE TESTE"
        onEmitida={() => {}}
        faturaId="f1"
        {...extra}
      />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.queryByText(/carregando/)).toBeNull());
  await waitFor(() => expect(screen.getAllByText("Nº Conexão").length).toBeGreaterThan(0));
}

describe("MICRO-EDICAO-FATURA — modo edição via lápis", () => {
  it("1) emitida + modo=editar → campos liberados e botão Salvar Alterações", async () => {
    FATURA = EMITIDA;
    await renderPanel({ modo: "editar" });
    expect(screen.getByText(/Nº da Fatura \(Opcional/)).toBeTruthy();
    expect(screen.getByText(/Vencimento \(sugerido/)).toBeTruthy();
    expect(screen.getByText(/Observação \(opcional\)/)).toBeTruthy();
    expect(screen.getByText(/Data da Fatura \/ Emissão/)).toBeTruthy();
    expect(screen.getByText("Salvar Alterações")).toBeTruthy();
    // aviso de integridade: emitida não altera a Conta a Receber vinculada
    expect(screen.getByText(/Conta a Receber vinculada não é atualizada automaticamente/)).toBeTruthy();
    // ações do workflow de rascunho continuam ausentes em fatura emitida
    expect(screen.queryByText("Salvar Rascunho")).toBeNull();
    expect(screen.queryByText("Enviar para Validação")).toBeNull();
  });

  it("1b) emitida + modo=editar → Salvar Alterações persiste via atualizarFatura sem tocar em status", async () => {
    FATURA = EMITIDA;
    await renderPanel({ modo: "editar" });
    expect(atualizarFatura).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Salvar Alterações"));
    await waitFor(() => expect(atualizarFatura).toHaveBeenCalledTimes(1));
    const chamada = atualizarFatura.mock.calls[0];
    expect(chamada[0]).toBe("f1");
    expect(chamada[1]).toHaveProperty("vencimento");
    expect(chamada[1]).toHaveProperty("observacao");
    // integridade: payload NÃO tenta trocar o status (guard trg_faturas_protege_status)
    expect(chamada[1]).not.toHaveProperty("status");
  });

  it("2) emitida + modo padrão (sem prop) → comportamento legado: sem campos", async () => {
    FATURA = EMITIDA;
    await renderPanel();
    expect(screen.queryByText(/Vencimento \(sugerido/)).toBeNull();
    expect(screen.queryByText(/Nº da Fatura \(Opcional/)).toBeNull();
    expect(screen.queryByText("Salvar Alterações")).toBeNull();
    expect(screen.queryByText("Salvar Rascunho")).toBeNull();
    // ações da emitida permanecem
    expect(screen.getByText("Baixar PDF")).toBeTruthy();
    expect(screen.getByText("Cancelar Fatura")).toBeTruthy();
  });

  it("3) rascunho + modo padrão → regressão: campos + Salvar Rascunho + Enviar para Validação", async () => {
    FATURA = RASCUNHO;
    await renderPanel();
    expect(screen.getByText(/Vencimento \(sugerido/)).toBeTruthy();
    expect(screen.getByText("Salvar Rascunho")).toBeTruthy();
    expect(screen.getByText("Enviar para Validação")).toBeTruthy();
    // fora de rascunho não há botão extra de edição
    expect(screen.queryByText("Salvar Alterações")).toBeNull();
    // remover item continua liberado apenas em rascunho
    expect(screen.getAllByTitle("Remover item").length).toBeGreaterThan(0);
  });

  it("3b) emitida + modo=editar → item NÃO é removível (bloqueio de banco preservado)", async () => {
    FATURA = EMITIDA;
    await renderPanel({ modo: "editar" });
    expect(screen.queryAllByTitle("Remover item").length).toBe(0);
    expect(screen.queryAllByTitle("Ver detalhe do valor").length).toBeGreaterThan(0);
  });

  it("4) cancelada nunca abre edição mesmo com modo=editar", async () => {
    FATURA = CANCELADA;
    await renderPanel({ modo: "editar" });
    expect(screen.queryByText(/Vencimento \(sugerido/)).toBeNull();
    expect(screen.queryByText("Salvar Alterações")).toBeNull();
    expect(screen.queryAllByText(/Cancelada/i).length).toBeGreaterThan(0); // badge permanece
  });
});

describe("MICRO-EDICAO-FATURA — FaturaLista passa o modo do lápis", () => {
  const src = read("src/components/financeiro/FaturaLista.tsx");

  it("5) lápis (rascunho e emitida) chamam abrirEdicao(f, 'editar')", () => {
    const matches = src.match(/abrirEdicao\(f, "editar"\)/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2); // lápis rascunho + lápis emitida
  });

  it("6) botões de workflow mantêm modo padrão 'abrir'", () => {
    // FileText (aguardando aprovação) e Printer (aprovada) são ações, não edição
    expect(src).toMatch(/title="Abrir fatura" onClick=\{\(\) => abrirEdicao\(f\)\}/);
    expect(src).toMatch(/title="Revisar e emitir" onClick=\{\(\) => abrirEdicao\(f\)\}/);
  });

  it("7) FaturaPanel recebe a prop modo={modoPainelFatura}", () => {
    expect(src).toContain("modo={modoPainelFatura}");
    expect(src).toContain('useState<"abrir" | "editar">("abrir")');
  });
});

describe("MICRO-EDICAO-FATURA — apenas UM X de fechar no topo", () => {
  it("8) FaturaPanel não renderiza X próprio (X vem do DialogContent shadcn)", () => {
    const panel = read("src/components/financeiro/FaturaPanel.tsx");
    // nenhum botão <X ...> no painel → o único X é o built-in do Dialog
    expect(panel).not.toMatch(/<X[\s/>]/);
    // e nenhum botão extra chamado "Fechar" no cabeçalho principal
    expect(panel).toContain("DialogContent");
  });

  it("9) trava de duplicidade do número preservada no painel", () => {
    const panel = read("src/components/financeiro/FaturaPanel.tsx");
    expect(panel).toContain("numeroChecado === false");
    expect(panel).toContain("verificarNumeroFaturaManualDisponivel");
  });
});
