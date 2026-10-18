import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// AG-07J.11 — GATE DOCUMENTAL TMS
// Valida que converterCandidatoParaPrestador() aplica fail-closed:
// Somente statusDocumental === 'completo' permite conversão.
// Todos os demais estados bloqueiam (parcial, pendente, vencido,
// bloqueado, status desconhecido/inesperado).
//
// Reutiliza statusDocumental pré-computado por
// calcularStatusDocumentalOperacional() durante normalizeCandidate().
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
const mockCriar = vi.fn(async (data: any) => ({ id: "novo-prestador-id", ...data }));
vi.mock("../modules/recrutamento/services/prestadoresService", () => ({
  prestadoresService: {
    criar: (...args: any[]) => mockCriar(...args),
    obter: vi.fn(async () => null),
    listar: vi.fn(async () => []),
  },
}));

// Mock identidadePrestadorService
vi.mock("../modules/recrutamento/services/identidadePrestadorService", () => ({
  buscarPrestadorOperacionalExistente: vi.fn(async () => null),
}));

import { conversaoCandidatoService } from "../modules/recrutamento/services/conversaoCandidatoService";

function makeCandidate(
  stage: string,
  statusDocumental: string,
  overrides: Record<string, any> = {}
) {
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
    statusDocumental,
    ...overrides,
  };
}

describe("AG-07J.11 — Gate Documental TMS (fail-closed)", () => {
  beforeEach(() => {
    candidatoStore = {};
    vi.clearAllMocks();
  });

  // ─── PERMITE CONVERSÃO ───────────────────────────────────────────────

  it("completo → PERMITE conversão", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", "completo"));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(true);
    expect(result.tipo).toBe("criado");
  });

  // ─── BLOQUEIA CONVERSÃO ──────────────────────────────────────────────

  it("parcial → BLOQUEIA conversão", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", "parcial"));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("Documentação obrigatória incompleta ou inválida");
  });

  it("pendente → BLOQUEIA conversão", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", "pendente"));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("Documentação obrigatória incompleta ou inválida");
  });

  it("vencido → BLOQUEIA conversão", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", "vencido"));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("Documentação obrigatória incompleta ou inválida");
  });

  it("bloqueado → BLOQUEIA conversão", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", "bloqueado"));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("Documentação obrigatória incompleta ou inválida");
  });

  it("CNH vencida (statusDocumental='bloqueado') → BLOQUEIA conversão", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", "bloqueado"));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("Documentação obrigatória incompleta ou inválida");
  });

  it("CNH válida + CRLV obrigatório ausente (statusDocumental='parcial') → BLOQUEIA conversão", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", "parcial"));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("Documentação obrigatória incompleta ou inválida");
  });

  it("sem documentos (statusDocumental='pendente') → BLOQUEIA conversão", async () => {
    mockGetCandidateById.mockResolvedValue(
      makeCandidate("aprovado", "pendente", { documentos: [] })
    );
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("Documentação obrigatória incompleta ou inválida");
  });

  it("status documental inesperado (ex: 'indisponivel') → BLOQUEIA conversão (fail-closed)", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", "indisponivel" as any));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("Documentação obrigatória incompleta ou inválida");
  });

  // ─── STAGE INVÁLIDO + DOCUMENTOS COMPLETOS ──────────────────────────

  it("stage inválido + documentos completos → BLOQUEIA pelo stage (antes do gate documental)", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("novo_cadastro", "completo"));
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("novo_cadastro");
  });

  // ─── PROVA: FALHA DOCUMENTAL NÃO GERA STATUS ATIVO / LIBERADO_APP ──

  it("falha documental NÃO gera prestadores.status='ativo'", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", "parcial"));
    await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it("falha documental NÃO gera prestadores.liberado_app=true", async () => {
    mockGetCandidateById.mockResolvedValue(makeCandidate("aprovado", "parcial"));
    await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(mockCriar).not.toHaveBeenCalled();
  });

  // ─── CANDIDATO INEXISTENTE / SEM TELEFONE ────────────────────────────

  it("candidato inexistente → erro", async () => {
    mockGetCandidateById.mockResolvedValue(null);
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("nao-existe");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("não encontrado");
  });

  it("candidato sem telefone → erro (antes do gate documental)", async () => {
    mockGetCandidateById.mockResolvedValue(
      makeCandidate("aprovado", "completo", { telefone: "" })
    );
    const result = await conversaoCandidatoService.converterCandidatoParaPrestador("cand-001");
    expect(result.success).toBe(false);
    expect(result.mensagem).toContain("telefone");
  });
});
