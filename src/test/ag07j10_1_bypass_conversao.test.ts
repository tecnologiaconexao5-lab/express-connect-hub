import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// AG-07J.10.1 — FECHAMENTO RESSALVAS: BYPASS DE CONVERSÃO
// Valida que converterCandidatoParaPrestador() rejeita candidatos
// cujo stage não é aprovado/ativo/prestador_apto.
// ============================================================================

let candidatoStore: Record<string, any> = {};

const makeBuilder = (tabela: string) => {
  const b: any = {};
  for (const m of ["select", "eq", "in", "neq", "gte", "lte", "or", "ilike", "order", "limit", "range", "insert", "update", "delete"]) {
    b[m] = () => b;
  }
  b.maybeSingle = async () => ({ data: candidatoStore || null, error: null });
  b.single = async () => ({ data: candidatoStore || null, error: null });
  b.then = (resolve: any) =>
    resolve({ data: [], count: 0, error: null });
  return b;
};

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (t: string) => makeBuilder(t),
  },
}));

// Mock enterpriseKanbanService
const mockGetCandidateById = vi.fn();
vi.mock("../modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService", () => ({
  enterpriseKanbanService: {
    getCandidateById: (...args: any[]) => mockGetCandidateById(...args),
    mover: vi.fn(async () => ({})),
    registrarEvento: vi.fn(async () => {}),
  },
}));

// Mock prestadoresService
vi.mock("../modules/recrutamento/services/prestadoresService", () => ({
  prestadoresService: {
    criar: vi.fn(async (data: any) => ({ id: "novo-prestador-id", ...data })),
    obter: vi.fn(async () => null),
    listar: vi.fn(async () => []),
  },
}));

// Mock identidadePrestadorService
vi.mock("../modules/recrutamento/services/identidadePrestadorService", () => ({
  buscarPrestadorOperacionalExistente: vi.fn(async () => null),
}));

import { conversaoCandidatoService } from "../modules/recrutamento/services/conversaoCandidatoService";

function makeCandidate(stage: string, overrides: Record<string, any> = {}) {
  return {
    id: "cand-001",
    nome: "João Silva",
    telefone: "(11) 99999-0000",
    email: "joao@test.com",
    cidade: "São Paulo",
    uf: "SP",
    veiculo: "Carreta",
    placa: "ABC1234",
    stage,
    score: 75,
    tags: [],
    documentos: [],
    historico: [],
    observacoesIA: "",
    dataEntrada: "2026-01-01",
    dataAtualizacao: "2026-01-15",
    ...overrides,
  };
}

describe("AG-07J.10.1 — Bypass de Conversão (service)", () => {
  beforeEach(() => {
    candidatoStore = {};
    vi.clearAllMocks();
  });

  it("aprovado + completo → pode converter", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", { statusDocumental: "completo" }));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(true);
  });

  it("ativo + completo → pode converter", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("ativo", { statusDocumental: "completo" }));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(true);
  });

  it("prestador_apto + completo → pode converter", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("prestador_apto", { statusDocumental: "completo" }));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(true);
  });

  it("novo_cadastro → NÃO pode converter (rejeitado pelo stage)", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("novo_cadastro", { statusDocumental: "completo" }));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("novo_cadastro");
  });

  it("em_analise → NÃO pode converter (rejeitado pelo stage)", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("em_analise", { statusDocumental: "completo" }));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("em_analise");
  });

  it("documentacao_pendente → NÃO pode converter (rejeitado pelo stage)", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("documentacao_pendente", { statusDocumental: "completo" }));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
  });

  it("reprovado → NÃO pode converter (rejeitado pelo stage)", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("reprovado", { statusDocumental: "completo" }));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("reprovado");
  });

  it("bloqueado → NÃO pode converter (rejeitado pelo stage)", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("bloqueado", { statusDocumental: "completo" }));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("bloqueado");
  });

  it("candidato inexistente → erro", async () => {
    mockGetCandidateById.mockResolvedValue(null);
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("nao-existe");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("não encontrado");
  });

  it("candidato sem telefone → erro (antes da validação de stage)", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", { telefone: "", statusDocumental: "completo" }));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("telefone");
  });
});
