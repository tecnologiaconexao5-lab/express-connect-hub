// ============================================================
// FASE 5 + 6 — Banco de Talentos e Motor de Match
// ============================================================
import { describe, it, expect } from "vitest";
import {
  calcularMatchPrestadores,
  chaveVeiculoMatch,
  type MatchOSContext,
  type PrestadorMatchInput,
} from "@/services/operacao/matchPrestadoresService";
import { aplicarFiltrosTalentos } from "@/services/recrutamento/talentBankService";
import type { FiltrosAvancados, TalentoLogistico } from "@/stores/talentBankStore";

const ctxBase: MatchOSContext = {
  tipoVeiculo: "Fiorino",
  pesoKg: 500,
  cubagemM3: 5,
  temperatura: "seco",
  cidadeColeta: "São Paulo",
  ufColeta: "SP",
  cidadeEntrega: "Campinas",
  ufEntrega: "SP",
  data: "2026-11-16",
  janelaInicio: "08:00",
  janelaFim: "12:00",
  modalidade: "esporadico",
};

function prestador(overrides: Partial<PrestadorMatchInput> = {}): PrestadorMatchInput {
  return {
    id: "p1",
    nome: "Parceiro A",
    telefone: "(11) 99999-9999",
    status: "ativo",
    cidade: "São Paulo",
    uf: "SP",
    regiaoPrincipal: "Grande SP",
    scoreInterno: 5,
    indiceAceite: 100,
    indiceComparecimento: 100,
    indiceEntregaNoPrazo: 100,
    qtdOperacoes: 50,
    veiculos: [
      {
        id: "v1",
        tipo_veiculo: "Fiorino",
        placa: "ABC1D23",
        capacidade_kg: 1000,
        capacidade_m3: 8,
        tipo_carga: "seco",
        status: "ativo",
        principal: true,
      },
    ],
    documentos: [
      { tipo: "CNH", status: "aprovado" },
      { tipo: "CRLV", status: "aprovado" },
      { tipo: "Comprovante de Residência", status: "aprovado" },
      { tipo: "Foto Veículo", status: "aprovado" },
    ],
    perfil: {
      modalidade_preferencial: ["esporadico", "contrato"],
      distancia_max_coleta_km: 50,
      restricoes_operacionais: {},
    },
    disponibilidade: [
      { dia_semana: 1, hora_inicio: "06:00", hora_fim: "18:00", disponivel: true },
    ],
    ...overrides,
  };
}

const filtrosBase: FiltrosAvancados = {
  busca: "",
  cidades: [],
  bairros: [],
  regioes: [],
  estados: [],
  tiposVeiculo: [],
  scoreMin: 0,
  scoreMax: 100,
  disponivel: null,
  experienciaMin: 0,
  experienciaMax: 50,
  statusDocumental: [],
  perfisOperacionais: [],
  tags: [],
  cargasPreferidas: [],
  fazColeta: null,
  fazEntrega: null,
  compatibilidadeMin: 0,
  capacidadeMinKg: 0,
  capacidadeMinM3: 0,
  temperaturas: [],
  diasSemana: [],
  janelaInicio: "",
  janelaFim: "",
  modalidades: [],
  statusTalento: [],
  ordenarPor: "score",
  ordem: "desc",
};

describe("A) Nível 1 — requisitos eliminatórios", () => {
  it("elimina veículo incompatível, peso, documentação e disponibilidade", () => {
    const resultado = calcularMatchPrestadores(ctxBase, [
      prestador(),
      prestador({
        id: "p2",
        nome: "Veículo errado",
        veiculos: [{ tipo_veiculo: "Carreta", status: "ativo", capacidade_kg: 30000, capacidade_m3: 90 }],
      }),
      prestador({
        id: "p3",
        nome: "Peso acima",
        veiculos: [{ tipo_veiculo: "Fiorino", status: "ativo", capacidade_kg: 300, capacidade_m3: 8 }],
      }),
      prestador({
        id: "p4",
        nome: "Doc pendente",
        documentos: [{ tipo: "CNH", status: "pendente" }],
      }),
      prestador({
        id: "p5",
        nome: "Indisponível",
        disponibilidade: [
          { dia_semana: 2, hora_inicio: "06:00", hora_fim: "18:00", disponivel: true },
        ],
      }),
    ]);

    expect(resultado.sugestoes.map((s) => s.prestadorId)).toEqual(["p1"]);
    const motivos = resultado.eliminados.map((e) => `${e.prestadorId}:${e.motivo}`).join(" | ");
    expect(motivos).toContain("p2:Veículo incompatível");
    expect(motivos).toContain("p3:Peso");
    expect(motivos).toContain("p4:Documentação");
    expect(motivos).toContain("p5:Indisponível");
  });
});

describe("B) Nível 2 — pesos exatos da especificação", () => {
  it("calcula o percentual ponderado e ordena do maior para o menor", () => {
    const resultado = calcularMatchPrestadores(ctxBase, [
      prestador({ id: "baixo", nome: "Baixo", indiceAceite: 20, qtdOperacoes: 1, scoreInterno: 1 }),
      prestador({ id: "alto", nome: "Alto" }),
    ]);

    expect(resultado.sugestoes[0].prestadorId).toBe("alto");
    // p1: proximidade 100, entrega 65, disponibilidade 100, reputação 100,
    // experiência 100, modalidade 100, rota 100 → 94,75 arredonda 95.
    expect(resultado.sugestoes[0].compatibilidade).toBe(95);
    expect(resultado.sugestoes[0].detalhes).toEqual({
      proximidade: 100,
      regiaoEntrega: 65,
      disponibilidade: 100,
      reputacao: 100,
      experiencia: 100,
      modalidade: 100,
      rota: 100,
    });
    expect(resultado.sugestoes[0].motivos).toContain("Veículo adequado");
    expect(resultado.sugestoes[0].motivos).toContain("Documentação Ok");
  });

  it("normaliza aliases de veículo", () => {
    expect(chaveVeiculoMatch("Caminhão")).toBe("truck");
    expect(chaveVeiculoMatch("VUC")).toBe("vuc");
    expect(chaveVeiculoMatch("Fiorino")).toBe("fiorino");
  });
});

describe("C) Filtros combinados do Banco de Talentos", () => {
  const talento = (overrides: Partial<TalentoLogistico> = {}) =>
    ({
      id: "t1",
      nome: "Parceiro A",
      foto: "",
      telefone: "",
      email: "",
      cpf: "",
      dataCadastro: "2026-01-01",
      score: 80,
      nivel: "ouro",
      statusDocumental: "completo",
      disponivel: true,
      experienciaAnos: 3,
      perfisOperacionais: [],
      tagsAutomaticas: [],
      tagsPersonalizadas: [],
      cidade: "São Paulo",
      bairro: "",
      regiao: "Grande SP",
      estado: "SP",
      veiculo: { tipo: "Fiorino", modelo: "", placa: "", ano: 2020, capacidade: "", carroceria: "" },
      regioesAtuacao: ["Grande SP"],
      horarios: { inicio: "06:00", fim: "18:00" },
      fazColeta: true,
      fazEntrega: true,
      distanciaMaxima: 50,
      cargaPreferida: ["Carga Seca"],
      totalViagens: 10,
      totalAceitas: 10,
      taxaAceite: 100,
      receitaTotal: 0,
      receitaMediaMes: 0,
      diasSemOperar: 0,
      ultimaOperacao: null,
      documentos: [],
      favorito: false,
      shortlistId: null,
      scoreCompatibilidade: 80,
      capacidadeKg: 1000,
      capacidadeM3: 8,
      temperaturas: ["seco"],
      modalidades: ["esporadico"],
      disponibilidadeJanelas: [
        { diaSemana: 1, horaInicio: "06:00", horaFim: "18:00", disponivel: true },
      ],
      statusPrestador: "ativo",
      homologado: true,
      ...overrides,
    }) as TalentoLogistico;

  it("aplica capacidade, temperatura, dia, janela, modalidade e status", () => {
    const lista = [talento(), talento({ id: "t2", capacidadeKg: 100, temperaturas: ["refrigerado"] })];

    expect(
      aplicarFiltrosTalentos(lista, { ...filtrosBase, capacidadeMinKg: 500 }).map((t) => t.id),
    ).toEqual(["t1"]);
    expect(
      aplicarFiltrosTalentos(lista, { ...filtrosBase, temperaturas: ["refrigerado"] }).map((t) => t.id),
    ).toEqual(["t2"]);
    expect(
      aplicarFiltrosTalentos(lista, { ...filtrosBase, diasSemana: [1] }).map((t) => t.id),
    ).toEqual(["t1", "t2"]);
    expect(
      aplicarFiltrosTalentos(lista, {
        ...filtrosBase,
        janelaInicio: "20:00",
        janelaFim: "22:00",
      }),
    ).toHaveLength(0);
    expect(
      aplicarFiltrosTalentos(lista, { ...filtrosBase, modalidades: ["contrato"] }),
    ).toHaveLength(0);
    expect(
      aplicarFiltrosTalentos(lista, { ...filtrosBase, statusTalento: ["homologado"] }).map((t) => t.id),
    ).toEqual(["t1", "t2"]);
  });
});
