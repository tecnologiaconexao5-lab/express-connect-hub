// ═══════════════════════════════════════════════════════════════════════════════
// TMS-COM-CARGA-01 — Cubagem, peso cubado e recomendação de veículo
// Casos A–G + capacidade cadastrada + regressões COM-ORC-02/04.
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  FATOR_CONTEXTO_PADRAO,
  calcularCubagemM3,
  calcularPesoCubado,
  calcularPesoConsiderado,
  calcularDerivadosCarga,
  recomendarVeiculo,
  volumeM3PorGrupo,
  maiorDimensaoCm,
} from "@/components/comercial/cargaCalculo";
import { calcularValorFinal } from "@/components/comercial/orcamentoCalculo";
import { toOrcamentoInsert, toOrcamentoDomain } from "@/lib/dbMappers";
import { VEICULO_PARAMETROS } from "@/constants/tiposVeiculo";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const SRC_FORM = "src/components/comercial/OrcamentoForm.tsx";
const SRC_PDF = "src/components/comercial/orcamentoPdf.ts";

describe("CASO A — 10 volumes 50×40×30 cm = 0,60 m³", () => {
  it("converte cm→m e multiplica pela quantidade", () => {
    const g = { quantidade: 10, comprimentoCm: 50, larguraCm: 40, alturaCm: 30 };
    expect(volumeM3PorGrupo(g)).toBeCloseTo(0.6, 6);
    expect(calcularCubagemM3([g])).toBe(0.6);
  });
});

describe("CASO B — múltiplos grupos somam corretamente", () => {
  it("10×(0,5×0,4×0,3) + 2×(1,0×0,8×0,6) = 1,56 m³", () => {
    const grupos = [
      { quantidade: 10, comprimentoCm: 50, larguraCm: 40, alturaCm: 30 },
      { quantidade: 2, comprimentoCm: 100, larguraCm: 80, alturaCm: 60 },
    ];
    expect(calcularCubagemM3(grupos)).toBeCloseTo(1.56, 6);
  });
});

describe("CASO C/D — peso cubado e peso considerado (fator explícito)", () => {
  it("CASO C: peso real 500 > peso cubado 180 => considerado = real", () => {
    const cub = calcularCubagemM3([{ quantidade: 10, comprimentoCm: 50, larguraCm: 40, alturaCm: 30 }]); // 0.6
    const pc = calcularPesoCubado(cub, 300); // 180 (fator só p/ testar a fórmula)
    expect(pc).toBe(180);
    expect(calcularPesoConsiderado(500, pc)).toBe(500);
  });
  it("CASO D: peso cubado 468 > peso real 100 => considerado = cubado", () => {
    const cub = calcularCubagemM3([
      { quantidade: 10, comprimentoCm: 50, larguraCm: 40, alturaCm: 30 },
      { quantidade: 2, comprimentoCm: 100, larguraCm: 80, alturaCm: 60 },
    ]); // 1.56
    const pc = calcularPesoCubado(cub, 300); // 468
    expect(pc).toBe(468);
    expect(calcularPesoConsiderado(100, pc)).toBe(468);
  });
  it("sem regra de fator => peso cubado NÃO é calculado (não inventa)", () => {
    expect(calcularPesoCubado(5.76)).toBe(0);
    const d = calcularDerivadosCarga({ peso: 2000, dimensoes: [{ quantidade: 10, comprimentoCm: 120, larguraCm: 80, alturaCm: 60 }] });
    expect(d.fatorDisponivel).toBe(false);
    expect(d.pesoCubado).toBe(0);
    expect(d.pesoConsiderado).toBe(2000);
    expect(d.notas.join(" ")).toMatch(/não calculado/i);
  });
  it("regra de fator (backend/regras) é utilizada", () => {
    const d = calcularDerivadosCarga(
      { peso: 100, dimensoes: [{ quantidade: 10, comprimentoCm: 120, larguraCm: 80, alturaCm: 60 }] },
      undefined, undefined,
      [{ contexto: FATOR_CONTEXTO_PADRAO, fatorKgM3: 300, ativo: true }]
    );
    expect(d.fatorDisponivel).toBe(true);
    expect(d.fator).toBe(300);
    expect(d.cubagem).toBeCloseTo(5.76, 6);
    expect(d.pesoCubado).toBe(1728);
    expect(d.pesoConsiderado).toBe(1728);
  });
});

describe("Robustez — nunca NaN/Infinity/negativo", () => {
  it("dimensões inválidas => 0", () => {
    expect(calcularCubagemM3([{ quantidade: NaN, comprimentoCm: -50, larguraCm: Infinity, alturaCm: 30 }])).toBe(0);
    expect(calcularCubagemM3(null)).toBe(0);
    expect(calcularPesoCubado(NaN)).toBe(0);
    expect(calcularPesoConsiderado(-10, -5)).toBe(0);
  });
  it("maior dimensão ignora inválidos", () => {
    expect(maiorDimensaoCm([{ quantidade: 1, comprimentoCm: 50, larguraCm: 0, alturaCm: 0 }, { quantidade: 1, comprimentoCm: 200, larguraCm: 100, alturaCm: 80 }]))
      .toEqual({ comprimentoCm: 200, larguraCm: 100, alturaCm: 80 });
  });
});

describe("Capacidade — catálogo existente (VEICULO_PARAMETROS)", () => {
  it("recomenda o MENOR veículo que comporta (1250 kg, 6,4 m³ => Van)", () => {
    const rec = recomendarVeiculo({ pesoConsideradoKg: 1250, cubagemM3: 6.4, pallets: 4 });
    expect(rec.disponivel).toBe(true);
    expect(rec.tipo).toBe("van");
    expect(rec.motivos.join(" ")).toContain("1.250 kg");
    expect(rec.motivos.join(" ")).toContain("6,40 m³");
    // TMS-COM-CARGA-03 — pallets sem capacidade parametrizada => indeterminado (não usado como restrição)
    expect(rec.motivos.join(" ") + " " + rec.notas.join(" ")).toMatch(/pallets não parametrizada/i);
  });
  it("catálogo tem capacidades reais (kg e m³) cadastradas", () => {
    expect(VEICULO_PARAMETROS.fiorino.pesoMax).toBeGreaterThan(0);
    expect(VEICULO_PARAMETROS.vuc.cubagemMax).toBeGreaterThan(0);
  });
});

describe("CASO E — dados insuficientes NÃO inventam recomendação", () => {
  it("sem métricas => indisponível com orientação", () => {
    const rec = recomendarVeiculo({ pesoConsideradoKg: 0, cubagemM3: 0 });
    expect(rec.disponivel).toBe(false);
    expect(rec.tipo).toBeNull();
    expect(rec.faltando.length).toBeGreaterThan(0);
  });
  it("carga acima do maior veículo => indisponível (sem fabricar capacidade)", () => {
    const rec = recomendarVeiculo({ pesoConsideradoKg: 60000, cubagemM3: 10 });
    expect(rec.disponivel).toBe(false);
    expect(rec.faltando.join(" ")).toMatch(/Nenhum veículo parametrizado/i);
  });
});

describe("CASO F — escolha humana preservada", () => {
  it("componente distingue recomendado x selecionado e avisa divergência (não bloqueante)", () => {
    const src = read(SRC_FORM);
    expect(src).toContain("Veículo selecionado para a operação");
    expect(src).toContain("Veículo recomendado para a operação");
    expect(src).toContain("A escolha humana é mantida");
    // aplicação da recomendação é AÇÃO explícita do usuário (não automática)
    expect(src).toContain("Usar recomendação");
    expect(src).toContain("aplicarSugestaoVeiculo");
  });
});

describe("CASO G — save → reload preserva carga/veículo", () => {
  it("payload persiste dimensões/pesoCubado/fator/pesoConsiderado e recomendação", () => {
    const carga = {
      descricao: "Carga teste", volumes: 12, peso: 100, cubagem: 1.56, pallets: 4, valorDeclarado: 0,
      refrigerado: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false, observacoes: "",
      dimensoes: [{ quantidade: 10, comprimentoCm: 50, larguraCm: 40, alturaCm: 30 }, { quantidade: 2, comprimentoCm: 100, larguraCm: 80, alturaCm: 60 }],
      pesoCubado: 468, fatorCubagem: 300, pesoConsiderado: 468, pesoCubadoDisponivel: true,
    };
    const veiculo = { tipo: "vuc", subcategoria: "pesado", carroceria: "sider", recomendado: "vuc", recomendacaoDisponivel: true, recomendacaoMotivos: ["x"] };
    const payload = toOrcamentoInsert({ carga, veiculo } as never) as Record<string, any>;
    expect(payload.carga.dimensoes).toHaveLength(2);
    expect(payload.carga.pesoCubado).toBe(468);
    expect(payload.carga.fatorCubagem).toBe(300);
    expect(payload.carga.pesoCubadoDisponivel).toBe(true);
    expect(payload.veiculo.recomendado).toBe("vuc");
    expect(payload.veiculo.recomendacaoDisponivel).toBe(true);

    // reload: JSONB volta íntegro no domínio
    const dom = toOrcamentoDomain({ numero: "ORC-1", carga, veiculo, valores: {}, enderecos: [] });
    expect(dom.carga.dimensoes).toHaveLength(2);
    expect(dom.carga.pesoConsiderado).toBe(468);
    expect(dom.veiculo.recomendado).toBe("vuc");
  });

  it("calcularDerivadosCarga calcula a partir das dimensões (com fator explícito)", () => {
    const d = calcularDerivadosCarga({
      peso: 100, cubagem: 0, pallets: 0,
      dimensoes: [{ quantidade: 10, comprimentoCm: 50, larguraCm: 40, alturaCm: 30 }, { quantidade: 2, comprimentoCm: 100, larguraCm: 80, alturaCm: 60 }],
    }, 300);
    expect(d.cubagem).toBeCloseTo(1.56, 6);
    expect(d.pesoCubado).toBe(468);
    expect(d.pesoConsiderado).toBe(468);
    expect(d.recomendacao.disponivel).toBe(true);
  });

  it("sem dimensões usa a cubagem já informada (legado)", () => {
    const d = calcularDerivadosCarga({ peso: 500, cubagem: 5, dimensoes: [] }, 300);
    expect(d.cubagem).toBe(5);
    expect(d.pesoCubado).toBe(1500);
    expect(d.pesoConsiderado).toBe(1500);
  });
});

describe("Regressões COM-ORC-02/04", () => {
  it("cálculo canônico preservado (base 2200 => final 2200)", () => {
    expect(calcularValorFinal({ valorBase: 2200, adicionais: 0, pedagio: 0, kmExcedente: 0, ajudante: 0, adValorem: 0, gris: 0, devolucao: 0, reentrega: 0, descontos: 0 })).toBe(2200);
  });
  it("PDF mantém layout e passa a preferir o veículo recomendado", () => {
    const pdf = read(SRC_PDF);
    expect(pdf).toContain("Veículo recomendado para a operação");
    expect(pdf).toContain("recomendado || veiculo.tipo");
    expect(pdf).toContain("_Orcamento_Comercial.pdf");
  });
  it("formulário salva derivados (comDerivadosCarga) em salvar e rascunho", () => {
    const src = read(SRC_FORM);
    expect(src).toContain("comDerivadosCarga(data)");
    expect(src).toContain("calcularDerivadosCarga");
    expect(src).not.toContain("sugestaoVeiculo"); // função/estado antigos removidos
  });
});
