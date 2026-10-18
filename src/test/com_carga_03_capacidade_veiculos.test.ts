// ═══════════════════════════════════════════════════════════════════════════════
// TMS-COM-CARGA-03 — Capacidade parametrizável de veículos + motor de compatibilidade
// Casos A–J + caso real 24,144 m³. NÃO inventa capacidade.
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  catalogoPadraoVeiculo,
  avaliarVeiculo,
  avaliarCatalogo,
  recomendarVeiculo,
  avaliarCompatibilidadeVeiculo,
  cabeEmAlgumaOrientacao,
  calcularCubagemM3,
  type VeiculoCapacidade,
} from "@/components/comercial/cargaCalculo";
import { mesclarCapacidades, capacidadesPadraoVeiculo, CHAVE_CAPACIDADES_VEICULO } from "@/services/comercial/veiculoCapacidadeService";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const SRC_FORM = "src/components/comercial/OrcamentoForm.tsx";

const veic = (over: Partial<VeiculoCapacidade>): VeiculoCapacidade => ({
  tipo: "teste", label: "Teste", configuracao: "", capacidadeKg: 1000,
  comprimentoUtilCm: 300, larguraUtilCm: 160, alturaUtilCm: 170, cubagemUtilM3: 8,
  capacidadePallets: null, refrigerado: null, carroceriasPermitidas: [], ativo: true,
  fonte: "teste", ...over,
});

describe("CARGA-03 — motor de compatibilidade (critérios)", () => {
  it("CASO A — peso incompatível", () => {
    const ev = avaliarVeiculo(veic({ capacidadeKg: 500 }), { pesoConsideradoKg: 2000, cubagemM3: 1 });
    expect(ev.compativel).toBe(false);
    expect(ev.criterios.peso).toBe("falha");
  });

  it("CASO B — cubagem incompatível", () => {
    const ev = avaliarVeiculo(veic({ cubagemUtilM3: 2 }), { pesoConsideradoKg: 100, cubagemM3: 5 });
    expect(ev.compativel).toBe(false);
    expect(ev.criterios.cubagem).toBe("falha");
  });

  it("CASO C — cubagem cabe, mas dimensão individual NÃO cabe", () => {
    // peça 300×50×50 cabe no volume útil (8 m³) mas excede comprimento útil 200
    const ev = avaliarVeiculo(
      veic({ cubagemUtilM3: 50, comprimentoUtilCm: 200, larguraUtilCm: 100, alturaUtilCm: 100 }),
      { pesoConsideradoKg: 50, cubagemM3: 2, dimensoes: [{ quantidade: 1, comprimentoCm: 300, larguraCm: 50, alturaCm: 50 }] }
    );
    expect(ev.compativel).toBe(false);
    expect(ev.criterios.dimensao).toBe("falha");
    expect(ev.motivos.join(" ")).toMatch(/não cabe/i);
  });

  it("CASO D — volume cabe após orientação válida", () => {
    // peça 100×80×60 em baú 80×100×60 → cabe rotacionada
    expect(cabeEmAlgumaOrientacao(100, 80, 60, 80, 100, 60)).toBe(true);
    const ev = avaliarVeiculo(
      veic({ comprimentoUtilCm: 80, larguraUtilCm: 100, alturaUtilCm: 60, cubagemUtilM3: 20 }),
      { pesoConsideradoKg: 50, cubagemM3: 0.48, dimensoes: [{ quantidade: 1, comprimentoCm: 100, larguraCm: 80, alturaCm: 60 }] }
    );
    expect(ev.criterios.dimensao).toBe("ok");
    expect(ev.compativel).toBe(true);
  });

  it("CASO E — pallets acima da capacidade parametrizada", () => {
    const ev = avaliarVeiculo(veic({ capacidadePallets: 4 }), { pesoConsideradoKg: 100, cubagemM3: 1, pallets: 6 });
    expect(ev.criterios.pallets).toBe("falha");
    expect(ev.compativel).toBe(false);
  });

  it("CASO F — pallets SEM capacidade parametrizada => indeterminado (não incompatível)", () => {
    const ev = avaliarVeiculo(veic({ capacidadePallets: null }), { pesoConsideradoKg: 100, cubagemM3: 1, pallets: 99 });
    expect(ev.criterios.pallets).toBe("nao_parametrizado");
    expect(ev.compativel).toBe(true);
  });

  it("CASO G — refrigerada × veículo incompatível; e indeterminado quando não parametrizado", () => {
    const falha = avaliarVeiculo(veic({ refrigerado: false }), { pesoConsideradoKg: 100, cubagemM3: 1, refrigerado: true });
    expect(falha.criterios.refrigerado).toBe("falha");
    const indef = avaliarVeiculo(veic({ refrigerado: null }), { pesoConsideradoKg: 100, cubagemM3: 1, refrigerado: true });
    expect(indef.criterios.refrigerado).toBe("nao_parametrizado");
    expect(indef.compativel).toBe(true);
  });
});

describe("CARGA-03 — recomendação", () => {
  const catalogo: VeiculoCapacidade[] = [
    veic({ tipo: "pequeno", label: "Pequeno", capacidadeKg: 800, cubagemUtilM3: 3, comprimentoUtilCm: 150, larguraUtilCm: 120, alturaUtilCm: 120 }),
    veic({ tipo: "medio", label: "Médio", capacidadeKg: 2500, cubagemUtilM3: 16, comprimentoUtilCm: 420, larguraUtilCm: 200, alturaUtilCm: 200 }),
    veic({ tipo: "grande", label: "Grande", capacidadeKg: 12000, cubagemUtilM3: 60, comprimentoUtilCm: 900, larguraUtilCm: 260, alturaUtilCm: 280 }),
  ];

  it("CASO H — nenhum veículo atende", () => {
    const rec = recomendarVeiculo({ pesoConsideradoKg: 50000, cubagemM3: 5 }, catalogo);
    expect(rec.disponivel).toBe(false);
    expect(rec.faltando.join(" ")).toMatch(/Nenhum veículo parametrizado/i);
  });

  it("CASO I — menor veículo compatível escolhido corretamente", () => {
    const rec = recomendarVeiculo({ pesoConsideradoKg: 2000, cubagemM3: 10 }, catalogo);
    expect(rec.tipo).toBe("medio"); // pequeno falha peso/cubagem; médio é o menor que comporta
  });
});

describe("CARGA-03 — CASO REAL 24,144 m³", () => {
  const dims = [
    { quantidade: 1, comprimentoCm: 30, larguraCm: 60, alturaCm: 80 },     // 0.144
    { quantidade: 10, comprimentoCm: 160, larguraCm: 150, alturaCm: 100 }, // 24.000
  ];

  it("cubagem total = 24,144 m³", () => {
    expect(calcularCubagemM3(dims)).toBeCloseTo(24.144, 6);
  });

  it("recomenda TOCO e rejeita quem tem cubagem < 24,144", () => {
    const rec = recomendarVeiculo({ pesoConsideradoKg: 2000, cubagemM3: 24.144, dimensoes: dims });
    expect(rec.disponivel).toBe(true);
    expect(rec.tipo).toBe("toco"); // 3/4 (24 m³) < 24,144 → falha; toco (40 m³) é o menor que comporta
    const rejeitado = rec.avaliacoes.find((a) => a.tipo === "tres_quartos");
    expect(rejeitado?.compativel).toBe(false);
    expect(rejeitado?.criterios.cubagem).toBe("falha");
    const aprovado = rec.avaliacoes.find((a) => a.tipo === "toco");
    expect(aprovado?.compativel).toBe(true);
  });

  it("NÃO recomenda veículo com cubagem inferior (van/vuc)", () => {
    const rec = recomendarVeiculo({ pesoConsideradoKg: 2000, cubagemM3: 24.144, dimensoes: dims });
    expect(["van", "vuc", "hr", "3/4", "kombi", "fiorino"]).not.toContain(rec.tipo);
  });
});

describe("CARGA-03 — catálogo padrão tem todas as dimensões úteis (origem explícita)", () => {
  it("deriva de VEICULO_PARAMETROS e marca a fonte", () => {
    const cat = catalogoPadraoVeiculo();
    expect(cat.length).toBeGreaterThan(5);
    for (const v of cat) {
      expect(v.capacidadeKg).toBeGreaterThan(0);
      expect(v.cubagemUtilM3).toBeGreaterThan(0);
      expect(v.fonte).toMatch(/VEICULO_PARAMETROS/);
    }
  });
  it("avaliarCompatibilidadeVeiculo devolve motivo de cubagem para VUC no caso 24,144", () => {
    const c = avaliarCompatibilidadeVeiculo("vuc", { pesoConsideradoKg: 2000, cubagemM3: 24.144 });
    expect(c.ok).toBe(false);
    expect(c.excedentes.join(" ")).toMatch(/Cubagem/i);
  });
});

describe("CARGA-03 — parametrização (configuracoes_sistema)", () => {
  it("chave de persistência definida", () => {
    expect(CHAVE_CAPACIDADES_VEICULO).toBe("veiculo_capacidades");
  });
  it("mescla override por tipo sobre o padrão (não inventa)", () => {
    const padrao = capacidadesPadraoVeiculo();
    const merged = mesclarCapacidades([{ ...padrao[0], tipo: "vuc", cubagemUtilM3: 99, capacidadeKg: 2500, fonte: "Override" }], padrao);
    const vuc = merged.find((v) => v.tipo === "vuc");
    expect(vuc?.cubagemUtilM3).toBe(99);
    expect(vuc?.fonte).toBe("Override");
    expect(merged.length).toBe(padrao.length); // mesma quantidade (merge por tipo)
  });
});

describe("CARGA-03 — correção do alerta 0 × grupos", () => {
  const src = read(SRC_FORM);
  it("só alerta quando a quantidade manual é positiva e conflitante", () => {
    expect(src).toContain("Number(data.carga.volumes || 0) > 0 && Number(data.carga.volumes || 0) !== derivados.volumesGrupos");
  });
  it("mantém resumo físico e recomendação", () => {
    expect(src).toContain("Resumo físico da carga");
    expect(src).toContain("Veículo recomendado para a operação");
    expect(src).toContain("catalogoPadraoVeiculo");
  });
});
