import { describe, expect, it } from "vitest";
import {
  avaliarMatchOferta,
  grupoVeiculo,
  veiculoCorresponde,
} from "@/utils/logisticaInteligente";
import {
  FILTRO_OFERTAS_VAZIO,
  filtrarOfertas,
  fromOfertaRow,
  type OfertaFiltro,
  type OfertaPublica,
} from "@/modules/recrutamento/services/ofertasPublicasService";

function oferta(overrides: Record<string, unknown> = {}): OfertaPublica {
  return fromOfertaRow({
    id: overrides.id ?? "1",
    protocolo: overrides.protocolo ?? "OF-20261105-TESTE001",
    tipo_oferta: overrides.tipo_oferta ?? "motorista_veiculo_proprio",
    status: overrides.status ?? "nova",
    nome: overrides.nome ?? "Prestador Teste",
    telefone: overrides.telefone ?? "11999999999",
    email: overrides.email ?? "teste@exemplo.com",
    cidade: overrides.cidade ?? "Guarulhos",
    uf: overrides.uf ?? "SP",
    regioes: overrides.regioes ?? ["Grande SP"],
    dias_disponiveis: overrides.dias_disponiveis ?? [1, 2, 3, 4, 5],
    horario_inicio: overrides.horario_inicio ?? "08:00",
    horario_fim: overrides.horario_fim ?? "18:00",
    modalidades: overrides.modalidades ?? ["esporadica"],
    veiculo_tipo: overrides.veiculo_tipo ?? "Fiorino",
    veiculo_modelo: overrides.veiculo_modelo ?? "",
    carroceria: overrides.carroceria ?? "Baú fechado",
    caracteristicas: overrides.caracteristicas ?? [],
    ...overrides,
  } as Record<string, unknown>);
}

function filtro(overrides: Partial<OfertaFiltro> = {}): OfertaFiltro {
  return { ...FILTRO_OFERTAS_VAZIO, ...overrides };
}

describe("GD-07 - sinónimos logísticos", () => {
  it("agrupa utilitários leves (Fiorino, Kangoo, Partner, Doblò, Furgão)", () => {
    const grupo = grupoVeiculo("Fiorino") || [];
    expect(grupo).toEqual(expect.arrayContaining(["fiorino", "kangoo", "partner", "doblo", "furgao"]));
    expect(veiculoCorresponde("Fiorino", oferta({ veiculo_tipo: "Kangoo" }))).toBe(true);
    expect(veiculoCorresponde("Fiorino", oferta({ veiculo_tipo: "Partner" }))).toBe(true);
    expect(veiculoCorresponde("Fiorino", oferta({ veiculo_tipo: "VUC" }))).toBe(false);
  });

  it("agrupa VUC/HR/Kia Bongo/Iveco Daily/3-4", () => {
    const grupo = grupoVeiculo("VUC") || [];
    expect(grupo).toEqual(expect.arrayContaining(["vuc", "hr", "kia bongo", "iveco daily", "3/4"]));
    expect(veiculoCorresponde("VUC", oferta({ veiculo_tipo: "HR" }))).toBe(true);
    expect(veiculoCorresponde("VUC", oferta({ veiculo_tipo: "Iveco Daily" }))).toBe(true);
    expect(veiculoCorresponde("VUC", oferta({ veiculo_tipo: "Fiorino" }))).toBe(false);
  });

  it("agrupa Moto/Motoboy/CG", () => {
    expect(veiculoCorresponde("Moto", oferta({ veiculo_tipo: "Moto" }))).toBe(true);
    expect(veiculoCorresponde("Moto", oferta({ veiculo_tipo: "Moto", veiculo_modelo: "CG 160" }))).toBe(true);
    expect(veiculoCorresponde("Moto", oferta({ veiculo_tipo: "VUC" }))).toBe(false);
  });
});

describe("GD-07 - filtro por veículo com sinónimos", () => {
  it("Fiorino retorna Kangoo e Partner, mas não VUC", () => {
    const lista = [
      oferta({ id: "1", nome: "Kangoo", veiculo_tipo: "Kangoo" }),
      oferta({ id: "2", nome: "Partner", veiculo_tipo: "Partner" }),
      oferta({ id: "3", nome: "VUC", veiculo_tipo: "VUC" }),
    ];
    expect(filtrarOfertas(lista, filtro({ veiculoTipo: "Fiorino" })).map((o) => o.nome)).toEqual([
      "Kangoo",
      "Partner",
    ]);
  });
});

describe("GD-07 - busca como match operacional", () => {
  const lista = [
    oferta({
      id: "a",
      nome: "Urgente Guarulhos",
      veiculo_tipo: "Fiorino",
      carroceria: "Baú fechado",
      cidade: "Guarulhos",
      regioes: ["Grande SP"],
      modalidades: ["urgente"],
    }),
    oferta({
      id: "b",
      nome: "Fixo ABC",
      veiculo_tipo: "HR",
      carroceria: "Grade baixa",
      cidade: "Santo André",
      regioes: ["ABC Paulista"],
      modalidades: ["fixa"],
    }),
    oferta({
      id: "c",
      nome: "Moto Zona Sul",
      veiculo_tipo: "Moto",
      carroceria: "",
      cidade: "São Paulo",
      regioes: ["Grande SP"],
      modalidades: ["esporadica"],
    }),
  ];

  it("digitando uma demanda, ranqueia quem tem mais aderência", () => {
    const resultado = filtrarOfertas(lista, filtro({ busca: "urgente guarulhos baú" }));
    expect(resultado[0]?.nome).toBe("Urgente Guarulhos");

    const detalhado = avaliarMatchOferta(resultado[0], "urgente guarulhos baú");
    expect(detalhado.match).toBe(true);
    expect(detalhado.score).toBeGreaterThan(0);
    expect(detalhado.motivos.join(" ")).toContain("modalidade");
    expect(detalhado.motivos.join(" ")).toContain("regiao");
  });

  it("busca por veículo usa o grupo de sinónimos", () => {
    const resultado = filtrarOfertas(lista, filtro({ busca: "fiorino" }));
    expect(resultado.map((o) => o.nome)).toContain("Urgente Guarulhos");
    expect(resultado.map((o) => o.nome)).not.toContain("Fixo ABC");
  });

  it("busca por modalidade e região cruza os campos da oferta", () => {
    expect(filtrarOfertas(lista, filtro({ busca: "fixo" })).map((o) => o.nome)).toEqual(["Fixo ABC"]);
    expect(filtrarOfertas(lista, filtro({ busca: "zona sul" })).map((o) => o.nome)).toContain(
      "Moto Zona Sul",
    );
  });

  it("texto inexistente não retorna ofertas", () => {
    expect(filtrarOfertas(lista, filtro({ busca: "inexistente" }))).toHaveLength(0);
  });
});
