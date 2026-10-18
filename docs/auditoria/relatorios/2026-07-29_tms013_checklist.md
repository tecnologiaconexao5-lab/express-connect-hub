# MISSÃO TMS-013 — CHECKLIST

**Data:** 2026-07-29

---

## PLANEJAMENTO

- [x] Definir 6 cenários de homologação
- [x] Mapear 16 tabelas envolvidas (~54 registros planejados)
- [x] Definir marcador HML-APP-20260729
- [x] Definir ordem de exclusão segura (filhos → pais)

## ARTEFATOS CRIADOS

- [x] Seed script: `scripts/tms013_seed_hml.mjs`
- [x] Cleanup script: `supabase/scripts/cleanup_hml_app_20260729.sql`
- [x] Manifesto JSON: `docs/auditoria/relatorios/2026-07-29_tms013_manifesto_dados_homologacao.json`
- [x] Relatório .md: `docs/auditoria/relatorios/2026-07-29_tms013_homologacao_integrada.md`
- [x] Relatório .txt: `docs/auditoria/relatorios/2026-07-29_tms013_homologacao_integrada.txt`

## VALIDAÇÃO DO SEED

- [ ] Seed script possui idempotência (ON CONFLICT / upsert)
- [ ] Seed script possui modo dry-run
- [ ] Seed script executa sem erros em produção
- [ ] Registros confirmados via SELECT após execução

**Classificação atual:** SITUAÇÃO A — Seed não executado ❌

## VALIDAÇÃO DO CLEANUP

- [x] Possui transação explícita (BEGIN/COMMIT)
- [x] PASSO 0 de conferência ativo por padrão
- [x] Ordem de exclusão correta (filhos → pais)
- [x] Nenhum CASCADE
- [x] Nenhum TRUNCATE
- [x] Nenhum DELETE sem WHERE
- [x] Permite ROLLBACK para inspeção

## AUDITORIA DE CONTRADIÇÃO

- [x] Relatório original identificado como contraditório
- [x] Consulta ao banco executada (16 tabelas)
- [x] 0 registros confirmados — SITUAÇÃO A
- [x] Relatório .md corrigido
- [x] Relatório .txt sincronizado
- [x] Cleanup PASSO 0 ativado
- [x] Manifesto atualizado com seed_executado: false

## DOCUMENTAÇÃO DE ENCERRAMENTO

- [x] Relatório de continuidade gerado
- [x] Relatório técnico .md gerado
- [x] Relatório técnico .txt gerado
- [x] Checklist gerado
- [x] Manifesto atualizado
- [x] AUDITORIA_MASTER atualizado

## PENDENTES (pós-missão)

- [ ] **P0:** Adicionar ON CONFLICT ao seed script (idempotência)
- [ ] **P1:** Obter autorização para executar seed em produção
- [ ] **P2:** Verificar existência de `os_enderecos` no schema remoto
- [ ] **P2:** Decidir sobre `abastecimentos` (tabela inexistente)
- [ ] **P3:** Executar seed e validar visualmente 6 cenários
- [ ] **P3:** Executar cleanup e validar remoção completa

---

## RESUMO

| Status | Itens |
|--------|:-----:|
| ☑ Concluído | 18 |
| ☐ Pendente | 6 |
| ☐ Bloqueado | 0 |
