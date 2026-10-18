// ═══════════════════════════════════════════════════════════════════════════════
// TMS-COM-CARGA-04 — Fator de cubagem parametrizado (backend, sem invenção)
// Casos A–J. Valores controlados SOMENTE em teste (250 = fixture, não padrão).
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  FATOR_CONTEXTO_PADRAO,
  resolverFatorCubagemRegras,
  calcularDerivadosCarga,
  calcularPesoCubado,
  recomendarVeiculo,
  type RegraFatorCubagem,
  type VeiculoCapacidade,
} from "@/components/comercial/cargaCalculo";
import { regrasFatorCubagemPadrao, mesclarRegrasFator, CHAVE_FATOR_CUBAGEM } from "@/services/comercial/fatorCubagemService";
import { toOrcamentoInsert, toOrcamentoDomain } from "@/lib/dbMappers";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const SRC_FORM = "src/components/comercial/OrcamentoForm.tsx";
const SRC_CFG = "src/pages/Configuracoes.tsx";

const dims = [
  { quantidade: 5, comprimentoCm: 120, larguraCm: 80, alturaCm: 60 },
  { quantidade: 3, comprimentoCm: 60, larguraCm: 40, alturaCm: 40 },
  { quantidade: 2, comprimentoCm: 200, larguraCm: 50, alturaCm: 50 },
]; // 4,168 m³

const r = (contexto: string, fatorKgM3: number, ativo = true): RegraFatorCubagem => ({ contexto, fatorKgM3, ativo });

describe("CARGA-04 — precedência das regras (A–D)", () => {
  it("A) sem fator → indisponível", () => {
    expect(resolverFatorCubagemRegras([], "contrato")).toBeNull();
    expect(resolverFatorCubagemRegras(regrasFatorCubagemPadrao(), "contrato")).toBeNull();
    const d = calcularDerivadosCarga({ peso: 500, dimensoes: dims }, undefined, undefined, []);
    expect(d.fatorDisponivel).toBe(false);
    expect(d.pesoCubado).toBe(0);
    expect(d.pesoConsiderado).toBe(500);
  });

  it("B) regra geral é aplicada", () => {
    const regras = [r(FATOR_CONTEXTO_PADRAO, 250)];
    expect(resolverFatorCubagemRegras(regras, "esporadico")).toBe(250);
    const d = calcularDerivadosCarga({ peso: 500, dimensoes: dims }, undefined, undefined, regras, "esporadico");
    expect(d.fator).toBe(250);
    expect(d.pesoCubado).toBe(1042); // 4.168 × 250
    expect(d.pesoConsiderado).toBe(1042);
  });

  it("C) regra específica da modalidade prevalece sobre a geral", () => {
    const regras = [r(FATOR_CONTEXTO_PADRAO, 200), r("contrato", 300)];
    expect(resolverFatorCubagemRegras(regras, "contrato")).toBe(300);
    expect(resolverFatorCubagemRegras(regras, "esporadico")).toBe(200); // cai na geral
  });

  it("D) regra desativada é ignorada (cai para a geral ou sem fator)", () => {
    expect(resolverFatorCubagemRegras([r(FATOR_CONTEXTO_PADRAO, 250, false)], "contrato")).toBeNull();
    const regras = [r("contrato", 300, false), r(FATOR_CONTEXTO_PADRAO, 200, true)];
    expect(resolverFatorCubagemRegras(regras, "contrato")).toBe(200);
  });
});

describe("CARGA-04 — cálculo do peso cubado (E,F)", () => {
  it("E) peso real > cubado → considerado = real", () => {
    const d = calcularDerivadosCarga({ peso: 2000, dimensoes: dims }, undefined, undefined, [r(FATOR_CONTEXTO_PADRAO, 250)]);
    expect(d.pesoCubado).toBe(1042);
    expect(d.pesoConsiderado).toBe(2000);
  });
  it("F) cubado > real → considerado = cubado", () => {
    const d = calcularDerivadosCarga({ peso: 500, dimensoes: dims }, undefined, undefined, [r(FATOR_CONTEXTO_PADRAO, 250)]);
    expect(d.pesoCubado).toBe(1042);
    expect(d.pesoConsiderado).toBe(1042);
  });
});

describe("CARGA-04 — recomendação muda pelo peso considerado (G)", () => {
  const catalogo: VeiculoCapacidade[] = [{
    tipo: "leve", label: "Leve", capacidadeKg: 900, comprimentoUtilCm: 500, larguraUtilCm: 220, alturaUtilCm: 220,
    cubagemUtilM3: 40, capacidadePallets: null, refrigerado: null, carroceriasPermitidas: [], ativo: true, fonte: "teste",
  }];

  it("sem fator → compatível (peso real 500 ≤ 900)", () => {
    const d = calcularDerivadosCarga({ peso: 500, dimensoes: dims }, undefined, catalogo, []);
    const rec = recomendarVeiculo({ pesoConsideradoKg: d.pesoConsiderado, cubagemM3: d.cubagem, dimensoes: dims }, catalogo);
    expect(rec.tipo).toBe("leve"); // compatível
  });
  it("com fator → incompatível (peso considerado 1.042 > 900)", () => {
    const d = calcularDerivadosCarga({ peso: 500, dimensoes: dims }, undefined, catalogo, [r(FATOR_CONTEXTO_PADRAO, 250)]);
    expect(d.pesoConsiderado).toBe(1042);
    const rec = recomendarVeiculo({ pesoConsideradoKg: d.pesoConsiderado, cubagemM3: d.cubagem, dimensoes: dims }, catalogo);
    expect(rec.disponivel).toBe(false); // nenhum veículo comporta o peso cubado
  });
});

describe("CARGA-04 — persistência/reload e snapshot (H,I,J)", () => {
  it("H) merge preserva regra salva", () => {
    const merged = mesclarRegrasFator([r("contrato", 300), r(FATOR_CONTEXTO_PADRAO, 200)]);
    expect(merged.find((x) => x.contexto === "contrato")?.fatorKgM3).toBe(300);
    expect(merged.find((x) => x.contexto === FATOR_CONTEXTO_PADRAO)?.fatorKgM3).toBe(200);
    expect(CHAVE_FATOR_CUBAGEM).toBe("fator_cubagem_regras");
  });

  it("I) orçamento persiste snapshot do fator aplicado", () => {
    const carga = { ...{ descricao: "x", volumes: 10, peso: 500, cubagem: 4.168, pallets: 0, valorDeclarado: 0, refrigerado: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false, observacoes: "" }, dimensoes: dims, pesoCubado: 1042, fatorCubagem: 250, pesoConsiderado: 1042, pesoCubadoDisponivel: true, fatorCubagemContexto: "contrato" };
    const payload = toOrcamentoInsert({ carga } as never) as Record<string, any>;
    expect(payload.carga.fatorCubagem).toBe(250);
    expect(payload.carga.pesoCubado).toBe(1042);
    expect(payload.carga.pesoConsiderado).toBe(1042);
    expect(payload.carga.fatorCubagemContexto).toBe("contrato");
    const dom = toOrcamentoDomain({ numero: "ORC-1", carga, valores: {}, enderecos: [] });
    expect(dom.carga.fatorCubagem).toBe(250);
    expect(dom.carga.fatorCubagemContexto).toBe("contrato");
  });

  it("J) mudança posterior da config NÃO altera snapshot histórico", () => {
    const cargaSnapshot = { peso: 500, dimensoes: dims, fatorCubagem: 250 };
    // Config passou a 400 depois:
    const novasRegras = [r(FATOR_CONTEXTO_PADRAO, 400)];
    const comSnapshot = calcularDerivadosCarga(cargaSnapshot as any, 250, undefined, novasRegras, FATOR_CONTEXTO_PADRAO);
    expect(comSnapshot.fator).toBe(250); // snapshot vence a config atual
    expect(comSnapshot.pesoCubado).toBe(1042);
    // Sem snapshot (novo orçamento), usa a config atual:
    const semSnapshot = calcularDerivadosCarga({ peso: 500, dimensoes: dims } as any, undefined, undefined, novasRegras, FATOR_CONTEXTO_PADRAO);
    expect(semSnapshot.fator).toBe(400);
  });
});

describe("CARGA-04 — UI e fonte oficial", () => {
  it("Orçamento usa snapshot para existente e regras para novo", () => {
    const src = read(SRC_FORM);
    expect(src).toContain("fatorSnapshot");
    expect(src).toContain("carregarRegrasFatorCubagem");
    expect(src).toContain("Fator aplicado");
  });
  it("Configurações expõe FatorCubagemConfig", () => {
    expect(read(SRC_CFG)).toContain("FatorCubagemConfig");
  });
  it("fonte oficial é configuracoes_sistema (não localStorage obrigatório)", () => {
    const svc = read("src/services/comercial/fatorCubagemService.ts");
    expect(svc).toContain("carregarConfiguracaoSistema");
    expect(svc).toContain("salvarConfiguracaoSistema");
    expect(svc).not.toContain("localStorage");
  });
});
