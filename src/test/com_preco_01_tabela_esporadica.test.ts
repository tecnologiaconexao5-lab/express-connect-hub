// ═══════════════════════════════════════════════════════════════════════════════
// TMS-COM-PRECO-01 — Tabela Esporádica / preço automático do Orçamento
// Fonte: tabelas_valores (hierarquia) + calcularPrecoRapido (fórmula existente).
// Valores REALISTAS das tabelas de produção NÃO são inventados aqui; os fixtures
// abaixo reproduzem o formato real (valor_base, franquia_km, valor_km_excedente).
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { calcularPrecoRapido } from "@/services/precificacao/precificacaoEngineService";
import { calcularValorFinal } from "@/components/comercial/orcamentoCalculo";
import { toOrcamentoInsert, toOrcamentoDomain } from "@/lib/dbMappers";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const SRC_FORM = "src/components/comercial/OrcamentoForm.tsx";
const SRC_SVC = "src/services/precificacao/buscarTabelasService.ts";

const tabela = (over: Record<string, unknown> = {}) => ({
  id: "t1", nome: "Tabela Esporádica Teste", fonte: "tabelas_valores",
  valor_base: 300, franquia_km: 100, valor_km_excedente: 1.2, percentual_prestador: 80,
  ...over,
}) as never;

describe("PRECO-01 — fórmula (fonte existente, sem invenção)", () => {
  it("A) base + km excedente (100 km franquia, 150 km => +50×1,20)", () => {
    const r = calcularPrecoRapido(tabela(), 150);
    expect(r.valorCliente).toBeCloseTo(360, 2); // 300 + 50*1.2
    expect(r.kmExcedente).toBe(50);
  });

  it("B) veículo/tabela sem preço (valor_base 0) => preço 0 (indisponível)", () => {
    const r = calcularPrecoRapido(tabela({ valor_base: 0, valor_km_excedente: 0 }), 150);
    expect(r.valorCliente).toBe(0);
  });

  it("C) alteração do veículo/tabela recalcula o preço", () => {
    const vuc = calcularPrecoRapido(tabela({ valor_base: 300 }), 150).valorCliente;
    const fiorino = calcularPrecoRapido(tabela({ valor_base: 400, valor_km_excedente: 2.1 }), 150).valorCliente;
    expect(vuc).not.toBe(fiorino);
    expect(fiorino).toBeCloseTo(505, 2); // 400 + 50*2.1
  });

  it("D) alteração da distância/faixa recalcula", () => {
    const at150 = calcularPrecoRapido(tabela(), 150).valorCliente;
    const at250 = calcularPrecoRapido(tabela(), 250).valorCliente;
    expect(at250).toBeGreaterThan(at150);
  });

  it("E) adicional (pedágio) entra na margem, não altera valorCliente", () => {
    const sem = calcularPrecoRapido(tabela(), 150);
    const com = calcularPrecoRapido(tabela(), 150, { pedagio: 50 });
    expect(com.valorCliente).toBe(sem.valorCliente);
    expect(com.margem.margem_bruta).toBeLessThan(sem.margem.margem_bruta);
  });

  it("F) desconto reduz o PREÇO FINAL (fórmula canônica COM-ORC-02)", () => {
    const com = calcularValorFinal({ valorBase: 360, adicionais: 0, pedagio: 0, kmExcedente: 0, ajudante: 0, adValorem: 0, gris: 0, devolucao: 0, reentrega: 0, descontos: 40 });
    expect(com).toBe(320);
  });
});

describe("PRECO-01 — snapshot do preço (G,H,I)", () => {
  const valores = {
    tabelaVinculada: "VUC HML", valorBase: 300, adicionais: 0, pedagio: 0, kmExcedente: 60,
    ajudante: 0, devolucao: 0, reentrega: 0, descontos: 0, valorFinal: 360, custoEstimado: 288,
    margemEstimada: 20, lucroEstimado: 72,
    pricing: { tabelaId: "t1", tabelaNome: "VUC HML", fonte: "tabelas_valores", veiculoTarifado: "vuc", distanciaKm: 150, franquiaKm: 100, valorBase: 300, kmExcedente: 60, valorCalculado: 360, overrideManual: false, calculoEm: "x", calculadoEm: "2026-09-26T00:00:00.000Z" },
  };

  it("G) orçamento persiste o snapshot da regra aplicada", () => {
    const payload = toOrcamentoInsert({ valores } as never) as Record<string, any>;
    expect(payload.valores.pricing.tabelaNome).toBe("VUC HML");
    expect(payload.valores.pricing.valorCalculado).toBe(360);
    expect(payload.valores.pricing.veiculoTarifado).toBe("vuc");
  });

  it("H) reload preserva o snapshot", () => {
    const dom = toOrcamentoDomain({ numero: "ORC-1", valores, enderecos: [], carga: {}, veiculo: {} });
    expect(dom.valores.pricing.distanciaKm).toBe(150);
    expect(dom.valores.pricing.valorCalculado).toBe(360);
  });

  it("I) mudança posterior da tabela NÃO altera o snapshot salvo", () => {
    // Simula: tabela mudou para valor_base 500 posteriormente.
    const novoCalculo = calcularPrecoRapido(tabela({ valor_base: 500 }), 150).valorCliente; // 560
    expect(novoCalculo).toBe(560);
    // O orçamento salvo mantém 360 (snapshot).
    const dom = toOrcamentoDomain({ numero: "ORC-1", valores, enderecos: [], carga: {}, veiculo: {} });
    expect(dom.valores.pricing.valorCalculado).toBe(360);
    expect(dom.valores.valorFinal).toBe(360);
  });

  it("J) override manual fica marcado no snapshot", () => {
    const comOverride = { ...valores, valorFinal: 400, pricing: { ...valores.pricing, overrideManual: true } };
    const payload = toOrcamentoInsert({ valores: comOverride } as never) as Record<string, any>;
    expect(payload.valores.pricing.overrideManual).toBe(true);
    expect(payload.valores.valorFinal).toBe(400);
  });
});

describe("PRECO-01 — integração da tela", () => {
  const src = read(SRC_FORM);
  it("passa cliente_nome para a seleção de tabela (clientes sem id persistido)", () => {
    expect(src).toContain("cliente_nome: data.cliente");
  });
  it("grava snapshot pricing e mostra a origem do cálculo", () => {
    expect(src).toContain("v.pricing =");
    expect(src).toContain("Tabela aplicada:");
    expect(src).toContain("Distância considerada:");
    expect(src).toContain("Recalcular pela tabela");
  });
  it("não inventa preço quando a tabela não tem valor", () => {
    expect(src).toContain("Preço não disponível na tabela selecionada.");
  });
  it("serviço aceita cliente_nome (níveis por nome do cliente)", () => {
    const svc = read(SRC_SVC);
    expect(svc).toContain("input.cliente_nome");
  });
});
