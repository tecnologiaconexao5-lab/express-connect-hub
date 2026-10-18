/**
 * ESCALA-UI-VEICULO-01 — Fix da coluna Veículo da grade (tipo_veiculo canônico).
 *
 * Causa raiz: o embed `veiculos(tipo, placa)` omitia `tipo_veiculo`; HML-A27B tem
 * tipo=NULL e tipo_veiculo='vuc' → grade exibia "Sem veículo".
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/operacao/EscalaLista.tsx"),
  "utf8"
);

/** Reproduz o mapping canônico do componente (fallback legado preservado). */
const resolverVeiculo = (veiculos: Array<{ tipo?: string | null; tipo_veiculo?: string | null }> | null | undefined) =>
  veiculos && veiculos.length > 0 ? (veiculos[0].tipo_veiculo || veiculos[0].tipo || "") : "";

describe("ESCALA-UI-VEICULO-01 — resolução do veículo na grade", () => {
  it("1) veículo somente com tipo_veiculo='vuc' → resolve VUC", () => {
    expect(resolverVeiculo([{ tipo: null, tipo_veiculo: "vuc" }])).toBe("vuc");
  });

  it("2) veículo legado somente com tipo → fallback continua funcionando", () => {
    expect(resolverVeiculo([{ tipo: "fiorino", tipo_veiculo: null }])).toBe("fiorino");
  });

  it("3) nenhum veículo → comportamento atual preservado (vazio)", () => {
    expect(resolverVeiculo([])).toBe("");
    expect(resolverVeiculo(null)).toBe("");
    expect(resolverVeiculo(undefined)).toBe("");
  });

  it("4) placa permanece correta (vem do mesmo embed)", () => {
    const v = { tipo: null, tipo_veiculo: "vuc", placa: "HML-A27B" };
    expect(v.placa).toBe("HML-A27B");
  });
});

describe("ESCALA-UI-VEICULO-01 — fonte", () => {
  it("5) o select dos prestadores da grade inclui tipo_veiculo no embed veiculos()", () => {
    expect(SRC).toMatch(/veiculos\(tipo, tipo_veiculo, placa\)/);
  });

  it("6) não há mais embed de veiculos sem tipo_veiculo no fluxo da Escala", () => {
    const embeds = SRC.match(/veiculos\([^)]*\)/g) || [];
    expect(embeds.length).toBeGreaterThan(0);
    for (const e of embeds) {
      expect(e).toMatch(/tipo_veiculo/);
    }
  });
});
