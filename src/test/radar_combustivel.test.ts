import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buscarRadarCombustivel,
  formatarAtualizacaoRadar,
  formatarPrecoCombustivel,
  formatarVariacaoCombustivel,
  RADAR_REGIAO_PADRAO,
} from "@/services/radarCombustivel";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const AGORA = new Date("2026-10-21T09:00:00-03:00");

describe("Radar Operacional — Combustíveis (mock)", () => {
  it("1 — retorna Gasolina, Etanol e Diesel na região de São Paulo/SP", async () => {
    const radar = await buscarRadarCombustivel(undefined, { atrasoMs: 0, agora: AGORA });

    expect(radar.regiao).toBe("São Paulo");
    expect(radar.uf).toBe("SP");
    expect(radar.precos.map((p) => p.id)).toEqual(["gasolina", "etanol", "diesel"]);
    expect(radar.precos.map((p) => p.nome)).toEqual(["Gasolina", "Etanol", "Diesel S10"]);
    expect(radar.precos.every((p) => p.unidade === "R$/L")).toBe(true);
    expect(radar.atualizadoEm).toBe(AGORA.toISOString());
    expect(RADAR_REGIAO_PADRAO).toBe("São Paulo/SP");
  });

  it("2 — preços dentro da faixa plausível de mercado", async () => {
    const radar = await buscarRadarCombustivel(undefined, { atrasoMs: 0, agora: AGORA });
    const [gasolina, etanol, diesel] = radar.precos;

    expect(gasolina.preco).toBeGreaterThan(5.9);
    expect(gasolina.preco).toBeLessThan(6.3);
    expect(etanol.preco).toBeGreaterThan(4.1);
    expect(etanol.preco).toBeLessThan(4.5);
    expect(diesel.preco).toBeGreaterThan(6.0);
    expect(diesel.preco).toBeLessThan(6.4);
  });

  it("3 — valores são estáveis no mesmo dia (sem oscilar a cada render)", async () => {
    const a = await buscarRadarCombustivel(undefined, { atrasoMs: 0, agora: AGORA });
    const b = await buscarRadarCombustivel(undefined, {
      atrasoMs: 0,
      agora: new Date("2026-10-21T23:59:00-03:00"),
    });

    expect(b.precos).toEqual(a.precos);
  });

  it("4 — variação e tendência sempre consistentes", async () => {
    const radar = await buscarRadarCombustivel(undefined, { atrasoMs: 0, agora: AGORA });
    for (const preco of radar.precos) {
      expect(Math.abs(preco.variacaoPercentual)).toBeLessThanOrEqual(1.2);
      if (preco.variacaoPercentual > 0.01) expect(preco.tendencia).toBe("alta");
      else if (preco.variacaoPercentual < -0.01) expect(preco.tendencia).toBe("baixa");
      else expect(preco.tendencia).toBe("estavel");
    }
  });

  it("5 — formatação pt-BR de preço, variação e atualização", () => {
    expect(formatarPrecoCombustivel(6.09)).toContain("6,09");
    expect(formatarVariacaoCombustivel(0.42)).toBe("+0,42%");
    expect(formatarVariacaoCombustivel(-1.2)).toBe("-1,2%");
    expect(formatarAtualizacaoRadar("2026-10-21T12:30:00-03:00")).toMatch(/\d{2}\/\d{2}.*\d{2}:\d{2}/);
    expect(formatarAtualizacaoRadar("data-invalida")).toBe("—");
  });

  it("6 — tela mobile do Radar consome o serviço e o card está na navegação", () => {
    const componente = readSrc("src/components/os-mobile/RadarCombustivelView.tsx");
    expect(componente).toContain("buscarRadarCombustivel");
    expect(componente).toContain("Radar de Combustível");
    expect(componente).toContain("Gasolina");
    expect(componente).toContain("Etanol");
    expect(componente).toContain("Diesel");

    const osMobile = readSrc("src/pages/OsMobile.tsx");
    expect(osMobile).toContain('id: "radar"');
    expect(osMobile).toContain("<RadarCombustivelView");
    expect(osMobile).toContain("grid-cols-4");
  });
});
