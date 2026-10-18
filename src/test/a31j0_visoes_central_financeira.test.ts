import { describe, it, expect } from "vitest";
import {
  PRESET_ESSENCIAL,
  PRESET_COMPLETA,
  lerColunasDoModo,
} from "@/services/financeiro/centralFinanceiroVisao";

const ANALITICAS = [
  "valorCliente",
  "adicCliente",
  "valorPrestador",
  "kmExcedente",
  "pedagioCliente",
  "combustivelPrestador",
  "reembolsoPrestador",
];

describe("A31-J0 — Visões da Central Financeira (Essencial x Financeira Completa)", () => {
  it("1. Essencial possui conjunto resumido (analíticas desligadas por padrão)", () => {
    for (const c of ANALITICAS) {
      expect(PRESET_ESSENCIAL[c]).toBe(false);
    }
    expect(PRESET_ESSENCIAL.status).toBe(true);
    expect(PRESET_ESSENCIAL.data).toBe(true);
    expect(PRESET_ESSENCIAL.os).toBe(true);
    expect(PRESET_ESSENCIAL.cliente).toBe(true);
    expect(PRESET_ESSENCIAL.romaneio).toBe(true);
    expect(PRESET_ESSENCIAL.prestador).toBe(true);
    expect(PRESET_ESSENCIAL.veiculo).toBe(true);
    expect(PRESET_ESSENCIAL.totalCliente).toBe(true);
    expect(PRESET_ESSENCIAL.totalPrestador).toBe(true);
    expect(PRESET_ESSENCIAL.pod).toBe(true);
    expect(PRESET_ESSENCIAL.receber).toBe(true);
    expect(PRESET_ESSENCIAL.faturamento).toBe(true);
    expect(PRESET_ESSENCIAL.acoes).toBe(true);
  });

  it("2. Financeira Completa possui conjunto maior (todas as analíticas ligadas)", () => {
    for (const c of ANALITICAS) {
      expect(PRESET_COMPLETA[c]).toBe(true);
    }
    expect(PRESET_COMPLETA.kmExcedente).toBe(true);
    expect(PRESET_COMPLETA.pedagioCliente).toBe(true);
    expect(PRESET_COMPLETA.combustivelPrestador).toBe(true);
    expect(PRESET_COMPLETA.reembolsoPrestador).toBe(true);
  });

  it("3. troca de modo altera efetivamente as colunas", () => {
    const essencial = lerColunasDoModo("essencial", null);
    const completa = lerColunasDoModo("completa", null);
    const ativasEssencial = Object.values(essencial).filter(Boolean).length;
    const ativasCompleta = Object.values(completa).filter(Boolean).length;
    expect(ativasCompleta).toBeGreaterThan(ativasEssencial);
    expect(completa.kmExcedente).toBe(true);
    expect(essencial.kmExcedente).toBe(false);
  });

  it("4. Colunas continua funcional — personalização manual por modo é preservada", () => {
    const raw = JSON.stringify({
      essencial: { ...PRESET_ESSENCIAL, kmExcedente: true },
      completa: PRESET_COMPLETA,
    });
    const essencial = lerColunasDoModo("essencial", raw);
    expect(essencial.kmExcedente).toBe(true);
    const completa = lerColunasDoModo("completa", raw);
    expect(completa.kmExcedente).toBe(true);
  });

  it("5. preferência legada (mapa plano v1) só afeta a visão completa", () => {
    const legado = JSON.stringify({ ...PRESET_COMPLETA, kmExcedente: false });
    expect(lerColunasDoModo("completa", legado).kmExcedente).toBe(false);
    expect(lerColunasDoModo("essencial", legado).kmExcedente).toBe(false);
    expect(lerColunasDoModo("essencial", legado).totalCliente).toBe(true);
  });

  it("6. nenhuma regra financeira mudou — mesmas colunas nas duas visões, apenas visibilidade difere", () => {
    expect(Object.keys(PRESET_ESSENCIAL).sort()).toEqual(Object.keys(PRESET_COMPLETA).sort());
    expect(PRESET_ESSENCIAL.totalCliente).toBe(true);
    expect(PRESET_COMPLETA.totalCliente).toBe(true);
    expect(PRESET_ESSENCIAL.totalPrestador).toBe(true);
    expect(PRESET_COMPLETA.totalPrestador).toBe(true);
  });
});
