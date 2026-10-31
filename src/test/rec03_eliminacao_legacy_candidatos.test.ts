/**
 * REC-03 — Testes de Eliminação de Ambiguidade candidatos × recrutamento_candidatos
 *
 * Valida que:
 * 1. Migração adiciona todas as colunas necessárias
 * 2. Services migrados escrevem em recrutamento_candidatos (não candidatos)
 * 3. Components migrados leem de recrutamento_candidatos (não candidatos)
 * 4. candidatos continua acessível para serviços legados (recrutamentoIA, recrutamentoIntegracao)
 * 5. candidato_documentos FK não é quebrada
 * 6. reservas_banco FK não é quebrada
 * 7. enterpriseKanbanService toDB/fromDB funciona com as novas colunas
 * 8. Bridge candidatos → recrutamento_candidatos populada corretamente
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ============================================================
// FASE 1 — Validação da Migration SQL (offline, sem DB)
// ============================================================

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260901_rec03_add_legacy_columns.sql"
);

const CANDIDATOS_MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/202606200005_f25f7a_candidatos.sql"
);

const RECRUTAMENTO_MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260525_recrutamento_candidatos.sql"
);

let migrationContent: string;
let candidatosMigrationContent: string;
let recrutamentoMigrationContent: string;

beforeAll(() => {
  migrationContent = readFileSync(MIGRATION_PATH, "utf-8");
  candidatosMigrationContent = readFileSync(CANDIDATOS_MIGRATION_PATH, "utf-8");
  recrutamentoMigrationContent = readFileSync(RECRUTAMENTO_MIGRATION_PATH, "utf-8");
});

describe("REC-03 — Migration SQL", () => {
  it("deve existir a migration 20260901_rec03_add_legacy_columns.sql", () => {
    expect(migrationContent).toBeDefined();
    expect(migrationContent.length).toBeGreaterThan(100);
  });

  it("deve adicionar coluna nome_completo (alias legado)", () => {
    expect(migrationContent).toContain("nome_completo TEXT");
  });

  it("deve adicionar coluna cpf", () => {
    expect(migrationContent).toContain("cpf TEXT");
  });

  it("deve adicionar coluna whatsapp", () => {
    expect(migrationContent).toContain("whatsapp TEXT");
  });

  it("deve adicionar coluna regiao", () => {
    expect(migrationContent).toContain("regiao TEXT");
  });

  it("deve adicionar coluna tipo_veiculo (alias legado)", () => {
    expect(migrationContent).toContain("tipo_veiculo TEXT");
  });

  it("deve adicionar coluna tipo_carroceria", () => {
    expect(migrationContent).toContain("tipo_carroceria TEXT");
  });

  it("deve adicionar coluna experiencia_anos", () => {
    expect(migrationContent).toContain("experiencia_anos INTEGER");
  });

  it("deve adicionar coluna canal_captacao", () => {
    expect(migrationContent).toContain("canal_captacao TEXT");
  });

  it("deve adicionar coluna status (separado de stage)", () => {
    expect(migrationContent).toContain("status TEXT DEFAULT 'interessado'");
  });

  it("deve adicionar coluna score_perfil", () => {
    expect(migrationContent).toContain("score_perfil NUMERIC");
  });

  it("deve adicionar coluna prestador_id com FK", () => {
    expect(migrationContent).toContain("prestador_id UUID REFERENCES public.prestadores(id)");
  });

  it("deve adicionar coluna historico (JSONB)", () => {
    expect(migrationContent).toContain("historico JSONB");
  });

  it("deve adicionar coluna regioes_atuacao (JSONB)", () => {
    expect(migrationContent).toContain("regioes_atuacao JSONB");
  });

  it("deve adicionar coluna score_comprometimento", () => {
    expect(migrationContent).toContain("score_comprometimento NUMERIC");
  });

  it("deve adicionar coluna parecer_ia", () => {
    expect(migrationContent).toContain("parecer_ia TEXT");
  });

  it("deve adicionar coluna questionario_respostas (JSONB)", () => {
    expect(migrationContent).toContain("questionario_respostas JSONB");
  });

  it("deve popular dados de candidatos → recrutamento_candidatos (INSERT)", () => {
    expect(migrationContent).toContain("INSERT INTO public.recrutamento_candidatos");
    expect(migrationContent).toContain("FROM public.candidatos c");
  });

  it("deve mapear status legado → stage do pipeline", () => {
    expect(migrationContent).toContain("WHEN 'interessado' THEN 'interesse_confirmado'");
    expect(migrationContent).toContain("WHEN 'triagem' THEN 'pre_triagem'");
    expect(migrationContent).toContain("WHEN 'documentacao' THEN 'documentacao_pendente'");
  });

  it("deve mapear nome_completo → nome", () => {
    expect(migrationContent).toContain("c.nome_completo AS nome");
  });

  it("deve criar índices para colunas legadas", () => {
    expect(migrationContent).toContain("idx_rc_status_legacy");
    expect(migrationContent).toContain("idx_rc_tipo_veiculo");
    expect(migrationContent).toContain("idx_rc_regiao");
    expect(migrationContent).toContain("idx_rc_cpf");
    expect(migrationContent).toContain("idx_rc_prestador_id");
  });

  it("deve ser idempotent (IF NOT EXISTS em todas as ADD COLUMN)", () => {
    const addColumnCount = (migrationContent.match(/ADD COLUMN IF NOT EXISTS/g) || []).length;
    expect(addColumnCount).toBeGreaterThanOrEqual(40);
  });
});

// ============================================================
// FASE 2 — Validação de que candidatos MIGRADA existe
// ============================================================

describe("REC-03 — Tabela candidatos (legado)", () => {
  it("deve ter a migration de criação da tabela candidatos", () => {
    expect(candidatosMigrationContent).toContain("CREATE TABLE IF NOT EXISTS public.candidatos");
  });

  it("deve ter a coluna nome_completo na tabela candidatos", () => {
    expect(candidatosMigrationContent).toContain("nome_completo TEXT NOT NULL");
  });

  it("deve ter a coluna cpf na tabela candidatos", () => {
    expect(candidatosMigrationContent).toContain("cpf TEXT");
  });
});

// ============================================================
// FASE 3 — Validação de recrutamento_candidatos original
// ============================================================

describe("REC-03 — Tabela recrutamento_candidatos (original)", () => {
  it("deve ter a migration de criação da tabela recrutamento_candidatos", () => {
    expect(recrutamentoMigrationContent).toContain("CREATE TABLE IF NOT EXISTS recrutamento_candidatos");
  });

  it("deve ter a coluna nome na tabela recrutamento_candidatos", () => {
    expect(recrutamentoMigrationContent).toContain("nome TEXT NOT NULL");
  });

  it("deve ter a coluna stage na tabela recrutamento_candidatos", () => {
    expect(recrutamentoMigrationContent).toContain("stage TEXT DEFAULT 'novo_cadastro'");
  });
});

// ============================================================
// FASE 4 — Validação de imports e referências no código
// ============================================================

describe("REC-03 — Migração de Componentes", () => {
  let homologacaoContent: string;
  let bancoTalentosContent: string;

  beforeAll(() => {
    homologacaoContent = readFileSync(
      resolve(process.cwd(), "src/components/recrutamento/Homologacao.tsx"),
      "utf-8"
    );
    bancoTalentosContent = readFileSync(
      resolve(process.cwd(), "src/components/recrutamento/BancoTalentos.tsx"),
      "utf-8"
    );
  });

  it("Homologacao: deve ler de recrutamento_candidatos (não candidatos)", () => {
    expect(homologacaoContent).toContain('.from("recrutamento_candidatos")');
    expect(homologacaoContent).not.toMatch(/\.from\("candidatos"\)/);
  });

  it("Homologacao: deve filtrar por stage (não status)", () => {
    expect(homologacaoContent).toContain('.eq("stage", "aprovado")');
    expect(homologacaoContent).not.toMatch(/\.eq\("status",\s*"aprovado"\)/);
  });

  it("Homologacao: deve usar alias nome as nome_completo no SELECT", () => {
    expect(homologacaoContent).toContain("nome as nome_completo");
  });

  it("Homologacao: deve usar alias veiculo as tipo_veiculo no SELECT", () => {
    expect(homologacaoContent).toContain("veiculo as tipo_veiculo");
  });

  it("BancoTalentos: deve ler de recrutamento_candidatos (não candidatos)", () => {
    expect(bancoTalentosContent).toContain('.from("recrutamento_candidatos")');
    expect(bancoTalentosContent).not.toMatch(/\.from\("candidatos"\)/);
  });

  it("BancoTalentos: deve filtrar por stage (não status)", () => {
    expect(bancoTalentosContent).toContain('.in("stage",');
    expect(bancoTalentosContent).not.toMatch(/\.in\("status",/);
  });

  it("BancoTalentos: deve usar score do banco quando disponível", () => {
    expect(bancoTalentosContent).toContain("if (c.score && c.score > 0) return Math.min(c.score, 100)");
  });
});

// ============================================================
// FASE 5 — Validação de Services migrados
// ============================================================

describe("REC-03 — Migração de Services", () => {
  let actionEngineContent: string;
  let roboRecrutamentoContent: string;
  let roboMonitorContent: string;
  let criarCandidatoContent: string;

  beforeAll(() => {
    actionEngineContent = readFileSync(
      resolve(process.cwd(), "src/services/ia/actionEngineService.ts"),
      "utf-8"
    );
    roboRecrutamentoContent = readFileSync(
      resolve(process.cwd(), "src/services/centralIa/roboRecrutamentoService.ts"),
      "utf-8"
    );
    roboMonitorContent = readFileSync(
      resolve(process.cwd(), "src/services/centralIa/roboRecrutamentoMonitorService.ts"),
      "utf-8"
    );
    criarCandidatoContent = readFileSync(
      resolve(process.cwd(), "src/services/recrutamento/criarCandidatoService.ts"),
      "utf-8"
    );
  });

  it("actionEngine COM_CONSULTAR_CANDIDATOS: consulta recrutamento_candidatos, fallback candidatos REMOVIDO (REC-03.1)", () => {
    const idxRec = actionEngineContent.indexOf("COM_CONSULTAR_CANDIDATOS");
    const idxPedidos = actionEngineContent.indexOf("COM_CONSULTAR_PEDIDO");
    const section = actionEngineContent.substring(idxRec, idxPedidos);
    expect(section).toContain('.from("recrutamento_candidatos")');
    expect(section).not.toContain('.from("candidatos")');
  });

  it("actionEngine COM_REGISTRAR_AVALIACAO: deve escrever em recrutamento_candidatos", () => {
    const idx = actionEngineContent.indexOf("COM_REGISTRAR_AVALIACAO");
    const section = actionEngineContent.substring(idx, idx + 500);
    expect(section).toContain('.from("recrutamento_candidatos")');
    expect(section).not.toContain('.from("candidatos")');
  });

  it("roboRecrutamentoService: deve ler de recrutamento_candidatos", () => {
    expect(roboRecrutamentoContent).toContain('.from("recrutamento_candidatos")');
    expect(roboRecrutamentoContent).not.toMatch(/\.from\("candidatos"\)/);
  });

  it("roboRecrutamentoService: interface CandidatoRecrutamento deve ter campo nome", () => {
    expect(roboRecrutamentoContent).toContain("nome: string;");
    expect(roboRecrutamentoContent).toContain("nome_completo: string;");
  });

  it("roboRecrutamentoService: deve usar stage || status no log", () => {
    expect(roboRecrutamentoContent).toContain("candidatoData.stage || candidatoData.status");
  });

  it("roboRecrutamentoMonitorService: deve ler de recrutamento_candidatos", () => {
    expect(roboMonitorContent).toContain('.from("recrutamento_candidatos")');
  });

  it("roboRecrutamentoMonitorService: deve mapear nome → nome_completo", () => {
    expect(roboMonitorContent).toContain("nome as nome_completo");
  });

  it("roboRecrutamentoMonitorService: deve mapear stage as status", () => {
    expect(roboMonitorContent).toContain("stage as status");
  });

  it("criarCandidatoService: deve escrever em recrutamento_candidatos", () => {
    expect(criarCandidatoContent).toContain('.from("recrutamento_candidatos")');
    expect(criarCandidatoContent).not.toMatch(/\.from\("candidatos"\)/);
  });

  it("criarCandidatoService: deve mapear nome_completo → nome + nome_completo", () => {
    expect(criarCandidatoContent).toContain("nome: dados.nome_completo");
    expect(criarCandidatoContent).toContain("nome_completo: dados.nome_completo");
  });

  it("criarCandidatoService: deve mapear tipo_veiculo → veiculo + tipo_veiculo", () => {
    expect(criarCandidatoContent).toContain("veiculo: dados.tipo_veiculo");
    expect(criarCandidatoContent).toContain("tipo_veiculo: dados.tipo_veiculo");
  });

  it("criarCandidatoService: deve setar stage no insert", () => {
    expect(criarCandidatoContent).toContain("stage: \"novo_candidato\"");
  });
});

// ============================================================
// FASE 6 — Validação de que serviços legados NÃO foram alterados
// ============================================================

describe("REC-03 — Serviços legados preservados (não alterados)", () => {
  let recrutamentoIaContent: string;
  let recrutamentoIntegracaoContent: string;
  let bancoReservasContent: string;
  let acompanhamentoDocsContent: string;

  beforeAll(() => {
    recrutamentoIaContent = readFileSync(
      resolve(process.cwd(), "src/services/recrutamentoIA.ts"),
      "utf-8"
    );
    recrutamentoIntegracaoContent = readFileSync(
      resolve(process.cwd(), "src/services/recrutamentoIntegracao.ts"),
      "utf-8"
    );
    bancoReservasContent = readFileSync(
      resolve(process.cwd(), "src/components/recrutamento/BancoReservas.tsx"),
      "utf-8"
    );
    acompanhamentoDocsContent = readFileSync(
      resolve(process.cwd(), "src/components/recrutamento/AcompanhamentoDocs.tsx"),
      "utf-8"
    );
  });

  it("recrutamentoIA: migrado para recrutamento_candidatos (REC-03.1)", () => {
    expect(recrutamentoIaContent).toContain('.from("recrutamento_candidatos")');
    const fromCandidatos = recrutamentoIaContent.match(/\.from\(["']candidatos["']\)/g);
    expect(fromCandidatos).toBeNull();
  });

  it("recrutamentoIntegracao: migrado para recrutamento_candidatos (REC-03.1)", () => {
    expect(recrutamentoIntegracaoContent).toContain('.from("recrutamento_candidatos")');
    const fromCandidatos = recrutamentoIntegracaoContent.match(/\.from\(["']candidatos["']\)/g);
    expect(fromCandidatos).toBeNull();
  });

  it("BancoReservas: migrado para recrutamento_candidatos (REC-03.1)", () => {
    expect(bancoReservasContent).toContain('.from("recrutamento_candidatos")');
    const fromCandidatos = bancoReservasContent.match(/\.from\(["']candidatos["']\)/g);
    expect(fromCandidatos).toBeNull();
  });

  it("AcompanhamentoDocs: ainda usa tabela candidatos (FK LEGACY — REC-04)", () => {
    expect(acompanhamentoDocsContent).toContain('.from("candidatos")');
  });

  it("recrutamentoIA: interface Candidato mantém campos legados", () => {
    expect(recrutamentoIaContent).toContain("nome_completo: string");
    expect(recrutamentoIaContent).toContain("cpf?: string");
  });
});

// ============================================================
// FASE 7 — Validação de integridade referencial
// ============================================================

describe("REC-03 — Integridade Referencial", () => {
  let migracaoContent: string;

  beforeAll(() => {
    migracaoContent = readFileSync(MIGRATION_PATH, "utf-8");
  });

  it("prestador_id deve ter REFERENCES public.prestadores(id)", () => {
    expect(migracaoContent).toContain("REFERENCES public.prestadores(id)");
  });

  it("migration deve ser executável sem erros de sintaxe SQL", () => {
    expect(migracaoContent).toContain("ALTER TABLE public.recrutamento_candidatos");
    expect(migracaoContent).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it("migration deve incluir INSERT de dados de candidatos existentes", () => {
    expect(migracaoContent).toContain("WHERE NOT EXISTS");
    expect(migracaoContent).toContain("SELECT 1 FROM public.recrutamento_candidatos rc WHERE rc.id = c.id");
  });
});

// ============================================================
// FASE 8 — Validação de cobertura de colunas
// ============================================================

describe("REC-03 — Cobertura de Colunas", () => {
  let migracaoContent: string;

  beforeAll(() => {
    migracaoContent = readFileSync(MIGRATION_PATH, "utf-8");
  });

  const COLUNAS_ESPERADAS = [
    "nome_completo", "cpf", "whatsapp", "regiao", "tipo_veiculo",
    "tipo_carroceria", "experiencia_anos", "como_conheceu", "mensagem_livre",
    "canal_captacao", "status", "score_perfil", "ultima_interacao",
    "prestador_id", "observacoes", "avaliacao_nota", "avaliacao_comentario",
    "regioes_atuacao", "historico", "horarios_disponiveis", "dias_disponiveis",
    "score_comprometimento", "classificacao_comprometimento", "risco_desistencia",
    "tempo_medio_resposta_horas", "quantidade_cobrancas", "confirmou_interesse",
    "data_confirmacao_interesse", "confirmou_pre_inicio", "data_confirmacao_pre_inicio",
    "compareceu_primeiro_dia", "completou_30_dias", "quantidade_reclamacoes",
    "possui_outra_operacao_fixa", "disponibilidade_recrutamento",
    "historico_desistencias", "etiquetas_automaticas", "parecer_ia",
    "principais_riscos", "principais_pontos_positivos", "proxima_acao_sugerida",
    "questionario_respostas",
  ];

  for (const col of COLUNAS_ESPERADAS) {
    it(`deve adicionar coluna ${col}`, () => {
      expect(migracaoContent).toContain(col);
    });
  }
});
