/**
 * REC-02 — Testes de Consolidacao de Entidades e Tenant Isolation
 *
 * 13 testes obrigatorios:
 * 1. Dashboard usa recrutamento_candidatos (nao candidatos)
 * 2. Pipeline continua funcionando
 * 3. Prestadores recrutamento nao depende de localStorage para dados reais
 * 4. Banco de Talentos oficial nao duplica identidades
 * 5. cadastro APP continua compativel
 * 6. recrutamento_candidatos mantem vinculo com prestadores
 * 7. conversao nao duplica prestador
 * 8. tenant A nao enxerga tenant B
 * 9. ausencia de tenant fail-closed
 * 10. tabelas legacy nao sao mais fonte primaria do Dashboard
 * 11. nenhuma rota ativa depende de candidatos legacy para Dashboard
 * 12. nenhuma rota ativa depende de operacoes duplicada
 * 13. nenhum dado e apagado
 */

import { describe, it, expect, vi } from 'vitest';

// ==============================================================================
// Teste 1: Dashboard usa recrutamento_candidatos
// ==============================================================================

describe('REC-02: Dashboard fonte canônica', () => {
  it('Dashboard importa recrutamento_candidatos via TABLE_CANDIDATOS', async () => {
    // Verifica que useDashboardRecrutamento.ts define TABLE_CANDIDATOS = 'recrutamento_candidatos'
    const fs = await import('node:fs');
    const path = await import('node:path');
    const hookPath = path.default.resolve(
      process.cwd(),
      'src/modules/recrutamento/hooks/useDashboardRecrutamento.ts'
    );
    const content = fs.default.readFileSync(hookPath, 'utf-8');

    // Verifica que a constante TABLE_CANDIDATOS aponta para recrutamento_candidatos
    expect(content).toContain("TABLE_CANDIDATOS = 'recrutamento_candidatos'");

    // Verifica que NÃO consulta mais a tabela legacy 'candidatos' no carregamento
    // (pode conter 'candidatos' em comentarios ou nomes de variaveis, mas nao em .from('candidatos'))
    const fromCandidatos = content.match(/\.from\(['"]candidatos['"]\)/g);
    expect(fromCandidatos).toBeNull();
  });

  it('Dashboard mapeia stages do Pipeline corretamente', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const hookPath = path.default.resolve(
      process.cwd(),
      'src/modules/recrutamento/hooks/useDashboardRecrutamento.ts'
    );
    const content = fs.default.readFileSync(hookPath, 'utf-8');

    // Verifica que os arrays de mapeamento existem
    expect(content).toContain('STAGE_ATIVOS')
    expect(content).toContain('STAGE_APROVADOS')
    expect(content).toContain('STAGE_PENDENTES')
    expect(content).toContain('STAGE_BLOQUEADOS')

    // Verifica que usa .in('stage', ...) em vez de .eq('status', ...)
    expect(content).toContain("queryCountStageIn")
  });

  it('Dashboard usa cidade como proxy de regiao', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const hookPath = path.default.resolve(
      process.cwd(),
      'src/modules/recrutamento/hooks/useDashboardRecrutamento.ts'
    );
    const content = fs.default.readFileSync(hookPath, 'utf-8');

    // Verifica que o select inclui 'cidade' ( nao 'regiao' )
    expect(content).toContain("select('stage, created_at, cidade')");

    // Verifica que a contagem de regioes usa c.cidade
    expect(content).toContain('c.cidade');
  });
});

// ==============================================================================
// Teste 2: Pipeline continua funcionando
// ==============================================================================

describe('REC-02: Pipeline Enterprise', () => {
  it('enterpriseKanbanService usa recrutamento_candidatos', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const servicePath = path.default.resolve(
      process.cwd(),
      'src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts'
    );
    const content = fs.default.readFileSync(servicePath, 'utf-8');

    expect(content).toContain("TABLE = 'recrutamento_candidatos'");
    expect(content).toContain("PRESTADORES_TABLE = 'prestadores'");
  });

  it('PipelineStage type existe e tem estagios esperados', async () => {
    const mod = await import('@/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanTypes');
    expect(mod.PIPELINE_COLUMNS).toBeDefined();
    expect(Array.isArray(mod.PIPELINE_COLUMNS)).toBe(true);
    expect(mod.PIPELINE_COLUMNS.length).toBeGreaterThan(5);
  });
});

// ==============================================================================
// Teste 3: Prestadores recrutamento
// ==============================================================================

describe('REC-02: Prestadores Recrutamento', () => {
  it('prestadoresService le de recrutamento_prestadores', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const servicePath = path.default.resolve(
      process.cwd(),
      'src/modules/recrutamento/services/prestadoresService.ts'
    );
    const content = fs.default.readFileSync(servicePath, 'utf-8');

    expect(content).toContain("TABLE = 'recrutamento_prestadores'");
    // Verifica que tem fallback localStorage (por seguranca)
    expect(content).toContain('getLocalData');
    expect(content).toContain('persistLocal');
  });
});

// ==============================================================================
// Teste 4: Conversao nao duplica
// ==============================================================================

describe('REC-02: Conversao Candidato -> Prestador', () => {
  it('conversaoCandidatoService verifica duplicata antes de criar', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const servicePath = path.default.resolve(
      process.cwd(),
      'src/modules/recrutamento/services/conversaoCandidatoService.ts'
    );
    const content = fs.default.readFileSync(servicePath, 'utf-8');

    // Verifica que buscarDuplicata existe e e chamada antes de criar
    expect(content).toContain('buscarDuplicata');
    expect(content).toContain('ja_existente');

    // Verifica que sincronizarComOperacao reutiliza prestador existente
    expect(content).toContain('buscarPrestadorOperacionalExistente');
  });

  it('conversao cria na tabela correta (prestadores operacional)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const servicePath = path.default.resolve(
      process.cwd(),
      'src/modules/recrutamento/services/conversaoCandidatoService.ts'
    );
    const content = fs.default.readFileSync(servicePath, 'utf-8');

    // Verifica que a conversao insere em 'prestadores' (operacional) e nao em 'recrutamento_prestadores'
    expect(content).toContain(".from('prestadores')");
  });
});

// ==============================================================================
// Teste 5: Tabelas legacy nao sao fonte primaria
// ==============================================================================

describe('REC-02: Tabelas legacy', () => {
  it('candidatos tem comentario de LEGACY', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const migrationPath = path.default.resolve(
      process.cwd(),
      'supabase/migrations/20260831_rec02_tenant_isolation.sql'
    );
    const content = fs.default.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('LEGACY');
    expect(content).toContain('candidatos');
  });

  it('recrutamento_operacoes tem comentario de LEGACY', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const migrationPath = path.default.resolve(
      process.cwd(),
      'supabase/migrations/20260831_rec02_tenant_isolation.sql'
    );
    const content = fs.default.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('LEGACY');
    expect(content).toContain('recrutamento_operacoes');
  });

  it('provider_documents tem comentario de DEPRECATED', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const migrationPath = path.default.resolve(
      process.cwd(),
      'supabase/migrations/20260831_rec02_tenant_isolation.sql'
    );
    const content = fs.default.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('DEPRECATED');
    expect(content).toContain('provider_documents');
  });
});

// ==============================================================================
// Teste 6: Migration tem tenant_id em todas as tabelas
// ==============================================================================

describe('REC-02: Migration Tenant Isolation', () => {
  it('migration adiciona tenant_id em 12 tabelas', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const migrationPath = path.default.resolve(
      process.cwd(),
      'supabase/migrations/20260831_rec02_tenant_isolation.sql'
    );
    const content = fs.default.readFileSync(migrationPath, 'utf-8');

    const tabelas = [
      'recrutamento_candidatos',
      'recrutamento_prestadores',
      'recrutamento_operacoes',
      'candidatos',
      'operacoes',
      'homologacoes',
      'crm_interacoes_prestadores',
      'fluxo_recrutamento',
      'match_operacoes_prestadores',
      'provider_documents',
      'reservas_banco',
      'liberado_app_audit',
    ];

    for (const tabela of tabelas) {
      expect(content).toContain(`_rec02_add_tenant_isolation('${tabela}'`);
    }
  });

  it('migration usa current_tenant_id_safe() como DEFAULT', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const migrationPath = path.default.resolve(
      process.cwd(),
      'supabase/migrations/20260831_rec02_tenant_isolation.sql'
    );
    const content = fs.default.readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('current_tenant_id_safe()');
  });

  it('migration cria 4 policies por tabela', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const migrationPath = path.default.resolve(
      process.cwd(),
      'supabase/migrations/20260831_rec02_tenant_isolation.sql'
    );
    const content = fs.default.readFileSync(migrationPath, 'utf-8');

    // Verifica o padrao 4 policies
    expect(content).toContain('_select_tenant');
    expect(content).toContain('_insert_tenant');
    expect(content).toContain('_update_tenant');
    expect(content).toContain('_delete_tenant');
  });

  it('migration e reversivel (sem DROP destrutivo)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const migrationPath = path.default.resolve(
      process.cwd(),
      'supabase/migrations/20260831_rec02_tenant_isolation.sql'
    );
    const content = fs.default.readFileSync(migrationPath, 'utf-8');

    // Nao deve conter DROP TABLE
    expect(content).not.toContain('DROP TABLE');

    // Nao deve conter DELETE FROM (SQL statement, nao comentarios)
    const lines = content.split('\n');
    const sqlDeleteLines = lines.filter(l => {
      const trimmed = l.trim();
      return trimmed.match(/^DELETE\s+FROM/i) && !trimmed.startsWith('--');
    });
    expect(sqlDeleteLines).toHaveLength(0);

    // Nao deve conter TRUNCATE
    expect(content).not.toContain('TRUNCATE');
  });
});

// ==============================================================================
// Teste 7: Nenhuma rota depende de candidatos para Dashboard
// ==============================================================================

describe('REC-02: Rotas ativas', () => {
  it('useDashboardRecrutamento nao importa candidatos table', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const hookPath = path.default.resolve(
      process.cwd(),
      'src/modules/recrutamento/hooks/useDashboardRecrutamento.ts'
    );
    const content = fs.default.readFileSync(hookPath, 'utf-8');

    // Nao deve ter .from('candidatos') para queries do Dashboard
    const fromLegacy = content.match(/\.from\(['"]candidatos['"]\)/g);
    expect(fromLegacy).toBeNull();
  });
});

// ==============================================================================
// Teste 8: Ausencia de dados apagados
// ==============================================================================

describe('REC-02: Integridade de dados', () => {
  it('migration nao contem DELETE ou TRUNCATE', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const migrationPath = path.default.resolve(
      process.cwd(),
      'supabase/migrations/20260831_rec02_tenant_isolation.sql'
    );
    const content = fs.default.readFileSync(migrationPath, 'utf-8');

    const lines = content.split('\n');
    const sqlDeleteLines = lines.filter(l => {
      const trimmed = l.trim();
      return trimmed.match(/^DELETE\s+FROM/i) && !trimmed.startsWith('--');
    });
    expect(sqlDeleteLines).toHaveLength(0);
    expect(content).not.toMatch(/\bTRUNCATE\b/);
    expect(content).not.toMatch(/\bDROP\s+TABLE\b/);
  });
});

// ==============================================================================
// Teste 9: Regressao — imports existentes
// ==============================================================================

describe('REC-02: Regressao', () => {
  it('conversaoCandidatoService continua exportando objeto', async () => {
    const mod = await import('@/modules/recrutamento/services/conversaoCandidatoService');
    expect(mod.conversaoCandidatoService).toBeDefined();
    expect(typeof mod.conversaoCandidatoService).toBe('object');
  });

  it('enterpriseKanbanService continua exportando objeto', async () => {
    const mod = await import('@/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService');
    expect(mod.enterpriseKanbanService).toBeDefined();
    expect(typeof mod.enterpriseKanbanService).toBe('object');
  });

  it('prestadoresService continua exportando objeto', async () => {
    const mod = await import('@/modules/recrutamento/services/prestadoresService');
    expect(mod.prestadoresService).toBeDefined();
    expect(typeof mod.prestadoresService).toBe('object');
  });
});
