import { describe, it, expect } from "vitest";
import {
  operacaoExigePOD,
  filtrarPodsPendentes,
  type PodPendente,
} from "@/services/comprovantes/comprovantesService";
import { gerarAcoesPrioritarias } from "@/lib/acoesPrioritarias";

describe("MISSÃO A23 — FASE B — Métrica de POD pendente", () => {
  it("1 — operação concluída SEM entregas_protocolo → pendente", () => {
    const alocacoes = [{ id: "a1", ordem_servico_id: "os1", status: "concluida", finalizada: true }];
    const result = filtrarPodsPendentes(alocacoes, new Set<string>());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
    expect(result[0].osId).toBe("os1");
  });

  it("2 — operação concluída COM entregas_protocolo → NÃO pendente", () => {
    const alocacoes = [{ id: "a1", ordem_servico_id: "os1", status: "concluida", finalizada: true }];
    const result = filtrarPodsPendentes(alocacoes, new Set(["a1"]));
    expect(result).toHaveLength(0);
  });

  it("3 — operação aceita sem POD → NÃO tratada como atraso de comprovante", () => {
    const alocacoes = [{ id: "a2", ordem_servico_id: "os2", status: "aceita", finalizada: false }];
    const result = filtrarPodsPendentes(alocacoes, new Set<string>());
    expect(result).toHaveLength(0);
  });

  it("4 — operação em_rota sem POD → NÃO tratada como atraso de comprovante", () => {
    const alocacoes = [{ id: "a3", ordem_servico_id: "os3", status: "em_rota", finalizada: false }];
    const result = filtrarPodsPendentes(alocacoes, new Set<string>());
    expect(result).toHaveLength(0);
  });

  it("5 — finalizada=true (status não-concluida) também exige POD", () => {
    const alocacoes = [{ id: "a4", ordem_servico_id: "os4", status: "ocorrencia", finalizada: true }];
    const result = filtrarPodsPendentes(alocacoes, new Set<string>());
    expect(result).toHaveLength(1);
  });

  it("6 — cancelada/recusada/planejada NÃO entram na contagem", () => {
    const alocacoes = [
      { id: "a5", status: "cancelada", finalizada: false },
      { id: "a6", status: "recusada", finalizada: false },
      { id: "a7", status: "planejada", finalizada: false },
      { id: "a8", status: "aguardando_aceite", finalizada: false },
    ];
    const result = filtrarPodsPendentes(alocacoes as any, new Set<string>());
    expect(result).toHaveLength(0);
  });

  it("7 — operacaoExigePOD: apenas finalizada ou concluida", () => {
    expect(operacaoExigePOD({ status: "concluida", finalizada: true })).toBe(true);
    expect(operacaoExigePOD({ status: "aceita", finalizada: false })).toBe(false);
    expect(operacaoExigePOD({ status: "em_rota", finalizada: false })).toBe(false);
    expect(operacaoExigePOD({ status: "ocorrencia", finalizada: true })).toBe(true);
  });

  it("8 — filtrarPodsPendentes preserva osId apenas quando existir", () => {
    const alocacoes = [
      { id: "a9", ordem_servico_id: null, status: "concluida", finalizada: true },
    ];
    const result: PodPendente[] = filtrarPodsPendentes(alocacoes, new Set<string>());
    expect(result[0].osId).toBeNull();
    expect(result[0].id).toBe("a9");
  });

  it("9 — Central de Alertas: ação comprovante gerada a partir de pendentes reais", () => {
    const acoes = gerarAcoesPrioritarias([], 1, [
      { id: "a1", osId: "os1", osNumero: "OS-001", cliente: "Cliente X", prestador: "Prestador Y" },
    ]);
    const comprovante = acoes.find((a) => a.tipo === "comprovante");
    expect(comprovante).toBeDefined();
    expect(comprovante!.osId).toBe("os1");
    expect(comprovante!.os).toBe("OS-001");
  });

  it("10 — Central de Alertas: comprovante_orfao para pendentes sem vínculo de OS", () => {
    const acoes = gerarAcoesPrioritarias([], 3, [
      { id: "a1", osId: "os1", osNumero: "OS-001", cliente: "C", prestador: "P" },
    ]);
    const orfao = acoes.find((a) => a.tipo === "comprovante_orfao");
    expect(orfao).toBeDefined();
    expect(orfao!.os).toContain("2");
  });

  it("11 — semComprovanteCount sem pendentes não gera ação de comprovante", () => {
    const acoes = gerarAcoesPrioritarias([], 0, []);
    expect(acoes.filter((a) => a.tipo === "comprovante" || a.tipo === "comprovante_orfao")).toHaveLength(0);
  });
});

describe("ExecutiveKpis — suporte opcional a onClick (A23-B)", () => {
  it("1 — KpiItem aceita onClick sem quebrar o contrato", async () => {
    const mod = await import("@/components/torre-controle/ExecutiveKpis");
    const item: mod.KpiItem = {
      key: "pendencias",
      label: "PODs Pendentes",
      value: 5,
      sub: "entregas concluídas sem POD",
      icon: (await import("lucide-react")).FileX,
      tone: "purple",
      onClick: () => undefined,
    };
    expect(item.onClick).toBeDefined();
    expect(item.label).toBe("PODs Pendentes");
    expect(item.sub).toBe("entregas concluídas sem POD");
  });

  it("2 — KpiItem sem onClick permanece válido (cards não clicáveis)", async () => {
    const mod = await import("@/components/torre-controle/ExecutiveKpis");
    const item: mod.KpiItem = {
      key: "ativas",
      label: "Operações Ativas",
      value: 10,
      icon: (await import("lucide-react")).Truck,
      tone: "indigo",
    };
    expect(item.onClick).toBeUndefined();
  });
});
