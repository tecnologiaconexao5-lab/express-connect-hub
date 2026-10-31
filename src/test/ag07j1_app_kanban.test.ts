import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// AG-07J.1 — VISIBILIDADE APP → RECRUTAMENTO/KANBAN
// Bridge: prestadores (origem='app_motorista') → recrutamento_candidatos
// ============================================================================

const dbRef = vi.hoisted(() => ({
  prestadores: [] as Record<string, unknown>[],
  recrutamento_candidatos: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
}));

const makeBuilder = (tabela: string) => {
  const b: Record<string, any> = {};
  for (const m of ["select", "eq", "neq", "not", "in", "or", "order", "limit", "range", "delete"]) {
    b[m] = () => b;
  }
  b.insert = (payload: any) => {
    const rows = Array.isArray(payload) ? payload : [payload];
    for (const row of rows) {
      const id = row.id ?? `ins_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      dbRef.inserts.push({ ...row, id, _table: tabela });
      (dbRef as any)[tabela]?.push({ ...row, id });
    }
    return b;
  };
  b.update = (payload: any) => {
    dbRef.updates.push({ ...payload, _table: tabela });
    return b;
  };
  b.maybeSingle = async () => ({
    data: (dbRef as any)[tabela]?.[0] ?? null,
    error: null,
  });
  b.single = async () => ({
    data: (dbRef as any)[tabela]?.[0] ?? null,
    error: null,
  });
  b.then = (resolve: any) =>
    resolve({
      data: ((dbRef as any)[tabela] ?? []).map((r: any, i: number) => ({
        ...r,
        id: r.id ?? `${tabela}_${i}`,
      })),
      count: ((dbRef as any)[tabela] ?? []).length,
      error: null,
    });
  return b;
};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (t: string) => makeBuilder(t),
  },
}));

// Import after mock
import { enterpriseKanbanService } from "@/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService";

function makeAppPrestador(overrides: Record<string, any> = {}) {
  return {
    id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    nome_completo: "Motorista App Teste",
    cpf_cnpj: "12345678901",
    telefone: "(11) 99999-1234",
    whatsapp: "(11) 99999-1234",
    email: "app.teste@email.com",
    status: "em_analise",
    liberado_app: false,
    origem_cadastro: "app_motorista",
    veiculos: [{ tipo: "Van", placa: "ABC1D23" }],
    endereco: { cidade: "Guarulhos", estado: "SP" },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  dbRef.prestadores = [];
  dbRef.recrutamento_candidatos = [];
  dbRef.inserts = [];
  dbRef.updates = [];
});

describe("AG-07J.1 — App Kanban Bridge", () => {
  it("A) App prestador novo aparece no Kanban", async () => {
    dbRef.prestadores = [makeAppPrestador({ id: "app_a_001" })];

    const result = await enterpriseKanbanService.listar();
    const appCards = result.filter((c: any) => c.prestadorId === "app_a_001");
    expect(appCards.length).toBe(1);
    expect(appCards[0].nome).toBe("Motorista App Teste");
    expect(appCards[0].veiculo).toBe("Van");
    expect(appCards[0].placa).toBe("ABC1D23");
    expect(appCards[0].stage).toBe("em_analise_perfil");
  });

  it("B) Segunda chamada não cria segundo candidato (dedup)", async () => {
    dbRef.prestadores = [makeAppPrestador({ id: "app_b_001" })];

    await enterpriseKanbanService.listar();
    const insertsAfterFirst = dbRef.inserts.filter(i => i._table === "recrutamento_candidatos").length;

    await enterpriseKanbanService.listar();
    const insertsAfterSecond = dbRef.inserts.filter(i => i._table === "recrutamento_candidatos").length;

    expect(insertsAfterSecond).toBe(insertsAfterFirst);
  });

  it("C) Candidato existente + mesmo prestador não duplica", async () => {
    dbRef.prestadores = [makeAppPrestador({ id: "app_c_001" })];
    dbRef.recrutamento_candidatos = [{
      id: "ec_existente",
      nome: "App Motorista",
      prestador_id: "app_c_001",
      stage: "em_analise",
      tags: [],
      documentos: [],
      historico: [],
      data_entrada: new Date().toISOString(),
      data_atualizacao: new Date().toISOString(),
      score: 50,
    }];

    const result = await enterpriseKanbanService.listar();
    const appCards = result.filter((c: any) => c.prestadorId === "app_c_001");
    expect(appCards.length).toBe(1);
  });

  it("D) Dois prestadores App diferentes → dois cards", async () => {
    dbRef.prestadores = [
      makeAppPrestador({ id: "app_d_001", nome_completo: "Motorista A" }),
      makeAppPrestador({ id: "app_d_002", nome_completo: "Motorista B" }),
    ];

    const result = await enterpriseKanbanService.listar();
    const appCards = result.filter((c: any) => c.prestadorId?.startsWith("app_d_"));
    expect(appCards.length).toBe(2);
  });

  it("E) Sem prestadores App → Kanban funciona normalmente", async () => {
    dbRef.prestadores = [];
    dbRef.recrutamento_candidatos = [{
      id: "ec_manual",
      nome: "Candidato Manual",
      prestador_id: null,
      stage: "em_analise",
      tags: [],
      documentos: [],
      historico: [],
      data_entrada: new Date().toISOString(),
      data_atualizacao: new Date().toISOString(),
      score: 50,
    }];

    const result = await enterpriseKanbanService.listar();
    expect(result.length).toBe(1);
    expect(result[0].prestadorId).toBeUndefined();
  });

  it("F) Múltiplos prestadores App → todos aparecem", async () => {
    dbRef.prestadores = [
      makeAppPrestador({ id: "app_f_1", nome_completo: "M1" }),
      makeAppPrestador({ id: "app_f_2", nome_completo: "M2" }),
      makeAppPrestador({ id: "app_f_3", nome_completo: "M3" }),
    ];

    const result = await enterpriseKanbanService.listar();
    const appCards = result.filter((c: any) => c.prestadorId?.startsWith("app_f_"));
    expect(appCards.length).toBe(3);
  });

  it("G) Status mapping: em_analise, aprovado, bloqueado", async () => {
    dbRef.prestadores = [
      makeAppPrestador({ id: "app_g1", status: "em_analise" }),
      makeAppPrestador({ id: "app_g2", status: "aprovado" }),
      makeAppPrestador({ id: "app_g3", status: "bloqueado" }),
    ];

    const result = await enterpriseKanbanService.listar();
    expect(result.find((c: any) => c.prestadorId === "app_g1")?.stage).toBe("em_analise_perfil");
    expect(result.find((c: any) => c.prestadorId === "app_g2")?.stage).toBe("aprovado");
    expect(result.find((c: any) => c.prestadorId === "app_g3")?.stage).toBe("reprovado");
  });

  it("H) Tags automáticas: veiculo_proprio + disponivel_imediato", async () => {
    dbRef.prestadores = [makeAppPrestador({ id: "app_h_001" })];

    const result = await enterpriseKanbanService.listar();
    const card = result.find((c: any) => c.prestadorId === "app_h_001");
    expect(card).toBeDefined();
    expect(card!.tags).toContain("veiculo_proprio");
    expect(card!.tags).toContain("disponivel_imediato");
  });

  it("I) Veículo preservado no card", async () => {
    dbRef.prestadores = [
      makeAppPrestador({
        id: "app_i_001",
        veiculos: [{ tipo: "Carreta", placa: "DEF5E67" }],
      }),
    ];

    const result = await enterpriseKanbanService.listar();
    const card = result.find((c: any) => c.prestadorId === "app_i_001");
    expect(card).toBeDefined();
    expect(card!.veiculo).toBe("Carreta");
    expect(card!.placa).toBe("DEF5E67");
  });

  it("J) Documentos = array vazio (App não envia docs)", async () => {
    dbRef.prestadores = [makeAppPrestador({ id: "app_j_001" })];

    const result = await enterpriseKanbanService.listar();
    const card = result.find((c: any) => c.prestadorId === "app_j_001");
    expect(card).toBeDefined();
    expect(Array.isArray(card!.documentos)).toBe(true);
  });

  it("K) Histórico inclui evento bridge AG-07J.1", async () => {
    dbRef.prestadores = [makeAppPrestador({ id: "app_k_001" })];

    const result = await enterpriseKanbanService.listar();
    const card = result.find((c: any) => c.prestadorId === "app_k_001");
    expect(card).toBeDefined();
    expect(card!.historico.length).toBeGreaterThan(0);
    expect(card!.historico[0].descricao).toContain("bridge AG-07J.1");
  });

  it("L) Busca por nome encontra candidato App", async () => {
    dbRef.prestadores = [
      makeAppPrestador({ id: "app_l_001", nome_completo: "João da Silva Transportes" }),
    ];

    const result = await enterpriseKanbanService.listar({ busca: "joão" } as any);
    expect(result.length).toBe(1);
    expect(result[0].nome).toBe("João da Silva Transportes");
  });

  it("M) Busca por placa encontra candidato App", async () => {
    dbRef.prestadores = [
      makeAppPrestador({ id: "app_m_001", veiculos: [{ tipo: "Van", placa: "PLACA99" }] }),
    ];

    const result = await enterpriseKanbanService.listar({ busca: "PLACA99" } as any);
    expect(result.length).toBe(1);
    expect(result[0].placa).toBe("PLACA99");
  });

  it("N) Candidato Kanban existente (sem prestadorId) não é afetado", async () => {
    dbRef.prestadores = [makeAppPrestador({ id: "app_n_001" })];
    dbRef.recrutamento_candidatos = [{
      id: "ec_manual_n",
      nome: "Candidato Manual",
      prestador_id: null,
      stage: "em_analise",
      tags: [],
      documentos: [],
      historico: [],
      data_entrada: new Date().toISOString(),
      data_atualizacao: new Date().toISOString(),
      score: 50,
    }];

    const result = await enterpriseKanbanService.listar();
    const manualCards = result.filter((c: any) => !c.prestadorId);
    expect(manualCards.length).toBe(1);
    expect(manualCards[0].nome).toBe("Candidato Manual");
  });

  it("O) Candidato Kanban com prestadorId diferente não é混入", async () => {
    dbRef.prestadores = [makeAppPrestador({ id: "app_o_001" })];
    dbRef.recrutamento_candidatos = [{
      id: "ec_outro",
      nome: "Candidato Outro",
      prestador_id: "prestador_outro_999",
      stage: "em_analise",
      tags: [],
      documentos: [],
      historico: [],
      data_entrada: new Date().toISOString(),
      data_atualizacao: new Date().toISOString(),
      score: 50,
    }];

    const result = await enterpriseKanbanService.listar();
    const appCards = result.filter((c: any) => c.prestadorId === "app_o_001");
    const otherCards = result.filter((c: any) => c.prestadorId === "prestador_outro_999");
    expect(appCards.length).toBe(1);
    expect(otherCards.length).toBe(1);
  });
});
