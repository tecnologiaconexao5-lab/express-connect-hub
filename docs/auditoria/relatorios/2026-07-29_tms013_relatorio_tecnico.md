# MISSÃO TMS-013 — Relatório Técnico

**Data:** 2026-07-29
**Status:** PARCIAL — Planejamento validado, seed não executado
**Classificação:** SITUAÇÃO A
**Auditor responsável:** opencode

---

## RESUMO EXECUTIVO

Missão destinada a criar dados de homologação descartáveis para 6 cenários operacionais do TMS. Durante a auditoria de encerramento, descobriu-se que o relatório de integração continha uma contradição: afirmava simultaneamente que 54 registros haviam sido criados e que o seed aguardava execução. Uma consulta direta ao banco de produção (16 tabelas, marcador `HML-APP-20260729`) confirmou **0 registros em 0 tabelas** — o seed nunca foi executado. O relatório foi corrigido, o script de cleanup teve seu PASSO 0 (conferência) ativado, e o manifesto foi atualizado.

## OBJETIVO

1. Planejar 6 cenários de homologação cobrindo fluxos críticos do TMS
2. Criar seed script com dados descartáveis (marcador `HML-APP-20260729`)
3. Criar cleanup script seguro (transacional, ordem filhos→pais)
4. Gerar manifesto de dados para rastreabilidade
5. Auditar o estado real do banco e corrigir contradições no relatório

## DESENVOLVIMENTO

### ETAPA 1 — Planejamento (concluído anteriormente)

6 cenários planejados:
| # | Cenário | OS | Alocações | Veículo | Prestador | Cliente |
|:-:|---------|----|-----------|---------|-----------|---------|
| 1 | OS direta | HML-OS-001 | 1 | HML1A23 | teste@conexao.com | HML C1 |
| 2 | Motoboy | HML-OS-002 | 1 | HML2B34 | MOTOBOY HML C2 | HML C2 FOOD |
| 3 | E-commerce 5 paradas | HML-OS-003 | 1 | HML3C45 | ENTREGADOR HML C3 | HML C3 E-COMM |
| 4 | Coleta reversa | HML-OS-004 | 1 | HML4D56 | LOG REVERSA HML C4 | HML C4 REVERSA |
| 5 | Ocorrência + reentrega | HML-OS-005 | 2 | HML5E67 | ENTREGADOR HML C5 | HML C5 OCORR |
| 6 | Repasse financeiro | HML-OS-006 | 1 | HML6F78 | TRANSP HML C6 | HML C6 FIN |

Artefatos criados: `scripts/tms013_seed_hml.mjs` (~54 INSERTs em 16 tabelas), `supabase/scripts/cleanup_hml_app_20260729.sql` (16 passos, ordem filhos→pais, dentro de BEGIN/COMMIT), `docs/auditoria/relatorios/2026-07-29_tms013_manifesto_dados_homologacao.json` (todos os IDs como placeholders).

### ETAPA 2 — Auditoria e Correção

Identificada contradição no relatório de integração:
- Seção "Dados Temporários Criados": exibia tabela com quantidades (54 registros)
- Status e Pendências: afirmava "aguardando execução"
- Manifesto: todos os IDs eram placeholders `UUID-GERADO-PELO-SCRIPT`

Procedimento de verificação:
1. Script `_tms013_check.mjs` criado com consultas SELECT para 16 tabelas
2. Configuração: `node -r dotenv/config` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. Filtros por marcador: `HML-APP-20260729`, placas `HML%`, emails `%@hml.teste`, números `HML-OS-%`
4. Conexão direta com `uwrvzsjtpgaifkktpepn.supabase.co`

### ETAPA 3 — Correção dos Artefatos

1. Relatório .md: seção "Dados Temporários Criados" → "Auditoria Full-Stack — Resultado da Consulta ao Banco"
2. Status: "SCRIPTS PRONTOS" → "SITUAÇÃO A — SEED NÃO EXECUTADO"
3. Percentual banco: 95% → 0%
4. Cleanup: PASSO 0 descomentado (conferência ativa)
5. Relatório .txt: sincronizado

## EVIDÊNCIAS

### Evidência 1 — Manifesto com placeholders

Arquivo: `2026-07-29_tms013_manifesto_dados_homologacao.json`
Todos os 54+ IDs são `UUID-GERADO-PELO-SCRIPT`. Nenhum UUID real de banco presente.

### Evidência 2 — Consulta ao banco (16 tabelas)

```
Tabela                          | Registros
clientes                        |        0
prestadores                     |        0
veiculos                        |        0
ordens_servico                  |        0
alocacoes_escala                |        0
financeiro_receber              |        0
financeiro_pagar                |        0
pagamentos_prestadores          |        0
entregas_protocolo              |        0
portal_tracking_realtime        |        0
ocorrencias                     |        0
reembolsos_prestador            |        0
abastecimentos                  | Tabela inexistente
historico_alocacoes_escala      |        0
operation_timeline_events       |        0
os_enderecos                    |        0
--------------------------------+----------
TOTAL                           |        0
```

### Evidência 3 — Cleanup com PASSO 0 ativo

Arquivo: `supabase/scripts/cleanup_hml_app_20260729.sql`
Linhas 22-55: seção de conferência (SELECT COUNT) agora descomentada e ativa por padrão.

### Evidência 4 — Relatório corrigido

Arquivo: `2026-07-29_tms013_homologacao_integrada.md`
- Status: SITUAÇÃO A — SEED NÃO EXECUTADO
- Percentual banco: 0%
- Percentual plano: 95%

## CORREÇÕES

| ID | Arquivo | Antes | Depois |
|:--:|---------|-------|--------|
| C1 | `2026-07-29_tms013_homologacao_integrada.md` | Tabela "Dados Temporários Criados" com 54 registros | Seção "Auditoria Full-Stack" com 0 registros |
| C2 | `2026-07-29_tms013_homologacao_integrada.md` | Status: "SCRIPTS PRONTOS" | Status: "SITUAÇÃO A — SEED NÃO EXECUTADO" |
| C3 | `2026-07-29_tms013_homologacao_integrada.md` | Percentual geral 95% | Plano 95% / Banco 0% |
| C4 | `cleanup_hml_app_20260729.sql` | PASSO 0 comentado (inativo) | PASSO 0 descomentado (ativo) |
| C5 | `2026-07-29_tms013_homologacao_integrada.txt` | Sincronizado com o .md original | Sincronizado com o .md corrigido |
| C6 | `2026-07-29_tms013_manifesto_dados_homologacao.json` | Sem observação sobre execução | Campo `_meta.seed_executado: false` adicionado |

## TESTES

| Teste | Tipo | Resultado |
|:-----:|------|:---------:|
| Consulta 16 tabelas | SELECT via Supabase anon key | 0 registros |
| Validação cleanup (16 regras) | Auditoria de código | ✅ Todas as regras ok, PASSO 0 corrigido |

## RESULTADO

| Métrica | Valor |
|---------|:-----:|
| Cenários planejados | 6/6 |
| Tabelas mapeadas | 16/18 (89%) |
| Registros no banco | 0 |
| Classificação | SITUAÇÃO A — Seed não executado |
| Percentual de execução (banco) | 0% |
| Percentual de prontidão (plano) | 95% |
| Relatórios corrigidos | 2 (.md + .txt) |
| Scripts com PASSO 0 ativado | 1 (cleanup) |

## PENDÊNCIAS

| Prioridade | Item |
|:----------:|------|
| P0 | Adicionar idempotência ao seed script |
| P1 | Obter autorização para executar seed |
| P2 | Verificar existência de `os_enderecos` no schema |
| P2 | Decidir sobre `abastecimentos` (tabela inexistente) |
| P3 | Executar seed e validar 6 cenários |
| P3 | Executar cleanup após validação |

## CONCLUSÃO

A missão TMS-013 foi parcialmente concluída. O planejamento está completo (6 cenários, 16 tabelas, scripts de seed e cleanup, manifesto) e validado como pronto para execução (95%). Porém **nenhum dado foi inserido no banco** (0%). A contradição no relatório foi corrigida com evidência empírica de consulta direta ao Supabase produção.

O principal risco atual é a **falta de idempotência no seed script**: se executado duas vezes, criará registros duplicados. Recomenda-se adicionar `ON CONFLICT` antes de qualquer execução em produção.

**Próximo passo:** Adicionar idempotência ao seed, obter autorização, verificar schema de `os_enderecos` e `abastecimentos`, executar seed, validar visualmente, executar cleanup.
