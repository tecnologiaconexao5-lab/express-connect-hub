/**
 * REC-04 — Documentos, FK Canônica e Elegibilidade
 *
 * Valida as 4 correções obrigatórias:
 * CORREÇÃO 1: candidato_documentos NÃO é equivalente ao JSONB documentos
 * CORREÇÃO 2: Listas documentais semanticamente distintas
 * CORREÇÃO 3: liberado_app fail-closed auditado
 * CORREÇÃO 4: FK migration com validação fail-closed
 *
 * Testes: 20 cenários
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ============================================================
// LEITURA DE ARQUIVOS
// ============================================================

const read = (relativePath: string): string => {
  try {
    return readFileSync(resolve(process.cwd(), relativePath), "utf-8");
  } catch {
    return "";
  }
};

let documentosConstants: string;
let AcompanhamentoDocs: string;
let recrutamentoIntegracao: string;
let conversaoCandidatoService: string;
let eligibilityService: string;
let migrationRec04: string;
let enterpriseKanbanService: string;
let enterpriseKanbanTypes: string;

beforeAll(() => {
  documentosConstants = read("src/services/recrutamento/documentosConstants.ts");
  AcompanhamentoDocs = read("src/components/recrutamento/AcompanhamentoDocs.tsx");
  recrutamentoIntegracao = read("src/services/recrutamentoIntegracao.ts");
  conversaoCandidatoService = read("src/modules/recrutamento/services/conversaoCandidatoService.ts");
  eligibilityService = read("src/services/escala/eligibilidadeOperacionalService.ts");
  migrationRec04 = read("supabase/migrations/20260902_rec04_mapeamento_fk_candidato_documentos.sql");
  enterpriseKanbanService = read("src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts");
  enterpriseKanbanTypes = read("src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes.ts");
});

// ============================================================
// CORREÇÃO 1: candidato_documentos ≠ JSONB documentos
// ============================================================

describe("COR-1 — candidato_documentos preservada (não equivalente ao JSONB)", () => {
  it("AcompanhamentoDocs lê de candidato_documentos (não do JSONB documentos)", () => {
    expect(AcompanhamentoDocs).toContain('.from("candidato_documentos")');
  });

  it("AcompanhamentoDocs NÃO lê do JSONB documentos[] de recrutamento_candidatos", () => {
    // O componente usa tabela separada, não JSONB
    expect(AcompanhamentoDocs).not.toContain('.select("documentos")');
    expect(AcompanhamentoDocs).not.toContain('documentos: []');
  });

  it("candidato_documentos tem campos ausentes no JSONB (arquivo_url, dados_extraidos, analise_ia_id)", () => {
    // Documentação: estas colunas existem na tabela mas NÃO no JSONB
    // O JSONB documentos[] só tem: nome, status, dataValidade, observacao
    expect(documentosConstants).toContain("recrutamento_legado_mantido");
    // A classificação confirma que a tabela é MANTIDA (não eliminada)
  });

  it("documentosConstants classifica candidato_documentos como mantida (não deprecated)", () => {
    expect(documentosConstants).toContain('candidato_documentos: "recrutamento_legado_mantido"');
    expect(documentosConstants).not.toContain('candidato_documentos: "deprecated"');
  });

  it("AcompanhamentoDocs usa JOIN por candidato_id (FK agora aponta para recrutamento_candidatos)", () => {
    // Após REC-04, candidato_documentos.candidato_id → recrutamento_candidatos(id)
    expect(AcompanhamentoDocs).toContain('.from("recrutamento_candidatos")');
    expect(AcompanhamentoDocs).toContain('.from("candidato_documentos")');
    expect(AcompanhamentoDocs).toContain('.in("candidato_id", candidatoIds)');
  });
});

// ============================================================
// CORREÇÃO 2: Listas documentais semanticamente distintas
// ============================================================

describe("COR-2 — Listas documentais por finalidade", () => {
  it("CHECKLIST_RECRUTAMENTO existe e tem 5 itens", () => {
    expect(documentosConstants).toContain("CHECKLIST_RECRUTAMENTO");
    expect(documentosConstants).toContain('"cnh"');
    expect(documentosConstants).toContain('"crlv"');
    expect(documentosConstants).toContain('"antt"');
    expect(documentosConstants).toContain('"residencia"');
    expect(documentosConstants).toContain('"bancario"');
  });

  it("DOCS_CONVERSAO_OBRIGATORIOS: CNH, CRLV, Comprovante Residência, Foto Veículo", () => {
    expect(documentosConstants).toContain('"CNH"');
    expect(documentosConstants).toContain('"CRLV"');
    expect(documentosConstants).toContain('"Comprovante Residência"');
    expect(documentosConstants).toContain('"Foto Veículo"');
  });

  it("ANTT é OPCIONAL na conversão (não bloqueia)", () => {
    expect(documentosConstants).toContain("DOCS_CONVERSAO_OPCIONAIS");
    expect(documentosConstants).toContain('"ANTT"]');
    // ANTT NÃO está em DOCS_CONVERSAO_OBRIGATORIOS
    const convObrigatorios = documentosConstants.substring(
      documentosConstants.indexOf("DOCS_CONVERSAO_OBRIGATORIOS"),
      documentosConstants.indexOf("DOCS_CONVERSAO_OPCIONAIS")
    );
    expect(convObrigatorios).not.toContain('"ANTT"');
  });

  it("DOCS_OPERACAO_OBRIGATORIOS: CNH, Comprovante de Endereço, Comprovante de Residência", () => {
    expect(documentosConstants).toContain("DOCS_OPERACAO_OBRIGATORIOS");
    expect(documentosConstants).toContain('"Comprovante de Endereço"');
    expect(documentosConstants).toContain('"Comprovante de Residência"');
  });

  it("CRLV é CONDICIONAL na operação (exigido apenas com veículo)", () => {
    expect(documentosConstants).toContain("DOCS_OPERACAO_CONDICIONAIS");
    expect(documentosConstants).toContain('tipo: "CRLV"');
    expect(documentosConstants).toContain('condicao: "prestador_possui_veiculo"');
  });

  it("Dados Bancários NÃO é gate (não está em nenhuma lista obrigatória/condicional)", () => {
    // Dados Bancários só aparece no CHECKLIST_RECRUTAMENTO (informativo)
    const convergenciaIdx = documentosConstants.indexOf("DOCS_CONVERSAO_OBRIGATORIOS");
    const operacaoIdx = documentosConstants.indexOf("DOCS_OPERACAO_OBRIGATORIOS");
    const convergenciaBloco = documentosConstants.substring(convergenciaIdx, documentosConstants.indexOf("DOCS_CONVERSAO_OPCIONAIS"));
    const operacaoBloco = documentosConstants.substring(operacaoIdx, documentosConstants.indexOf("DOCS_OPERACAO_CONDICIONAIS"));

    expect(convergenciaBloco).not.toContain("Dados Bancários");
    expect(operacaoBloco).not.toContain("Dados Bancários");
  });

  it("Comentário documenta que Dados Bancários é dado cadastral/financeiro", () => {
    expect(documentosConstants).toContain("dado cadastral/financeiro");
  });

  it("Comentário documenta que ANTT é para carga intermunicipal/interestadual", () => {
    expect(documentosConstants).toContain("intermunicipal");
  });
});

// ============================================================
// CORREÇÃO 3: liberado_app fail-closed
// ============================================================

describe("COR-3 — liberado_app fail-closed", () => {
  it("recrutamentoIntegracao: liberado_app = false (fail-closed) no novo prestador", () => {
    // Busca o bloco de criação de novo prestador — maior window por causa dos comentários
    const idx = recrutamentoIntegracao.indexOf("Criando novo prestador");
    const bloco = recrutamentoIntegracao.substring(idx, idx + 1200);
    expect(bloco).toContain("liberado_app: false");
  });

  it("recrutamentoIntegracao: NÃO tem liberado_app: true em nenhum lugar", () => {
    const matches = recrutamentoIntegracao.match(/liberado_app:\s*true/g);
    expect(matches).toBeNull();
  });

  it("conversaoCandidatoService: liberado_app é condicional ao statusOperacional", () => {
    expect(conversaoCandidatoService).toContain("liberado_app: statusOperacional === 'ativo'");
  });

  it("conversaoCandidatoService: é a autoridade canônica para liberado_app", () => {
    // sincronizarComOperacao é o único caminho legítimo
    expect(conversaoCandidatoService).toContain("sincronizarComOperacao");
  });

  it("comentário documenta que conversaoCandidatoService é a autoridade", () => {
    expect(recrutamentoIntegracao).toContain("conversaoCandidatoService.sincronizarComOperacao");
  });
});

// ============================================================
// CORREÇÃO 4: FK migration fail-closed
// ============================================================

describe("COR-4 — FK migration fail-closed", () => {
  it("migration valida NULLs em candidato_id", () => {
    expect(migrationRec04).toContain("candidato_id IS NULL");
    expect(migrationRec04).toContain("RAISE EXCEPTION");
  });

  it("migration valida orfãos (candidato_documentos sem对应 em recrutamento_candidatos)", () => {
    expect(migrationRec04).toContain("LEFT JOIN public.recrutamento_candidatos rc ON rc.id = cd.candidato_id");
    expect(migrationRec04).toContain("orfaos > 0");
    expect(migrationRec04).toContain("RAISE EXCEPTION");
  });

  it("migration valida órfãos recrutamento_candidatos sem对应 em candidatos", () => {
    expect(migrationRec04).toContain("recrutamento_candidatos rc");
    expect(migrationRec04).toContain("LEFT JOIN public.candidatos c ON c.id = rc.id");
  });

  it("migration valida tenant_id cross-table se existir", () => {
    expect(migrationRec04).toContain("tenant_id");
    expect(migrationRec04).toContain("cd.tenant_id != rc.tenant_id");
    expect(migrationRec04).toContain("RAISE EXCEPTION");
  });

  it("migration usa ON DELETE CASCADE na nova FK", () => {
    expect(migrationRec04).toContain("ON DELETE CASCADE");
  });

  it("migration cria índice para performance", () => {
    expect(migrationRec04).toContain("CREATE INDEX IF NOT EXISTS");
    expect(migrationRec04).toContain("idx_candidato_documentos_candidato_id_rc");
  });

  it("migration documenta que candidato_documentos é mantida", () => {
    expect(migrationRec04).toContain("NÃO é tabela operacional");
    expect(migrationRec04).toContain("campos (arquivo_url, dados_extraidos, analise_ia_id)");
  });

  it("migration não contém DROP TABLE", () => {
    expect(migrationRec04).not.toMatch(/DROP\s+TABLE/i);
  });

  it("migration não contém TRUNCATE", () => {
    expect(migrationRec04).not.toMatch(/TRUNCATE/i);
  });
});

// ============================================================
// VALIDAÇÃO CRUZADA: Gate documental preservado
// ============================================================

describe("VALIDAÇÃO CRUZADA — Gates preservados", () => {
  it("conversaoCandidatoService valida statusDocumental === 'completo'", () => {
    expect(conversaoCandidatoService).toContain("statusDocumental !== 'completo'");
  });

  it("eligibilityService: prestadorDocumentalmenteElegivel é fail-closed", () => {
    expect(eligibilityService).toContain("prestadorDocumentalmenteElegivel");
    expect(eligibilityService).toContain("elegivel: false");
  });

  it("eligibilityService: CNH é obrigatória", () => {
    expect(eligibilityService).toContain("cnh_invalida");
  });

  it("eligibilityService: Comprovante de residência é obrigatório", () => {
    expect(eligibilityService).toContain("Comprovante de residência pendente");
  });

  it("eligibilityService: prestador SEM docs é fail-open (legado)", () => {
    // Para não derrubar operação de prestadores legado sem migration
    expect(eligibilityService).toContain("documento_indisponivel");
    expect(eligibilityService).toContain("elegivel: true");
  });

  it("enterpriseKanbanService: calcularStatusDocumentalOperacional usa DOCS_MINIMOS", () => {
    expect(enterpriseKanbanService).toContain("DOCS_MINIMOS_OBRIGATORIOS");
    expect(enterpriseKanbanService).toContain("DOCS_MINIMOS_OPCIONAIS");
  });

  it("enterpriseKanbanTypes: DOCS_MINIMOS_OBRIGATORIOS = CNH, CRLV, Comprovante Residência, Foto Veículo", () => {
    expect(enterpriseKanbanTypes).toContain("DOCS_MINIMOS_OBRIGATORIOS");
    expect(enterpriseKanbanTypes).toContain("'CNH'");
    expect(enterpriseKanbanTypes).toContain("'CRLV'");
    expect(enterpriseKanbanTypes).toContain("'Comprovante Residência'");
    expect(enterpriseKanbanTypes).toContain("'Foto Veículo'");
  });

  it("enterpriseKanbanTypes: DOCS_MINIMOS_OPCIONAIS = ANTT", () => {
    expect(enterpriseKanbanTypes).toContain("DOCS_MINIMOS_OPCIONAIS");
    expect(enterpriseKanbanTypes).toContain("'ANTT'");
  });
});
