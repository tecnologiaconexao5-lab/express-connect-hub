import { describe, it, expect } from "vitest";
import {
  derivarSituacaoPodFinanceiro,
  derivarStatusComprovanteFinanceiro,
  SITUACAO_POD_FINANCEIRO_LABEL,
  type PODInfoFinanceiro,
} from "@/services/comprovantes/comprovantesService";
import { escalaParaItemRepasse, isAlocacaoFaturavel } from "@/services/escala/escalaFinanceiroAdapter";
import { podExisteParaFaturamento } from "@/services/financeiro/receberService";

describe("MISSÃO A23 — FASE D — POD ↔ Financeiro", () => {
  it("1 — operação sem POD → Financeiro mostra pendente", () => {
    const info: PODInfoFinanceiro = derivarSituacaoPodFinanceiro(null);
    expect(info.situacao).toBe("pendente");
    expect(SITUACAO_POD_FINANCEIRO_LABEL[info.situacao]).toBe("POD pendente");
    expect(info.podId).toBeNull();
  });

  it("2 — operação com POD → reconhecida corretamente", () => {
    const info = derivarSituacaoPodFinanceiro({
      id: "pod-1",
      status: "entregue",
      foto_entrega_url: "https://x/f.jpg",
      assinatura_url: "https://x/s.png",
      nome_recebedor: "Maria",
    });
    expect(info.situacao).toBe("completo");
    expect(info.podId).toBe("pod-1");
  });

  it("3 — foto detectada", () => {
    const info = derivarSituacaoPodFinanceiro({ id: "pod-1", status: "entregue", foto_entrega_url: "https://x/f.jpg" });
    expect(info.temFoto).toBe(true);
    expect(info.temCanhoto).toBe(false);
  });

  it("4 — assinatura detectada", () => {
    const info = derivarSituacaoPodFinanceiro({ id: "pod-1", status: "entregue", assinatura_url: "https://x/s.png" });
    expect(info.temAssinatura).toBe(true);
  });

  it("5 — canhoto detectado", () => {
    const info = derivarSituacaoPodFinanceiro({ id: "pod-1", status: "entregue", foto_canhoto_url: "https://x/c.jpg" });
    expect(info.temCanhoto).toBe(true);
    expect(info.temFoto).toBe(true);
  });

  it("6 — entregue com ressalva", () => {
    const info = derivarSituacaoPodFinanceiro({ id: "pod-1", status: "entregue_ressalva" });
    expect(info.situacao).toBe("entregue_ressalva");
    expect(SITUACAO_POD_FINANCEIRO_LABEL[info.situacao]).toBe("Com ressalva");
  });

  it("7 — não entregue", () => {
    const info = derivarSituacaoPodFinanceiro({ id: "pod-1", status: "nao_entregue" });
    expect(info.situacao).toBe("nao_entregue");
    expect(SITUACAO_POD_FINANCEIRO_LABEL[info.situacao]).toBe("Não entregue");
  });

  it("8 — POD parcial (foto sem assinatura) → parcial", () => {
    const info = derivarSituacaoPodFinanceiro({ id: "pod-1", status: "entregue", foto_entrega_url: "https://x/f.jpg", nome_recebedor: "João" });
    expect(info.situacao).toBe("parcial");
    expect(info.temAssinatura).toBe(false);
  });

  it("9 — PagamentoPrestadores reconhece POD em entregas_protocolo (via podOverride)", () => {
    const aloc = {
      id: "aloc-1",
      osNumero: "OS-1",
      prestadorId: "prest-1",
      prestadorNome: "Motorista X",
      totals: { valorBase: 100, totalAdicionais: 10, totalDescontos: 0, total: 110 },
    };
    // POD existe em entregas_protocolo → status enviado (MESMO que comprovante_url null)
    const comPod = escalaParaItemRepasse(aloc as any, { id: "pod-1" });
    expect(comPod.comprovanteStatus).toBe("enviado");

    // Sem POD → pendente
    const semPod = escalaParaItemRepasse(aloc as any, null);
    expect(semPod.comprovanteStatus).toBe("pendente");
  });

  it("10 — POD existente somente em entregas_protocolo não é tratado como ausente (comprovante_url null)", () => {
    // A alocação NÃO tem comprovante_url; mas o POD real está em entregas_protocolo.
    const aloc = {
      id: "aloc-1",
      osNumero: "OS-1",
      prestadorId: "prest-1",
      prestadorNome: "Motorista X",
      totals: { valorBase: 100, totalAdicionais: 0, totalDescontos: 0, total: 100 },
      comprovante_url: null,
    };
    const item = escalaParaItemRepasse(aloc as any, { id: "pod-9", status: "entregue" });
    expect(item.comprovanteStatus).toBe("enviado");
  });

  it("11 — regra atual de pagamento preservada (isAlocacaoFaturavel inalterada)", () => {
    expect(isAlocacaoFaturavel({ id: "a", status: "concluida" })).toBe(true);
    expect(isAlocacaoFaturavel({ id: "a", status: "cancelada" })).toBe(false);
    expect(isAlocacaoFaturavel({ id: "a", status: "concluida", statusPagamento: "cancelado" })).toBe(false);
  });

  it("12 — ausência de POD gera alerta para faturamento SEM criar bloqueio definitivo", () => {
    // podExisteParaFaturamento é informativo (não lança/bloqueia)
    expect(podExisteParaFaturamento(null)).toBe(false);
    expect(podExisteParaFaturamento({ id: "pod-1" })).toBe(true);
    // Derivar situação também nunca lança
    expect(() => derivarSituacaoPodFinanceiro(null)).not.toThrow();
  });
});
