import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { calcularLitros, alertaBauMoto } from "@/lib/cubagem";
import { calcularReceitaClienteMoto, RECEITA_CLIENTE_MOTO } from "@/lib/custoMotoboy";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

// ============================================================================
// FIX-CUBAGEM-RECEITA-CLIENTE-E-DASHBOARD-MOBILE
// 1) Cubagem (C × L × A) / 1000 + alerta de baú da moto
// 2) Receita do cliente — tabela Moto (franquia R$ 28 + R$ 2,25/km > 6 km)
// 3) Abas de gestão mobile (Nova OS / Em Aberto / Financeiro)
// ============================================================================

describe("A) Cubagem — calcularLitros (C × L × A / 1000)", () => {
  it("40 × 40 × 40 = 64 L (baú padrão)", () => {
    expect(calcularLitros({ comprimento: 40, largura: 40, altura: 40 })).toBe(64);
  });

  it("50 × 40 × 40 = 80 L", () => {
    expect(calcularLitros({ comprimento: 50, largura: 40, altura: 40 })).toBe(80);
  });

  it("60 × 50 × 50 = 150 L", () => {
    expect(calcularLitros({ comprimento: 60, largura: 50, altura: 50 })).toBe(150);
  });

  it("qualquer dimensão zero/ausente → 0 L", () => {
    expect(calcularLitros({ comprimento: 0, largura: 40, altura: 40 })).toBe(0);
    expect(calcularLitros({ comprimento: 40, largura: 0, altura: 40 })).toBe(0);
    expect(calcularLitros({ comprimento: 40, largura: 40, altura: 0 })).toBe(0);
  });
});

describe("B) Alerta de baú da moto", () => {
  it("≤ 90 L → sem alerta", () => {
    expect(alertaBauMoto(0)).toBeNull();
    expect(alertaBauMoto(64)).toBeNull();
    expect(alertaBauMoto(90)).toBeNull();
  });

  it("> 90 L → Requer Baú de 90L", () => {
    expect(alertaBauMoto(95)?.texto).toBe("⚠️ Requer Baú de 90L");
    expect(alertaBauMoto(95)?.nivel).toBe(1);
  });

  it("> 120 L → Requer Baú de 120L", () => {
    expect(alertaBauMoto(130)?.texto).toBe("⚠️ Requer Baú de 120L");
    expect(alertaBauMoto(130)?.nivel).toBe(2);
  });

  it("> 140 L → Requer Baú de 140L", () => {
    expect(alertaBauMoto(150)?.texto).toBe("⚠️ Requer Baú de 140L");
    expect(alertaBauMoto(150)?.nivel).toBe(3);
  });

  it("> 160 L → capacidade excedida (trocar para Fiorino/Carro)", () => {
    const alerta = alertaBauMoto(170);
    expect(alerta?.nivel).toBe(4);
    expect(alerta?.texto).toContain("Capacidade máxima de moto excedida");
    expect(alerta?.texto).toContain("Fiorino/Carro");
  });
});

describe("C) Receita do cliente — tabela Moto", () => {
  it("exemplo da missão: 15 km = R$ 48,25", () => {
    const r = calcularReceitaClienteMoto(15);
    expect(r.total).toBe(48.25);
    expect(r.kmExcedente).toBe(9);
    expect(r.valorKm).toBe(2.25);
    expect(r.franquia).toBe(28);
  });

  it("franquia cobre 0 a 6 km → R$ 28,00", () => {
    expect(calcularReceitaClienteMoto(0).total).toBe(28);
    expect(calcularReceitaClienteMoto(6).total).toBe(28);
  });

  it("10 km = R$ 28 + 4 × 2,25 = R$ 37,00", () => {
    expect(calcularReceitaClienteMoto(10).total).toBe(37);
  });

  it("constantes da regra exatas", () => {
    expect(RECEITA_CLIENTE_MOTO.franquia).toBe(28);
    expect(RECEITA_CLIENTE_MOTO.franquiaKm).toBe(6);
    expect(RECEITA_CLIENTE_MOTO.valorKmAdicional).toBe(2.25);
  });
});

describe("D) OsMobile — integração UI", () => {
  const src = readSrc("src/pages/OsMobile.tsx");

  it("D.1 — Etapa Carga usa 3 inputs de dimensões + litros calculados", () => {
    expect(src).toContain("Dimensões (cm)");
    expect(src).toContain("Comprimento");
    expect(src).toContain("Largura");
    expect(src).toContain("Altura");
    expect(src).toContain("Litros calculados");
    expect(src).toContain("calcularLitros");
  });

  it("D.2 — alerta de baú da moto renderizado", () => {
    expect(src).toContain("alertaBauMoto");
    expect(src).toContain("alertaBau");
  });

  it("D.3 — precificação do cliente usa a tabela Moto", () => {
    expect(src).toContain("calcularReceitaClienteMoto");
    expect(src).toContain("RECEITA_CLIENTE_MOTO");
    expect(src).toContain('fonte: "tabela-moto"');
  });

  it("D.4 — abas inferiores (Nova OS / Em Aberto / Financeiro)", () => {
    expect(src).toContain("ABAS_MOBILE");
    expect(src).toContain('"Nova OS"');
    expect(src).toContain('"Em Aberto"');
    expect(src).toContain('"Financeiro"');
    expect(src).toContain("MobileTabBar");
    expect(src).toContain("EmAbertoView");
    expect(src).toContain("FinanceiroMobileView");
  });

  it("D.5 — Em Aberto consulta OS em análise/pendente/andamento", () => {
    expect(src).toContain("STATUS_EM_ABERTO");
    expect(src).toContain('"em_analise"');
    expect(src).toContain('"em_andamento"');
    expect(src).toContain('from("ordens_servico")');
  });

  it("D.6 — Financeiro consulta contas a pagar (financeiro_pagar)", () => {
    expect(src).toContain('from("financeiro_pagar")');
    expect(src).toContain("data_vencimento");
    expect(src).toContain("A pagar hoje");
  });

  it("D.7 — reset (limpar) zera as dimensões", () => {
    expect(src).toContain('setComprimento("")');
    expect(src).toContain('setLargura("")');
    expect(src).toContain('setAltura("")');
  });
});
