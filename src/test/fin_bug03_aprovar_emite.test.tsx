// ═══════════════════════════════════════════════════════════════════════════════
// FIN-BUG-03 — APROVAR + EMITIR EM UM CLIQUE (a aprovação sai do "Rascunho")
//   1) Comportamento: clicar em Aprovar chama aprovarFatura -> emitirFatura
//      (na ordem) e exibe o Nº oficial gerado pela f_emitir_fatura.
//   2) Falha na emissão: a fatura permanece APROVADA e o usuário é orientado
//      a finalizar pelo painel (sem sucesso silencioso).
//   3) Falha na aprovação: NÃO emite.
//   4) Estrutural: o contrato TMS-FAT-URG-04 do diálogo manual é preservado
//      (o diálogo continua NÃO emitindo — ele só cria e envia para validação).
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const FAT_AGUARDANDO = {
  id: "f1", tenant_id: "t", numero: null, numero_cliente: null, cliente_id: null,
  modelo: "conexao_express", descricao: null, data_emissao: "2026-10-06",
  competencia_inicio: null, competencia_fim: null, vencimento: "2026-11-06",
  valor_bruto: 810.4, descontos: 0, acrescimos: 0, valor_total: 810.4,
  status: "aguardando_aprovacao", observacao: null, observacao_fiscal: null,
  conta_receber_id: null, criado_por: null, criado_em: "2026-10-06T01:45:07Z",
  atualizado_por: null, atualizado_em: "2026-10-06T01:45:07Z", cancelado_em: null,
  cancelado_por: null, motivo_cancelamento: null, metadata: { origem: "manual" },
};

const M = vi.hoisted(() => ({
  listarFaturas: vi.fn(),
  enviarFaturaParaValidacao: vi.fn(),
  aprovarFatura: vi.fn(),
  emitirFatura: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("@/services/financeiro/faturaService", () => ({
  listarFaturas: M.listarFaturas,
  buscarFaturaComItens: vi.fn(async () => null),
  buscarDadosEmpresaParaFatura: vi.fn(async () => null),
  buscarClienteParaFatura: vi.fn(async () => null),
  montarInputPdfFatura: vi.fn(() => ({})),
  excluirFaturaManual: vi.fn(async () => ({ error: null })),
  cancelarFaturaManualEmitida: vi.fn(async () => ({ error: null })),
  enviarFaturaParaValidacao: M.enviarFaturaParaValidacao,
  aprovarFatura: M.aprovarFatura,
  emitirFatura: M.emitirFatura,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [] }) }) }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => M.toast.success(...a),
    error: (...a: unknown[]) => M.toast.error(...a),
    warning: (...a: unknown[]) => M.toast.warning(...a),
    info: (...a: unknown[]) => M.toast.info(...a),
  },
}));

vi.mock("@/utils/pdfFatura", () => ({ baixarPDFFatura: vi.fn() }));
vi.mock("@/components/financeiro/FaturaPanel", () => ({ FaturaPanel: () => null }));
vi.mock("@/components/financeiro/FaturaManualDialog", () => ({ FaturaManualDialog: () => null }));

import { FaturaLista } from "@/components/financeiro/FaturaLista";

const BTN_APROVAR = "Aprovar e emitir (gera Nº oficial e Conta a Receber)";

beforeEach(() => {
  vi.clearAllMocks();
  M.listarFaturas.mockResolvedValue([{ ...FAT_AGUARDANDO }]);
});
afterEach(() => { vi.restoreAllMocks(); });

describe("FIN-BUG-03 — aprovar também emite (lista de faturas)", () => {
  it("1) Aprovar dispara aprovarFatura -> emitirFatura (na ordem) e mostra o Nº oficial", async () => {
    M.aprovarFatura.mockResolvedValue({ success: true, status: "aprovada" });
    M.emitirFatura.mockResolvedValue({ success: true, numero: "FAT-2026-000023", numeroCliente: 23, contaReceberId: "ar1" });

    render(<FaturaLista />);
    const btn = await screen.findByTitle(BTN_APROVAR);
    fireEvent.click(btn);

    await waitFor(() => expect(M.emitirFatura).toHaveBeenCalledTimes(1));
    expect(M.aprovarFatura).toHaveBeenCalledWith("f1");
    expect(M.emitirFatura).toHaveBeenCalledWith("f1");
    // ordem: aprovação antes da emissão (a emissão exige status aprovada)
    expect(M.aprovarFatura.mock.invocationCallOrder[0])
      .toBeLessThan(M.emitirFatura.mock.invocationCallOrder[0]);
    await waitFor(() => expect(M.toast.success).toHaveBeenCalledWith(
      expect.stringContaining("FAT-2026-000023"),
    ));
    expect(M.toast.error).not.toHaveBeenCalled();
  });

  it("2) emissão falhou: aprovação acontece, erro é exibido e o usuário é orientado ao painel", async () => {
    M.aprovarFatura.mockResolvedValue({ success: true, status: "aprovada" });
    M.emitirFatura.mockResolvedValue({ success: false, error: "FATURA_NAO_APROVADA" });

    render(<FaturaLista />);
    fireEvent.click(await screen.findByTitle(BTN_APROVAR));

    await waitFor(() => expect(M.toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Aprovada, mas não foi possível emitir"),
    ));
    expect(M.emitirFatura).toHaveBeenCalledTimes(1);
    expect(M.toast.success).not.toHaveBeenCalled();
  });

  it("3) falha na aprovação NÃO emite", async () => {
    M.aprovarFatura.mockResolvedValue({ success: false, error: "TRANSICAO_INVALIDA" });

    render(<FaturaLista />);
    fireEvent.click(await screen.findByTitle(BTN_APROVAR));

    await waitFor(() => expect(M.toast.error).toHaveBeenCalledWith("TRANSICAO_INVALIDA"));
    expect(M.emitirFatura).not.toHaveBeenCalled();
  });

  it("4) botão de aprovar só aparece para faturas aguardando aprovação", async () => {
    M.listarFaturas.mockResolvedValue([{ ...FAT_AGUARDANDO, status: "rascunho" }]);
    render(<FaturaLista />);
    await waitFor(() => expect(M.listarFaturas).toHaveBeenCalled());
    expect(screen.queryByTitle(BTN_APROVAR)).toBeNull();
  });
});

describe("FIN-BUG-03 — contratos estruturais preservados", () => {
  it("5) FaturaLista e FaturaPanel emitem na aprovação", () => {
    const lista = read("src/components/financeiro/FaturaLista.tsx");
    expect(lista).toContain("const em = await emitirFatura(f.id);");
    expect(lista).toContain(`title="${BTN_APROVAR}"`);

    const panel = read("src/components/financeiro/FaturaPanel.tsx");
    expect(panel).toContain("const em = await emitirFatura(fatura.id);");
    expect(panel).toContain(`title="${BTN_APROVAR}"`);
  });

  it("6) diálogo manual continua NÃO emitindo (TMS-FAT-URG-04 preservado)", () => {
    const manual = read("src/components/financeiro/FaturaManualDialog.tsx");
    expect(manual).not.toContain("emitirFatura(");
    expect(manual).toContain("enviarFaturaParaValidacao");
    expect(manual).toContain("Salvar e Enviar para Validação");
  });

  it("7) nenhum teste legado proíbe emitirFatura na lista", () => {
    const urg04 = read("src/test/fin_fat_urg_04_fluxo_obrigatorio.test.ts");
    // a proibição vigente é apenas sobre o diálogo manual (SRC_MANUAL)
    expect(urg04).toContain('const SRC_MANUAL = "src/components/financeiro/FaturaManualDialog.tsx"');
    expect(urg04).not.toMatch(/SRC_FATURA_LISTA[\s\S]{0,400}emitirFatura\(/);
  });
});
