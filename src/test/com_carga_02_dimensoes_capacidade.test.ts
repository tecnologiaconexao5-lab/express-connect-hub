// ═══════════════════════════════════════════════════════════════════════════════
// TMS-COM-CARGA-02 — Dimensões, cubagem, capacidade e recomendação de veículo
// Caso controlado: 10 volumes 1,20×0,80×0,60 m = 5,76 m³; peso 2.000 kg; 5 pallets.
// Fator de cubagem NÃO hardcoded (configurável). Capacidade do catálogo real.
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  FATOR_CONTEXTO_PADRAO,
  calcularCubagemM3,
  calcularDerivadosCarga,
  recomendarVeiculo,
  avaliarCompatibilidadeVeiculo,
  totalVolumesGrupos,
  NOTA_CAPACIDADE_PENDENTE,
} from "@/components/comercial/cargaCalculo";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const SRC_FORM = "src/components/comercial/OrcamentoForm.tsx";
const SRC_PDF = "src/components/comercial/orcamentoPdf.ts";

// 10 volumes, 120 × 80 × 60 cm
const dimensoesCaso = [{ quantidade: 10, comprimentoCm: 120, larguraCm: 80, alturaCm: 60 }];

describe("TMS-COM-CARGA-02 — cubagem do caso controlado", () => {
  it("10 × 1,20 × 0,80 × 0,60 m = 5,76 m³", () => {
    expect(calcularCubagemM3(dimensoesCaso)).toBeCloseTo(5.76, 6);
  });

  it("múltiplos grupos somam corretamente", () => {
    const grupos = [
      { quantidade: 4, comprimentoCm: 120, larguraCm: 80, alturaCm: 60 }, // 2.304
      { quantidade: 6, comprimentoCm: 120, larguraCm: 80, alturaCm: 60 }, // 3.456
    ];
    expect(calcularCubagemM3(grupos)).toBeCloseTo(5.76, 6);
  });

  it("valores ausentes/zero/inválidos => 0 (sem NaN/negativo)", () => {
    expect(calcularCubagemM3([])).toBe(0);
    expect(calcularCubagemM3([{ quantidade: 0, comprimentoCm: 0, larguraCm: 0, alturaCm: 0 }])).toBe(0);
    expect(calcularCubagemM3([{ quantidade: NaN, comprimentoCm: -10, larguraCm: Infinity, alturaCm: 0 }])).toBe(0);
  });

  it("CASO 3 grupos (UI CARGA-02B): 5×120×80×60 + 3×60×40×40 + 2×200×50×50 = 4,168 m³ / 10 volumes", () => {
    const grupos = [
      { quantidade: 5, comprimentoCm: 120, larguraCm: 80, alturaCm: 60 }, // 2.88
      { quantidade: 3, comprimentoCm: 60, larguraCm: 40, alturaCm: 40 },  // 0.288
      { quantidade: 2, comprimentoCm: 200, larguraCm: 50, alturaCm: 50 }, // 1.00
    ];
    expect(calcularCubagemM3(grupos)).toBeCloseTo(4.168, 6);
    expect(totalVolumesGrupos(grupos)).toBe(10);
    const d = calcularDerivadosCarga({ peso: 2000, dimensoes: grupos });
    expect(d.cubagem).toBeCloseTo(4.168, 6);
    expect(d.volumesGrupos).toBe(10);
  });
});

describe("TMS-COM-CARGA-02 — fator de cubagem configurável (não hardcoded)", () => {
  it("sem regra de fator: peso cubado não é calculado; peso considerado = peso real", () => {
    const d = calcularDerivadosCarga({ peso: 2000, pallets: 5, dimensoes: dimensoesCaso });
    expect(d.cubagem).toBeCloseTo(5.76, 6);
    expect(d.fatorDisponivel).toBe(false);
    expect(d.pesoCubado).toBe(0);
    expect(d.pesoConsiderado).toBe(2000);
    expect(d.notas.join(" ")).toMatch(/não calculado/i);
  });

  it("com regra de fator: peso cubado e considerado são derivados", () => {
    const d = calcularDerivadosCarga(
      { peso: 2000, pallets: 5, dimensoes: dimensoesCaso },
      undefined, undefined,
      [{ contexto: FATOR_CONTEXTO_PADRAO, fatorKgM3: 250, ativo: true }]
    );
    expect(d.fatorDisponivel).toBe(true);
    expect(d.pesoCubado).toBe(1440); // 5.76 × 250
    expect(d.pesoConsiderado).toBe(2000); // MAX(2000, 1440)
  });
});

describe("TMS-COM-CARGA-02 — capacidade e recomendação (catálogo real)", () => {
  it("2.000 kg / 5,76 m³ => recomenda VUC (menor que comporta)", () => {
    const rec = recomendarVeiculo({ pesoConsideradoKg: 2000, cubagemM3: 5.76, dimensoes: dimensoesCaso, pallets: 5 });
    expect(rec.disponivel).toBe(true);
    expect(rec.tipo).toBe("vuc"); // hr=1800kg < 2000; vuc=2500kg/16m³
    expect(rec.motivos.join(" ")).toContain("2.000 kg");
    expect(rec.notas.join(" ")).toContain(NOTA_CAPACIDADE_PENDENTE);
  });

  it("veículo de 1.500 kg é INCOMPATÍVEL com carga de 2.000 kg (não recomendado)", () => {
    // não existe no catálogo um veículo de 1500kg isolado, mas a regra é objetiva:
    const compat = avaliarCompatibilidadeVeiculo("van", { pesoConsideradoKg: 2000, cubagemM3: 5.76 }); // van=1300kg
    expect(compat.ok).toBe(false);
    expect(compat.excedentes.join(" ")).toMatch(/Peso/);
    // recomendar veículo incompatível nunca acontece:
    const rec = recomendarVeiculo({ pesoConsideradoKg: 2000, cubagemM3: 5.76 });
    const candidato = rec.tipo || "";
    expect(avaliarCompatibilidadeVeiculo(candidato, { pesoConsideradoKg: 2000, cubagemM3: 5.76 }).ok).toBe(true);
  });

  it("VUC é compatível com o caso controlado", () => {
    const compat = avaliarCompatibilidadeVeiculo("vuc", { pesoConsideradoKg: 2000, cubagemM3: 5.76, dimensoes: dimensoesCaso });
    expect(compat.ok).toBe(true);
    expect(compat.excedentes).toHaveLength(0);
  });

  it("cubagem acima do veículo => incompatível com motivo de cubagem", () => {
    const compat = avaliarCompatibilidadeVeiculo("fiorino", { pesoConsideradoKg: 300, cubagemM3: 5.76 }); // fiorino 2.8 m³
    expect(compat.ok).toBe(false);
    expect(compat.excedentes.join(" ")).toMatch(/Cubagem/);
  });
});

describe("TMS-COM-CARGA-02 — override manual e UI", () => {
  const src = read(SRC_FORM);
  it("mostra aviso não bloqueante quando o veículo selecionado é incompatível", () => {
    expect(src).toContain("A capacidade cadastrada deste veículo é inferior aos dados da carga.");
    expect(src).toContain("avaliarCompatibilidadeVeiculo");
    expect(src).toContain("A decisão operacional humana é preservada");
  });
  it("mantém 'Veículo recomendado para a operação' e seleção manual", () => {
    expect(src).toContain("Veículo recomendado para a operação");
    expect(src).toContain("Veículo selecionado para a operação");
    expect(src).toContain("Usar recomendação");
    expect(src).not.toContain("sugerido pela IA");
  });
  it("deixa claro quando o peso cubado não está configurado", () => {
    expect(src).toContain("não configurado");
    expect(src).toContain("Configurações → Veículos");
  });
});

describe("TMS-COM-CARGA-02 — regressão PDF (COM-ORC-04/05B intactos)", () => {
  const pdf = read(SRC_PDF);
  it("mantém logo clara, filename e campos de carga", () => {
    expect(pdf).toContain('fetch("/logos/logo-conexao-oficial.png")');
    expect(pdf).toContain("_Orcamento_Comercial.pdf");
    expect(pdf).toContain("Cubagem (m³)");
    expect(pdf).toContain("Veículo recomendado para a operação");
  });
});
