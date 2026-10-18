import { describe, it, expect } from "vitest";
import { derivarSemaforoCentral } from "@/services/financeiro/centralFinanceiroService";

describe("FASE 1 — Central Financeira — derivarSemaforoCentral", () => {
  it("verde — serviço pronto (romaneio + POD + valores)", () => {
    const { semaforo, motivos } = derivarSemaforoCentral({
      romaneio: "343198",
      valorClienteTotal: 600,
      valorPrestadorTotal: 300,
      podSituacao: "completo",
      receberStatus: null,
      pagamentoStatus: null,
    });
    expect(semaforo).toBe("verde");
    expect(motivos).toContain("Pronto para conferência");
  });

  it("amarelo — romaneio pendente", () => {
    const { semaforo, motivos } = derivarSemaforoCentral({
      romaneio: null,
      valorClienteTotal: 600,
      valorPrestadorTotal: 300,
      podSituacao: "completo",
      receberStatus: null,
      pagamentoStatus: null,
    });
    expect(semaforo).toBe("amarelo");
    expect(motivos).toContain("Romaneio/OC pendente");
  });

  it("amarelo — POD pendente", () => {
    const { semaforo, motivos } = derivarSemaforoCentral({
      romaneio: "343198",
      valorClienteTotal: 600,
      valorPrestadorTotal: 300,
      podSituacao: "pendente",
      receberStatus: null,
      pagamentoStatus: null,
    });
    expect(semaforo).toBe("amarelo");
    expect(motivos).toContain("POD pendente");
  });

  it("vermelho — valor do cliente ausente", () => {
    const { semaforo, motivos } = derivarSemaforoCentral({
      romaneio: "343198",
      valorClienteTotal: 0,
      valorPrestadorTotal: 300,
      podSituacao: "completo",
      receberStatus: null,
      pagamentoStatus: null,
    });
    expect(semaforo).toBe("vermelho");
    expect(motivos).toContain("Valor do cliente ausente");
  });

  it("vermelho — não entregue", () => {
    const { semaforo } = derivarSemaforoCentral({
      romaneio: "343198",
      valorClienteTotal: 600,
      valorPrestadorTotal: 300,
      podSituacao: "nao_entregue",
      receberStatus: null,
      pagamentoStatus: null,
    });
    expect(semaforo).toBe("vermelho");
  });

  it("recebido aparece nos motivos quando status pago", () => {
    const { motivos } = derivarSemaforoCentral({
      romaneio: "343198",
      valorClienteTotal: 600,
      valorPrestadorTotal: 300,
      podSituacao: "completo",
      receberStatus: "pago",
      pagamentoStatus: null,
    });
    expect(motivos).toContain("Já recebido");
  });
});
