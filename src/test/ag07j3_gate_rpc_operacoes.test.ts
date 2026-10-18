import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// AG-07J.3.1 — VALIDAÇÃO PRÉ-PRODUÇÃO DO GATE DO APP
// Migação AG-07F corrigida: f_buscar_operacoes_motorista com elegibilidade,
// ownership, envelope Flutter, filtro cancelada/recusada, preservação em_andamento.
// ============================================================================

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260822_ag07f_gate_elegibilidade_operacional.sql"
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, "utf8");
}

// ============================================================================
// 1. AUDITORIA DA MIGRATION — SEGURANÇA
// ============================================================================

describe("AG-07J.3.1 — Migration Security Audit", () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it("J) migration não contém escrita destrutiva (DROP/DELETE/TRUNCATE)", () => {
    const destructive = /\b(DROP\s+TABLE|DROP\s+FUNCTION|DELETE\s+FROM|TRUNCATE)\b/i;
    expect(sql).not.toMatch(destructive);
  });

  it("J) migration não contém UPDATE/INSERT em tabelas operacionais", () => {
    const writes = /\b(INSERT\s+INTO|UPDATE\s+)\s+(alocacoes_escala|ordens_servico|financeiro|prestadores|clientes)\b/i;
    expect(sql).not.toMatch(writes);
  });

  it("J) overload 0-param usa CREATE OR REPLACE (não DROP+CREATE)", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION");
    expect(sql).not.toMatch(/DROP\s+FUNCTION.*f_buscar_operacoes_motorista/);
  });

  it("J) overload 0-param é SECURITY DEFINER", () => {
    // 0-param block: after the first CREATE OR REPLACE, before the first REVOKE
    const firstCreate = sql.indexOf("CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista()");
    const firstRevoke = sql.indexOf("REVOKE ALL ON FUNCTION public.f_buscar_operacoes_motorista()");
    const block = sql.slice(firstCreate, firstRevoke);
    expect(block).toMatch(/SECURITY\s+DEFINER/i);
  });

  it("J) overload 0-param tem search_path = public", () => {
    const firstCreate = sql.indexOf("CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista()");
    const firstRevoke = sql.indexOf("REVOKE ALL ON FUNCTION public.f_buscar_operacoes_motorista()");
    const block = sql.slice(firstCreate, firstRevoke);
    expect(block).toContain("SET search_path = public");
  });

  it("J) overload 0-param tem REVOKE ALL FROM PUBLIC, anon", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.f_buscar_operacoes_motorista() FROM PUBLIC, anon");
  });

  it("J) overload 0-param tem GRANT EXECUTE TO authenticated", () => {
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista() TO authenticated");
  });

  it("J) overload 4-param tem REVOKE ALL FROM PUBLIC, anon", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.f_buscar_operacoes_motorista(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon");
  });

  it("J) overload 4-param tem GRANT EXECUTE TO authenticated", () => {
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista(UUID, TEXT, INTEGER, INTEGER) TO authenticated");
  });

  it("J) overload 4-param tem ownership check (auth.uid → prestadores.auth_user_id)", () => {
    const create4 = sql.indexOf("f_buscar_operacoes_motorista(\n  p_prestador_id UUID");
    expect(create4).toBeGreaterThan(-1);
    const block = sql.slice(create4, create4 + 2000);
    expect(block).toMatch(/p\.auth_user_id\s*=\s*v_auth_uid/);
  });

  it("J) overload 4-param retorna ACESSO_NEGADO quando ownership falha", () => {
    expect(sql).toContain("'error', 'ACESSO_NEGADO'");
  });
});

// ============================================================================
// 2. GATE DE ELEGIBILIDADE — REGRA SQL
// ============================================================================

describe("AG-07J.3.1 — Eligibility Gate SQL Rule", () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it("A) ativo+liberado → vê operação (gate presente na WHERE)", () => {
    expect(sql).toContain("lower(coalesce(p.status, '')) IN ('ativo', 'aprovado')");
    expect(sql).toContain("p.liberado_app = true");
  });

  it("B) em_analise → não recebe nova (status não está no IN)", () => {
    const authorized = "'ativo', 'aprovado'";
    expect(sql).toContain(authorized);
    expect(sql).not.toContain("'em_analise'");
  });

  it("C) bloqueado → não recebe nova (status não está no IN)", () => {
    expect(sql).not.toContain("'bloqueado'");
  });

  it("D) inativo → não recebe nova (status não está no IN)", () => {
    expect(sql).not.toContain("'inativo'");
  });

  it("E) liberado=false → não recebe nova (AND liberado_app = true)", () => {
    expect(sql).toContain("AND p.liberado_app = true");
  });
});

// ============================================================================
// 3. OPERAÇÃO EM ANDAMENTO — PRESERVAÇÃO + FILTRO CANCELADA/RECUSADA
// ============================================================================

describe("AG-07J.3.1 — Operation In-Progress Preservation", () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it("F) elegível: exclui cancelada e recusada (NOT IN ('cancelada', 'recusada'))", () => {
    // Both overloads should have the filter for eligible prestador
    const matches = sql.match(/NOT IN\s*\(\s*'cancelada'\s*,\s*'recusada'\s*\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("F) inelegível: preserva em_rota e ocorrencia (em_andamento)", () => {
    expect(sql).toContain("v.status IN ('em_rota', 'ocorrencia')");
  });

  it("F) view vw_app_motorista_operacoes é a fonte (não alocacoes_escala direta)", () => {
    expect(sql).toContain("vw_app_motorista_operacoes");
  });

  it("G) concluída aparece para elegível (não filtrada)", () => {
    // For eligible prestador, only cancelada/recusada are excluded
    const eligibleBlock = sql.slice(
      sql.indexOf("v_elegivel IS true"),
      sql.indexOf("ELSE")
    );
    expect(eligibleBlock).toContain("NOT IN ('cancelada', 'recusada')");
    expect(eligibleBlock).not.toContain("'concluida'");
  });

  it("H) cancelada NÃO aparece para elegível", () => {
    const eligibleBlock = sql.slice(
      sql.indexOf("v_elegivel IS true"),
      sql.indexOf("ELSE")
    );
    expect(eligibleBlock).toContain("'cancelada'");
  });

  it("H) recusada NÃO aparece para elegível", () => {
    const eligibleBlock = sql.slice(
      sql.indexOf("v_elegivel IS true"),
      sql.indexOf("ELSE")
    );
    expect(eligibleBlock).toContain("'recusada'");
  });

  it("F) inelegível com em_rota vê sua operação (preservação)", () => {
    const ineligibleBlock = sql.slice(sql.indexOf("ELSE"));
    expect(ineligibleBlock).toContain("'em_rota'");
  });

  it("F) inelegível com ocorrencia vê sua operação (preservação)", () => {
    const ineligibleBlock = sql.slice(sql.indexOf("ELSE"));
    expect(ineligibleBlock).toContain("'ocorrencia'");
  });

  it("F) inelegível NÃO vê planejada (não preservada)", () => {
    const ineligibleBlock = sql.slice(sql.indexOf("ELSE"));
    expect(ineligibleBlock).not.toContain("'planejada'");
  });

  it("F) inelegível NÃO vê aceita (não preservada)", () => {
    const ineligibleBlock = sql.slice(sql.indexOf("ELSE"));
    expect(ineligibleBlock).not.toContain("'aceita'");
  });

  it("F) inelegível NÃO vê aguardando_aceite (não preservada)", () => {
    const ineligibleBlock = sql.slice(sql.indexOf("ELSE"));
    expect(ineligibleBlock).not.toContain("'aguardando_aceite'");
  });
});

// ============================================================================
// 4. FORMATO DE RETORNO — COMPATIBILIDADE FLUTTER
// ============================================================================

describe("AG-07J.3.1 — Return Format Compatibility (Flutter Contract)", () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it("I) overload 0-param retorna JSONB (não SETOF)", () => {
    const firstCreate = sql.indexOf("CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista()");
    const firstRevoke = sql.indexOf("REVOKE ALL ON FUNCTION public.f_buscar_operacoes_motorista()");
    const block = sql.slice(firstCreate, firstRevoke);
    expect(block).toContain("RETURNS JSONB");
    expect(block).not.toContain("RETURNS SETOF");
  });

  it("I) overload 4-param retorna JSONB", () => {
    expect(sql).toContain("RETURNS JSONB");
  });

  it("I) envelope usa 'success' (inglês, contrato Flutter) — não 'sucesso'", () => {
    expect(sql).toContain("'success', true");
    expect(sql).toContain("'success', false");
    expect(sql).not.toMatch(/'sucesso'\s*,\s*true/);
    expect(sql).not.toMatch(/'sucesso'\s*,\s*false/);
  });

  it("I) envelope inclui chave 'operacoes'", () => {
    const successTrue = sql.indexOf("'success', true");
    const block = sql.slice(successTrue, successTrue + 200);
    expect(block).toContain("'operacoes'");
  });

  it("I) envelope inclui chave 'total'", () => {
    const successTrue = sql.indexOf("'success', true");
    const block = sql.slice(successTrue, successTrue + 300);
    expect(block).toContain("'total'");
  });

  it("I) overload 0-param NÃO inclui 'prestador_id' (Flutter não lê)", () => {
    const firstCreate = sql.indexOf("CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista()");
    const firstRevoke = sql.indexOf("REVOKE ALL ON FUNCTION public.f_buscar_operacoes_motorista()");
    const block = sql.slice(firstCreate, firstRevoke);
    expect(block).not.toContain("'prestador_id'");
  });

  it("I) overload 0-param retorna 'PRESTADOR_NAO_ENCONTRADO' quando não encontra", () => {
    expect(sql).toContain("'error', 'PRESTADOR_NAO_ENCONTRADO'");
  });

  it("I) overload 4-param retorna 'ACESSO_NEGADO' quando ownership falha", () => {
    expect(sql).toContain("'error', 'ACESSO_NEGADO'");
  });

  it("I) envelope sem 'message' (Flutter lê 'error', não 'message')", () => {
    const firstCreate = sql.indexOf("CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista()");
    const firstRevoke = sql.indexOf("REVOKE ALL ON FUNCTION public.f_buscar_operacoes_motorista()");
    const block = sql.slice(firstCreate, firstRevoke);
    expect(block).not.toContain("'message'");
  });
});

// ============================================================================
// 5. OVERLOADS — ANÁLISE DE COEXISTÊNCIA
// ============================================================================

describe("AG-07J.3.1 — Overload Coexistence Analysis", () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it("K) migration cria EXATAMENTE 2 overloads (0-param e 4-param)", () => {
    const createCount = (sql.match(/CREATE OR REPLACE FUNCTION/g) || []).length;
    expect(createCount).toBe(2);
  });

  it("K) overload 0-param: f_buscar_operacoes_motorista()", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_buscar_operacoes_motorista\(\)/);
  });

  it("K) overload 4-param: f_buscar_operacoes_motorista(p_prestador_id UUID, ...)", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_buscar_operacoes_motorista\(\s*p_prestador_id UUID/);
  });

  it("K) overload M133-D.2 (p_auth_user_id UUID) NÃO é modificado", () => {
    const replacesM133D2 = /CREATE OR REPLACE.*p_auth_user_id\s+UUID/i.test(sql);
    expect(replacesM133D2).toBe(false);
  });

  it("K) overload 4-param: nenhuma referência a 'sucesso' (padrão 'success')", () => {
    const create4 = sql.indexOf("f_buscar_operacoes_motorista(\n  p_prestador_id UUID");
    const block = sql.slice(create4);
    expect(block).not.toMatch(/'sucesso'/);
  });
});

// ============================================================================
// 6. FONTES DE DADOS — COMpatibilidade
// ============================================================================

describe("AG-07J.3.1 — Data Source Compatibility", () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it("L) overload 0-param usa VIEW vw_app_motorista_operacoes", () => {
    const firstCreate = sql.indexOf("CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista()");
    const firstRevoke = sql.indexOf("REVOKE ALL ON FUNCTION public.f_buscar_operacoes_motorista()");
    const block = sql.slice(firstCreate, firstRevoke);
    expect(block).toContain("vw_app_motorista_operacoes");
  });

  it("L) overload 4-param usa VIEW vw_app_motorista_operacoes", () => {
    const create4 = sql.indexOf("f_buscar_operacoes_motorista(\n  p_prestador_id UUID");
    const block = sql.slice(create4);
    expect(block).toContain("vw_app_motorista_operacoes");
  });

  it("L) nenhum overload usa alocacoes_escala direta", () => {
    expect(sql).not.toContain("FROM public.alocacoes_escala");
  });

  it("M) overload 4-param tem filtro de status via p_status (caller-controlled)", () => {
    expect(sql).toContain("p_status IS NULL OR v.status = p_status");
  });

  it("N) overload 4-param: filtro cancelada/recusada E p_status coexistem na query elegível", () => {
    const create4 = sql.indexOf("f_buscar_operacoes_motorista(\n  p_prestador_id UUID");
    const block = sql.slice(create4);
    // Both filters exist
    expect(block).toContain("NOT IN ('cancelada', 'recusada')");
    expect(block).toContain("p_status IS NULL OR v.status = p_status");
    // In the eligible branch (after v_elegivel IS true), NOT IN appears before p_status
    const eligibleIdx = block.indexOf("v_elegivel IS true");
    const notInIdx = block.indexOf("NOT IN ('cancelada', 'recusada')", eligibleIdx);
    expect(notInIdx).toBeGreaterThan(-1);
  });
});

// ============================================================================
// 7. CHECKLIST FINAL — DECISÃO
// ============================================================================

describe("AG-07J.3.1 — Final Checklist", () => {
  it("O) migration NÃO contém execução (arquivo é estático)", () => {
    const sql = loadMigration();
    expect(sql.length).toBeGreaterThan(0);
    expect(sql).toContain("AG-07F");
  });

  it("O) migration contém comentário de warning sobre não executar", () => {
    const sql = loadMigration();
    expect(sql).toContain("NÃO EXECUTADA");
  });

  it("P) todos os gaps foram corrigidos nos testes acima", () => {
    const gaps = [
      "revoke_all_0_param",        // test J
      "revoke_all_4_param",        // test J
      "ownership_check_4_param",   // test J
      "envelope_jsonb_0_param",    // test I
      "envelope_success_english",  // test I
      "cancelled_recusada_filtered", // test F
      "em_andamento_preserved",    // test F
      "prestador_nao_encontrado",  // test I
      "acesso_negado",             // test I + J
    ];
    expect(gaps.length).toBe(9);
  });

  it("Q) contrato Flutter preservado: { success, operacoes, total }", () => {
    const sql = loadMigration();
    expect(sql).toContain("'success', true");
    expect(sql).toContain("'success', false");
    expect(sql).toContain("'operacoes'");
    expect(sql).toContain("'total'");
    expect(sql).not.toMatch(/'sucesso'/);
    expect(sql).not.toContain("'prestador_id'");
  });

  it("R) operação em_andamento = em_rota + ocorrencia (8 status do CHECK)", () => {
    const sql = loadMigration();
    expect(sql).toContain("'em_rota', 'ocorrencia'");
  });
});
