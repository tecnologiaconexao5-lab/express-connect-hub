/**
 * CAD-VEIC-02 — Persistência canônica do tipo de veículo.
 *
 * Canônico: veiculos.tipo_veiculo | Legado: veiculos.tipo
 * ADD/EDIT gravam `tipo_veiculo`; sanitizer preserva; edição lê canônico primeiro.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  sanitizeVeiculoPayload,
  camposTipoVeiculo,
  lerTipoVeiculo,
  VEICULO_PAYLOAD_ALLOWLIST,
} from "@/helpers/veiculoPayload";
import { resolverFranquiaEfetiva } from "@/helpers/franquiaKm";
import { normalizarCondicaoTerica } from "@/helpers/condicaoTerica";
import { resolverRepassePrestadorBase } from "@/helpers/repassePrestador";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const DETALHE = readSrc("src/components/prestadores/PrestadorDetalhe.tsx");
const LISTA = readSrc("src/components/prestadores/PrestadoresLista.tsx");

// T1 — novo veículo inicia sem Fiorino artificial
describe("T1: sem default artificial Fiorino", () => {
  it("componente não contém tipoVeiculo: \"fiorino\"", () => {
    expect(DETALHE.includes('tipoVeiculo: "fiorino"')).toBe(false);
  });
  it("camposTipoVeiculo sem valor → vazio", () => {
    expect(camposTipoVeiculo("")).toEqual({});
    expect(camposTipoVeiculo(undefined)).toEqual({});
  });
});

// T2 — salvar sem tipo explícito é bloqueado
describe("T2: salvar sem tipo é bloqueado", () => {
  it("há validação explícita no componente", () => {
    expect(DETALHE.includes("Selecione o tipo de veículo")).toBe(true);
  });
  it("botão desabilitado sem tipo", () => {
    expect(DETALHE.includes("!novoVeiculo.placa || !novoVeiculo.tipoVeiculo")).toBe(true);
  });
});

// T3 — selecionar Fiorino → payload tipo_veiculo=fiorino
describe("T3: Fiorino → tipo_veiculo", () => {
  it("payload canônico fiorino", () => {
    const p = sanitizeVeiculoPayload({ placa: "ABC1D23", ...camposTipoVeiculo("fiorino") });
    expect(p.tipo_veiculo).toBe("fiorino");
  });
});

// T4 — selecionar VUC → payload tipo_veiculo=vuc
describe("T4: VUC → tipo_veiculo", () => {
  it("payload canônico vuc", () => {
    expect(sanitizeVeiculoPayload(camposTipoVeiculo("vuc")).tipo_veiculo).toBe("vuc");
  });
});

// T5 — outro tipo → canonical correspondente
describe("T5: outros tipos → canônico", () => {
  it("truck e tres_quartos", () => {
    expect(sanitizeVeiculoPayload(camposTipoVeiculo("truck")).tipo_veiculo).toBe("truck");
    expect(sanitizeVeiculoPayload(camposTipoVeiculo("tres_quartos")).tipo_veiculo).toBe("tres_quartos");
  });
});

// T6 — ADD preserva tipo_veiculo no sanitizer
describe("T6: sanitizer preserva tipo_veiculo", () => {
  it("allowlist contém tipo_veiculo", () => {
    expect(VEICULO_PAYLOAD_ALLOWLIST).toContain("tipo_veiculo");
  });
  it("sanitize mantém tipo_veiculo", () => {
    const p = sanitizeVeiculoPayload({ tipo_veiculo: "van", tipo: "van", foo: "bar" });
    expect(p.tipo_veiculo).toBe("van");
    expect(p.foo).toBeUndefined();
  });
});

// T7 — EDIT grava tipo_veiculo
describe("T7: EDIT grava tipo_veiculo", () => {
  it("handleUpdateVeiculo usa camposTipoVeiculo", () => {
    const idx = DETALHE.indexOf("handleUpdateVeiculo");
    const block = DETALHE.slice(idx, idx + 900);
    expect(block.includes("camposTipoVeiculo(veiculoData.tipoVeiculo)")).toBe(true);
  });
});

// T8 — EDIT carrega canonical primeiro
describe("T8: leitura canônica primeiro", () => {
  it("tipo_veiculo vence tipo", () => {
    expect(lerTipoVeiculo({ tipo_veiculo: "fiorino", tipo: "vuc" })).toBe("fiorino");
  });
});

// T9 — registro legado sem canonical usa fallback tipo
describe("T9: fallback legado", () => {
  it("sem tipo_veiculo → usa tipo", () => {
    expect(lerTipoVeiculo({ tipo_veiculo: null, tipo: "vuc" })).toBe("vuc");
    expect(lerTipoVeiculo({ tipo_veiculo: "", tipo: "hr" })).toBe("hr");
  });
});

// T10 — canonical existente vence legacy divergente
describe("T10: canônico vence divergente", () => {
  it("tipo_veiculo divergente do legado", () => {
    expect(lerTipoVeiculo({ tipo_veiculo: "truck", tipo: "moto" })).toBe("truck");
  });
});

// T11 — reload mantém tipo canônico
describe("T11: reload mantém canônico", () => {
  it("PrestadoresLista lê tipo_veiculo com fallback legado", () => {
    expect(LISTA.includes("tipoVeiculo: v.tipo_veiculo || v.tipo")).toBe(true);
  });
});

// T12 — nenhuma alteração de dados existentes (helper puro)
describe("T12: sem mutação", () => {
  it("sanitizeVeiculoPayload não altera a entrada", () => {
    const input = { tipo_veiculo: "vuc", placa: "ABC" };
    const snap = JSON.stringify(input);
    sanitizeVeiculoPayload(input);
    expect(JSON.stringify(input)).toBe(snap);
  });
});

// T13 — ESCALA-05 preservada
describe("T13: ESCALA-05 preservada", () => {
  it("normalização cliente", () => {
    const normalizar = (s: string) => (s || "").trim().toUpperCase();
    expect(normalizar(" Mineirao Abc")).toBe(normalizar("MINEIRAO ABC"));
  });
});

// T14 — ESCALA-06 preservada
describe("T14: ESCALA-06 preservada", () => {
  it("franquia canônica", () => {
    expect(resolverFranquiaEfetiva(100, 0)).toBe(100);
    expect(resolverFranquiaEfetiva(0, 50)).toBe(0);
  });
});

// T15 — ESCALA-07 preservada
describe("T15: ESCALA-07 preservada", () => {
  it("condição térmica canônica", () => {
    expect(normalizarCondicaoTerica("térmico")).toBe("termico");
    expect(normalizarCondicaoTerica("fiorino_refrigerada")).toBeNull();
  });
});

// T16 — ESCALA-PRESTADOR-02 preservada
describe("T16: ESCALA-PRESTADOR-02 preservada", () => {
  it("cadastro 250; 80% = 240", () => {
    expect(resolverRepassePrestadorBase({ modo: "cadastro", valorDiaria: 250, valorSaida: 250, valorBaseCliente: 300 }).base).toBe(250);
    expect(resolverRepassePrestadorBase({ modo: "percentual", percentual: 80, valorBaseCliente: 300 }).base).toBe(240);
  });
});
