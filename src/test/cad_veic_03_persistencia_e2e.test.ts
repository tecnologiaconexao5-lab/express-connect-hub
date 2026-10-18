/**
 * CAD-VEIC-03 — Persistência E2E do tipo de veículo (canônico + espelho legado).
 *
 * Prova a lógica real (camposTipoVeiculo/sanitizeVeiculoPayload) e o wiring do
 * Cadastro do Prestador. O E2E real no banco é feito por script dedicado.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { camposTipoVeiculo, sanitizeVeiculoPayload, lerTipoVeiculo } from "@/helpers/veiculoPayload";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const DETALHE = readSrc("src/components/prestadores/PrestadorDetalhe.tsx");

describe("CAD-VEIC-03 — payload canônico do veículo", () => {
  it("grava tipo_veiculo (canônico) e espelha tipo (legado)", () => {
    expect(camposTipoVeiculo("fiorino")).toEqual({ tipo_veiculo: "fiorino", tipo: "fiorino" });
    expect(camposTipoVeiculo("vuc")).toEqual({ tipo_veiculo: "vuc", tipo: "vuc" });
  });

  it("sem tipo → nenhum campo (sem default artificial)", () => {
    expect(camposTipoVeiculo("")).toEqual({});
    expect(camposTipoVeiculo(undefined)).toEqual({});
  });

  it("sanitizer preserva tipo_veiculo e tipo", () => {
    const p = sanitizeVeiculoPayload({ placa: "ZZE2E03", ...camposTipoVeiculo("truck") });
    expect(p.tipo_veiculo).toBe("truck");
    expect(p.tipo).toBe("truck");
  });

  it("leitura: canônico primeiro, fallback legado", () => {
    expect(lerTipoVeiculo({ tipo_veiculo: "vuc", tipo: "fiorino" })).toBe("vuc");
    expect(lerTipoVeiculo({ tipo_veiculo: null, tipo: "fiorino" })).toBe("fiorino");
  });
});

describe("CAD-VEIC-03 — wiring do Cadastro do Prestador", () => {
  it("ADD e EDIT usam camposTipoVeiculo", () => {
    const ocorrencias = DETALHE.split("camposTipoVeiculo(veiculoData.tipoVeiculo)").length - 1;
    expect(ocorrencias).toBeGreaterThanOrEqual(2);
  });

  it("bloqueia salvar sem tipo selecionado", () => {
    expect(DETALHE).toContain("Selecione o tipo de veículo");
    expect(DETALHE).toContain("!novoVeiculo.placa || !novoVeiculo.tipoVeiculo");
  });

  it("sem default artificial Fiorino", () => {
    expect(DETALHE.includes('tipoVeiculo: "fiorino"')).toBe(false);
  });

  it("CREATE/UPDATE só confirmam após resposta do banco (sem falso sucesso)", () => {
    expect(DETALHE).toContain("Nenhum veículo foi salvo");
    expect(DETALHE).toContain("Nenhum veículo foi atualizado");
    expect(DETALHE).toContain('.select("id")');
  });
});
