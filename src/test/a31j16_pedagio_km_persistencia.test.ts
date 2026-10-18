import { describe, it, expect } from "vitest";
import { calcularResumoLancamento, calcularKmDuasPernas } from "@/services/financeiro/centralFinanceiroVisao";

// Cenário real A31-J1.6: HR, franquia 140, R$1/km, km 159,6 → excedente 19,6 nas duas pernas.
const ctx = {
  franquiaCliente: 140,
  valorKmExcCliente: 1,
  franquiaPrestador: 140,
  valorKmPrestador: 1,
};

describe("A31-J1.6 — Pedágio + KM excedente (duas pernas, sem duplicidade)", () => {
  it("1. pedágio prestador não duplica (contado 1x)", () => {
    const r = calcularResumoLancamento({
      valor_frete: "600",
      valor_repasse: "520",
      valor_pedagio: "66.43",
      km_realizados: "159.6",
      tabela_km: ctx,
    });
    expect(r.valorPrestadorTotal).toBeCloseTo(520 + 19.6 + 66.43, 5); // 606.03 (não 652.86)
  });

  it("2. pedágio prestador não vira 'Outros adicionais' do cliente", () => {
    const r = calcularResumoLancamento({
      valor_frete: "600",
      valor_repasse: "520",
      valor_pedagio: "66.43",
      km_realizados: "159.6",
      tabela_km: ctx,
    });
    expect(r.outrosCliente).toBe(0); // pedágio NÃO entra em "Outros adicionais"
    expect(r.valorClienteTotal).toBeCloseTo(600 + 19.6, 5); // 619.60 sem pedágio cliente
  });

  it("3. pedágio cliente e prestador são independentes (flag oficial)", () => {
    const semCobranca = calcularResumoLancamento({
      valor_frete: "600",
      valor_repasse: "520",
      valor_pedagio: "66.43",
      pedagio_cobrar_excedente: false,
      km_realizados: "159.6",
      tabela_km: ctx,
    });
    expect(semCobranca.valorClienteTotal).toBeCloseTo(619.6, 5);
    expect(semCobranca.pedagioCliente).toBe(0);

    const comCobranca = calcularResumoLancamento({
      valor_frete: "600",
      valor_repasse: "520",
      valor_pedagio: "66.43",
      pedagio_cobrar_excedente: true,
      km_realizados: "159.6",
      tabela_km: ctx,
    });
    expect(comCobranca.valorClienteTotal).toBeCloseTo(600 + 19.6 + 66.43, 5); // 686.03
    expect(comCobranca.pedagioCliente).toBeCloseTo(66.43, 5);
    expect(comCobranca.valorPrestadorTotal).toBeCloseTo(606.03, 5); // inalterado
  });

  it("4. KM excedente reconstruído igual à prévia (mesma fórmula da Central)", () => {
    const km = calcularKmDuasPernas(159.6, ctx);
    expect(km.excedenteCliente).toBeCloseTo(19.6, 5);
    expect(km.excedentePrestador).toBeCloseTo(19.6, 5);
    expect(km.totalExcedenteCliente).toBeCloseTo(19.6, 5);
    expect(km.totalExcedentePrestador).toBeCloseTo(19.6, 5);
  });

  it("5. soma cliente correta (resultado esperado da missão)", () => {
    const r = calcularResumoLancamento({
      valor_frete: "600",
      valor_repasse: "520",
      km_realizados: "159.6",
      tabela_km: ctx,
    });
    expect(r.valorClienteTotal).toBeCloseTo(619.6, 5); // 600 + 19.6 + pedágio 0
  });

  it("6. soma prestador correta (resultado esperado da missão)", () => {
    const r = calcularResumoLancamento({
      valor_frete: "600",
      valor_repasse: "520",
      valor_pedagio: "66.43",
      km_realizados: "159.6",
      tabela_km: ctx,
    });
    expect(r.valorPrestadorTotal).toBeCloseTo(606.03, 5); // 520 + 19.6 + 66.43
  });

  it("7. franquias/preços diferentes respeitam cada fonte (não assume iguais)", () => {
    const r = calcularResumoLancamento({
      valor_frete: "600",
      valor_repasse: "520",
      valor_pedagio: "30",
      km_realizados: "200",
      tabela_km: { franquiaCliente: 140, valorKmExcCliente: 1, franquiaPrestador: 180, valorKmPrestador: 2 },
    });
    // cliente: 60 km excedente × R$1
    // prestador: 20 km excedente × R$2
    expect(r.valorClienteTotal).toBeCloseTo(600 + 60, 5);
    expect(r.valorPrestadorTotal).toBeCloseTo(520 + 40 + 30, 5);
  });
});
