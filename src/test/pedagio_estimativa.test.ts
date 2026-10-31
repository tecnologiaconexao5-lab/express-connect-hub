import { describe, it, expect } from "vitest";
import { estimarPedagio, EIXOS_POR_VEICULO } from "@/lib/pedagioEstimativa";

describe("estimarPedagio (FIX 4 — pedágio por eixos × distância)", () => {
  it("estima moto em 100 km como 2 praças × R$ 13,50 (2 eixos)", () => {
    const r = estimarPedagio(100, "moto");
    expect(r.eixos).toBe(2);
    expect(r.pracas).toBe(2);
    expect(r.tarifaPorPraca).toBe(13.5);
    expect(r.valor).toBe(27);
  });

  it("estima toco (3 eixos) em 100 km como 2 praças × R$ 20,00", () => {
    const r = estimarPedagio(100, "toco");
    expect(r.eixos).toBe(3);
    expect(r.pracas).toBe(2);
    expect(r.tarifaPorPraca).toBe(20);
    expect(r.valor).toBe(40);
  });

  it("estima carreta (5 eixos) em 300 km como 7 praças × R$ 33,00", () => {
    const r = estimarPedagio(300, "carreta");
    expect(r.eixos).toBe(5);
    expect(r.pracas).toBe(7);
    expect(r.tarifaPorPraca).toBe(33);
    expect(r.valor).toBe(231);
  });

  it("não estima rota curta (urbana) abaixo de 40 km", () => {
    expect(estimarPedagio(20, "carro_passeio").valor).toBe(0);
  });

  it("não estima sem tipo de veículo (sem eixos)", () => {
    expect(estimarPedagio(100, "").valor).toBe(0);
    expect(estimarPedagio(100, null).valor).toBe(0);
    expect(estimarPedagio(100, undefined).valor).toBe(0);
  });

  it("garante ao menos 1 praça em rota ≥ 40 km", () => {
    const r = estimarPedagio(45, "carro_passeio");
    expect(r.pracas).toBe(1);
    expect(r.valor).toBe(13.5);
  });

  it("mapeia todos os tipos do TIPOS_VEICULO para eixos", () => {
    const tipos = [
      "moto", "carro_passeio", "fiorino", "kangoo", "kombi", "van", "hr",
      "vuc", "tres_quartos", "toco", "truck", "bitruck", "carreta", "bitrem",
    ];
    for (const t of tipos) {
      expect(EIXOS_POR_VEICULO[t]).toBeGreaterThan(0);
    }
  });
});
