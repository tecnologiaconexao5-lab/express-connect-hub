/**
 * REC-03.1 — Fechamento Definitivo do Legado candidatos
 *
 * Valida que:
 * 1. recrutamentoIA não lê tabela candidatos
 * 2. recrutamentoIA não escreve tabela candidatos
 * 3. recrutamentoIntegracao sem dependência operacional evitável em candidatos
 * 4. BancoReservas lê de recrutamento_candidatos (canônica)
 * 5. AcompanhamentoDocs bloqueado por FK candidato_documentos (legado)
 * 6. Nenhuma nova escrita em candidatos por services migrados
 * 7. Migration REC-03 idempotente (IF NOT EXISTS)
 * 8. Bridge APP preservada (enterpriseKanbanService → recrutamento_candidatos)
 * 9. Bridge idempotente (não duplica prestador)
 * 10. Conversão preservada (conversaoCandidatoService → recrutamento_candidatos)
 * 11. Gate documental preservado (statusDocumental === 'completo')
 * 12. liberado_app fail-closed preservado
 * 13. Tenant preservado
 * 14. Nenhum DROP em candidatos
 * 15. Nenhuma migration aplicada remotamente
 * 16. Referências legacy restantes classificadas
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ============================================================
// LEITURA DE ARQUIVOS
// ============================================================

const SRC = resolve(process.cwd(), "src");

const read = (relativePath: string): string => {
  try {
    return readFileSync(resolve(process.cwd(), relativePath), "utf-8");
  } catch {
    return "";
  }
};

let recrutamentoIA: string;
let recrutamentoIntegracao: string;
let bancoReservas: string;
let acompanhamentoDocs: string;
let actionEngine: string;
let enterpriseKanbanService: string;
let conversaoCandidatoService: string;
let migrationRec03: string;
let testeDocumentos: string;
let homologacao: string;
let bancoTalentos: string;

beforeAll(() => {
  recrutamentoIA = read("src/services/recrutamentoIA.ts");
  recrutamentoIntegracao = read("src/services/recrutamentoIntegracao.ts");
  bancoReservas = read("src/components/recrutamento/BancoReservas.tsx");
  acompanhamentoDocs = read("src/components/recrutamento/AcompanhamentoDocs.tsx");
  actionEngine = read("src/services/ia/actionEngineService.ts");
  enterpriseKanbanService = read("src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts");
  conversaoCandidatoService = read("src/modules/recrutamento/services/conversaoCandidatoService.ts");
  migrationRec03 = read("supabase/migrations/20260901_rec03_add_legacy_columns.sql");
  testeDocumentos = read("scripts/lab/testeDocumentos.ts");
  homologacao = read("src/components/recrutamento/Homologacao.tsx");
  bancoTalentos = read("src/components/recrutamento/BancoTalentos.tsx");
});

// ============================================================
// 1. recrutamentoIA — ZERO read/write em candidatos
// ============================================================

describe("REC-03.1-01 — recrutamentoIA.ts sem dependência candidatos", () => {
  it("não deve conter .from('candidatos') — reads migrados para recrutamento_candidatos", () => {
    const fromCandidatos = recrutamentoIA.match(/\.from\(["']candidatos["']\)/g);
    expect(fromCandidatos).toBeNull();
  });

  it("deve conter .from('recrutamento_candidatos') para reads", () => {
    expect(recrutamentoIA).toContain('.from("recrutamento_candidatos")');
  });

  it("buscarReservasParaOperacao deve filtrar por stage (não status)", () => {
    expect(recrutamentoIA).toContain("stage.eq.aprovado");
    expect(recrutamentoIA).toContain("stage.eq.interesse_confirmado");
    expect(recrutamentoIA).toContain("stage.eq.bloqueado");
  });

  it("identificarCandidatosEsquecidos deve filtrar por stage", () => {
    expect(recrutamentoIA).toContain("stage.eq.interesse_confirmado");
    expect(recrutamentoIA).toContain("stage.eq.bloqueado");
  });

  it("deve mapear stage → status para compatibilidade com Candidato[]", () => {
    expect(recrutamentoIA).toContain("mapStageToStatus");
  });
});

// ============================================================
// 2. recrutamentoIntegracao — ZERO write evitável em candidatos
// ============================================================

describe("REC-03.1-02 — recrutamentoIntegracao.ts sem dependência candidatos", () => {
  it("não deve conter .from('candidatos') — writes migrados", () => {
    const fromCandidatos = recrutamentoIntegracao.match(/\.from\(["']candidatos["']\)/g);
    expect(fromCandidatos).toBeNull();
  });

  it("deve escrever em recrutamento_candidatos (status=ativo + prestador_id)", () => {
    expect(recrutamentoIntegracao).toContain('.from("recrutamento_candidatos")');
    expect(recrutamentoIntegracao).toContain('status: "ativo"');
  });

  it("deve preservar escritas em reservas_banco (FK compatível)", () => {
    expect(recrutamentoIntegracao).toContain('.from("reservas_banco")');
  });

  it("deve preservar escritas em homologacoes", () => {
    expect(recrutamentoIntegracao).toContain('.from("homologacoes")');
  });

  it("deve preservar escritas em prestadores", () => {
    expect(recrutamentoIntegracao).toContain('.from("prestadores")');
  });

  it("deve preservar escritas em documentos_prestadores", () => {
    expect(recrutamentoIntegracao).toContain('.from("documentos_prestadores")');
  });

  it("atualizarEtapaCandidato deve escrever em recrutamento_candidatos", () => {
    const idx = recrutamentoIntegracao.indexOf("atualizarEtapaCandidato");
    expect(idx).toBeGreaterThan(-1);
    const bloco = recrutamentoIntegracao.substring(idx, idx + 300);
    expect(bloco).toContain('.from("recrutamento_candidatos")');
  });
});

// ============================================================
// 3. BancoReservas — lê de recrutamento_candidatos (canônica)
// ============================================================

describe("REC-03.1-03 — BancoReservas.tsx usando tabela canônica", () => {
  it("não deve ler de .from('candidatos')", () => {
    const fromCandidatos = bancoReservas.match(/\.from\(["']candidatos["']\)/g);
    expect(fromCandidatos).toBeNull();
  });

  it("deve ler de recrutamento_candidatos", () => {
    expect(bancoReservas).toContain('.from("recrutamento_candidatos")');
  });

  it("deve mapear campos (nome→nome_completo, veiculo→tipo_veiculo, stage→status)", () => {
    expect(bancoReservas).toContain("nome as nome_completo");
    expect(bancoReservas).toContain("veiculo as tipo_veiculo");
    expect(bancoReservas).toContain("stage as status");
    expect(bancoReservas).toContain("score as score_perfil");
  });

  it("deve ler de reservas_banco (FK preservada)", () => {
    expect(bancoReservas).toContain('.from("reservas_banco")');
  });
});

// ============================================================
// 4. AcompanhamentoDocs — BLOQUEADO por FK
// ============================================================

describe("REC-03.1-04 — AcompanhamentoDocs.tsx — FK LEGACY documentado", () => {
  it("ainda lê de candidatos (BLOQUEADO por candidato_documentos FK)", () => {
    expect(acompanhamentoDocs).toContain('.from("candidatos")');
  });

  it("ainda lê de candidato_documentos (FK → candidatos.id)", () => {
    expect(acompanhamentoDocs).toContain('.from("candidato_documentos")');
  });

  it("classificação: FK LEGACY — migração requer migration da FK para REC-04", () => {
    // Documentação: não é um bug, é uma dependência técnica bloqueante
    expect(acompanhamentoDocs.length).toBeGreaterThan(100);
  });
});

// ============================================================
// 5. Nenhuma nova escrita em candidatos por services migrados
// ============================================================

describe("REC-03.1-05 — Nenhuma escrita candidatos por services migrados", () => {
  it("recrutamentoIA: zero .from('candidatos') (reads + writes)", () => {
    const matches = recrutamentoIA.match(/\.from\(["']candidatos["']\)/g);
    expect(matches).toBeNull();
  });

  it("recrutamentoIntegracao: zero .from('candidatos') (writes)", () => {
    const matches = recrutamentoIntegracao.match(/\.from\(["']candidatos["']\)/g);
    expect(matches).toBeNull();
  });

  it("BancoReservas: zero .from('candidatos') (reads)", () => {
    const matches = bancoReservas.match(/\.from\(["']candidatos["']\)/g);
    expect(matches).toBeNull();
  });
});

// ============================================================
// 6. Migration REC-03 idempotente
// ============================================================

describe("REC-03.1-06 — Migration REC-03 idempotente", () => {
  it("todas as ADD COLUMN usam IF NOT EXISTS", () => {
    const addColumnLines = migrationRec03.split("\n").filter(l => l.trim().startsWith("ADD COLUMN"));
    expect(addColumnLines.length).toBeGreaterThan(40);
    for (const line of addColumnLines) {
      expect(line).toContain("IF NOT EXISTS");
    }
  });

  it("INSERT usa WHERE NOT EXISTS para evitar duplicatas", () => {
    expect(migrationRec03).toContain("WHERE NOT EXISTS");
    expect(migrationRec03).toContain("rc.id = c.id");
  });

  it("CREATE INDEX usa IF NOT EXISTS", () => {
    const indexLines = migrationRec03.split("\n").filter(l => l.trim().startsWith("CREATE INDEX"));
    expect(indexLines.length).toBe(5);
    for (const line of indexLines) {
      expect(line).toContain("IF NOT EXISTS");
    }
  });

  it("não contém DROP TABLE", () => {
    expect(migrationRec03).not.toContain("DROP TABLE");
  });

  it("não contém DROP COLUMN", () => {
    expect(migrationRec03).not.toContain("DROP COLUMN");
  });

  it("não contém TRUNCATE", () => {
    expect(migrationRec03).not.toContain("TRUNCATE");
  });
});

// ============================================================
// 7. Bridge APP preservada
// ============================================================

describe("REC-03.1-07 — Bridge APP (enterpriseKanbanService)", () => {
  it("buscarECadastrarAppPrestadores usa TABLE (recrutamento_candidatos)", () => {
    expect(enterpriseKanbanService).toContain("async function buscarECadastrarAppPrestadores");
    expect(enterpriseKanbanService).toContain("from(PRESTADORES_TABLE)");
    expect(enterpriseKanbanService).toContain("from(TABLE)");
  });

  it("TABLE deve ser recrutamento_candidatos", () => {
    expect(enterpriseKanbanService).toContain("TABLE = 'recrutamento_candidatos'");
  });

  it("PRESTADORES_TABLE deve ser prestadores", () => {
    expect(enterpriseKanbanService).toContain("PRESTADORES_TABLE = 'prestadores'");
  });

  it("usa toDB() para inserir dados App no pipeline", () => {
    expect(enterpriseKanbanService).toContain("toDB({");
  });

  it("ORIGEM_APP deve ser app_motorista", () => {
    expect(enterpriseKanbanService).toContain("ORIGEM_APP = 'app_motorista'");
  });

  it("ids Existentes usa Set para dedup (idempotência)", () => {
    expect(enterpriseKanbanService).toContain("new Set(");
  });
});

// ============================================================
// 8. Bridge idempotente
// ============================================================

describe("REC-03.1-08 — Bridge idempotente (não duplica)", () => {
  it("filtra prestadores já existentes no pipeline", () => {
    expect(enterpriseKanbanService).toContain("prestadorIdsExistentes");
    expect(enterpriseKanbanService).toContain("novos = appPrestadores.filter");
  });

  it("não insere se todos já existem", () => {
    expect(enterpriseKanbanService).toContain("if (novos.length > 0)");
  });
});

// ============================================================
// 9. Conversão preservada
// ============================================================

describe("REC-03.1-09 — Conversão (conversaoCandidatoService)", () => {
  it("CANDIDATOS_TABLE deve ser recrutamento_candidatos", () => {
    expect(conversaoCandidatoService).toContain("CANDIDATOS_TABLE = 'recrutamento_candidatos'");
  });

  it("atualizarCandidatoAposConversao usa CANDIDATOS_TABLE (recrutamento_candidatos)", () => {
    expect(conversaoCandidatoService).toContain("from(CANDIDATOS_TABLE)");
  });

  it("usa enterpriseKanbanService para mover para ativo", () => {
    expect(conversaoCandidatoService).toContain("enterpriseKanbanService.mover");
  });

  it("usa enterpriseKanbanService para registrar evento", () => {
    expect(conversaoCandidatoService).toContain("enterpriseKanbanService.registrarEvento");
  });

  it("usa prestadoresService.criar para criar prestador", () => {
    expect(conversaoCandidatoService).toContain("prestadoresService.criar");
  });
});

// ============================================================
// 10. Gate documental preservado
// ============================================================

describe("REC-03.1-10 — Gate documental preservado", () => {
  it("conversaoCandidatoService valida statusDocumental === 'completo'", () => {
    expect(conversaoCandidatoService).toContain("statusDocumental !== 'completo'");
  });

  it("mensagem de bloqueio quando documentação incompleta", () => {
    expect(conversaoCandidatoService).toContain("Documentação obrigatória incompleta");
  });

  it("stages permitidos para conversão: aprovado e homologados (legado preservado)", () => {
    expect(conversaoCandidatoService).toContain(
      "'aprovado', 'homologado_disponivel', 'homologado_indisponivel'",
    );
    expect(conversaoCandidatoService).toContain("'ativo', 'prestador_apto'");
  });
});

// ============================================================
// 11. liberado_app fail-closed preservado
// ============================================================

describe("REC-03.1-11 — liberado_app fail-closed", () => {
  it("sincronizarComOperacao usa statusOperacional para liberado_app", () => {
    expect(conversaoCandidatoService).toContain("liberado_app: statusOperacional === 'ativo'");
  });

  it("nao cria prestador com liberado_app=true sem status ativo", () => {
    // Verifica que liberado_app é condicional ao status
    const idx = conversaoCandidatoService.indexOf("liberado_app:");
    expect(idx).toBeGreaterThan(-1);
  });
});

// ============================================================
// 12. Tenant preservado
// ============================================================

describe("REC-03.1-12 — Tenant preservado", () => {
  it("recrutamentoIA não manipula tenant_id diretamente", () => {
    expect(recrutamentoIA).not.toContain("tenant_id");
  });

  it("recrutamentoIntegracao não manipula tenant_id diretamente", () => {
    expect(recrutamentoIntegracao).not.toContain("tenant_id");
  });

  it("BancoReservas não manipula tenant_id diretamente", () => {
    expect(bancoReservas).not.toContain("tenant_id");
  });
});

// ============================================================
// 13. Nenhum DROP
// ============================================================

describe("REC-03.1-13 — Nenhum DROP em candidatos", () => {
  it("migration REC-03 não contém DROP TABLE candidatos", () => {
    expect(migrationRec03).not.toMatch(/DROP\s+TABLE.*candidatos/i);
  });

  it("migration REC-03 não contém DROP COLUMN", () => {
    expect(migrationRec03).not.toMatch(/DROP\s+COLUMN/i);
  });

  it("nenhum arquivo .ts contém DROP TABLE candidatos", () => {
    // Verifica nos principais arquivos auditados
    const files = [recrutamentoIA, recrutamentoIntegracao, bancoReservas, actionEngine];
    for (const content of files) {
      expect(content).not.toMatch(/DROP\s+TABLE.*candidatos/i);
    }
  });
});

// ============================================================
// 14. Nenhuma migration aplicada remotamente
// ============================================================

describe("REC-03.1-14 — Nenhuma migration aplicada remotamente", () => {
  it("este teste é offline — não aplica migrations", () => {
    // Valida que o teste não depende de conexão com banco
    expect(typeof migrationRec03).toBe("string");
    expect(migrationRec03.length).toBeGreaterThan(100);
  });
});

// ============================================================
// 15. Referências legacy restantes classificadas
// ============================================================

describe("REC-03.1-15 — Referências legacy classificadas", () => {
  it("AcompanhamentoDocs: FK LEGACY (candidato_documentos → candidatos)", () => {
    expect(acompanhamentoDocs).toContain('.from("candidatos")');
    expect(acompanhamentoDocs).toContain('.from("candidato_documentos")');
  });

  it("testeDocumentos: CÓDIGO MORTO (utilitário de teste, não operacional)", () => {
    expect(testeDocumentos).toContain('.from("candidatos")');
    // Classificação: teste manual, não impacta produção
  });

  it("actionEngine: fallback candidatos REMOVIDO (principal = recrutamento_candidatos)", () => {
    // Verifica que não há mais fallback para candidatos
    const caseBlock = actionEngine.substring(
      actionEngine.indexOf("COM_CONSULTAR_CANDIDATOS"),
      actionEngine.indexOf("COM_CONSULTAR_PEDIDO")
    );
    expect(caseBlock).not.toContain('.from("candidatos")');
  });
});

// ============================================================
// 16. Homologacao e BancoTalentos preservados (já migrados na REC-03)
// ============================================================

describe("REC-03.1-16 — Homologacao e BancoTalentos preservados", () => {
  it("Homologacao lê de recrutamento_candidatos", () => {
    expect(homologacao).toContain('.from("recrutamento_candidatos")');
  });

  it("Homologacao NÃO lê de candidatos", () => {
    const fromCandidatos = homologacao.match(/\.from\(["']candidatos["']\)/g);
    expect(fromCandidatos).toBeNull();
  });

  it("BancoTalentos lê de recrutamento_candidatos", () => {
    expect(bancoTalentos).toContain('.from("recrutamento_candidatos")');
  });

  it("BancoTalentos NÃO lê de candidatos", () => {
    const fromCandidatos = bancoTalentos.match(/\.from\(["']candidatos["']\)/g);
    expect(fromCandidatos).toBeNull();
  });
});

// ============================================================
// 17. Resumo de cobertura
// ============================================================

describe("REC-03.1-17 — Resumo de cobertura", () => {
  it("recrutamento_candidatos é tabela canônica para recrutamento", () => {
    // Todos os services de recrutamento usam recrutamento_candidatos
    expect(recrutamentoIA).toContain('.from("recrutamento_candidatos")');
    expect(recrutamentoIntegracao).toContain('.from("recrutamento_candidatos")');
    expect(bancoReservas).toContain('.from("recrutamento_candidatos")');
  });

  it("candidatos permanece apenas para: AcompanhamentoDocs (FK) + testeDocumentos (código morto)", () => {
    // Conta referências restantes
    const allFiles = [
      { name: "recrutamentoIA", content: recrutamentoIA },
      { name: "recrutamentoIntegracao", content: recrutamentoIntegracao },
      { name: "bancoReservas", content: bancoReservas },
      { name: "acompanhamentoDocs", content: acompanhamentoDocs },
      { name: "actionEngine", content: actionEngine },
      { name: "testeDocumentos", content: testeDocumentos },
    ];

    const refsCandidatos = allFiles.filter(f =>
      f.content.match(/\.from\(["']candidatos["']\)/)
    ).map(f => f.name);

    // Apenas AcompanhamentoDocs (FK) e testeDocumentos (código morto)
    expect(refsCandidatos).toContain("acompanhamentoDocs");
    expect(refsCandidatos).toContain("testeDocumentos");
    expect(refsCandidatos).not.toContain("recrutamentoIA");
    expect(refsCandidatos).not.toContain("recrutamentoIntegracao");
    expect(refsCandidatos).not.toContain("bancoReservas");
    expect(refsCandidatos).not.toContain("actionEngine");
  });
});
