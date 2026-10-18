# MISSÃO TMS-005 — Homologação Controlada do Módulo Prestadores

**Data:** 2026-07-27
**Status:** ✅ LEITURA E PAGINAÇÃO HOMOLOGADAS — C09/C10 CORRIGIDOS
**Percentual:** 49% (+1pp)
**Branch:** `auditoria-final-integracao`

---

## Correções Aplicadas

| Defeito | Arquivo | Correção |
|:-------:|---------|----------|
| **C10** — Paginação quebrada | `PrestadoresLista.tsx:51-53` | `useEffect` sem `page` na dependência. Adicionado `[page]`. |
| **C10** — `PAGE_SIZE` duplicado | `PrestadoresLista.tsx:26,42` | Removida redefinição interna (usava 25, module scope tinha 10) |
| **C09** — `dataValidadeCNH` inexistente | `PrestadorDetalhe.tsx:848` | Substituído por `metadata.cnh_validade` (campo `metadata` existe no schema) |
| Tipo — `metadata` não tipado | `types.ts:188` | Adicionado `metadata?: Record<string, unknown>` ao `Prestador` |
| Tipo — `documentos`/`contatosEmergencia` | `PrestadoresLista.tsx:113-114` | Parse de JSONB do raw `PrestadorRow` (não via `PrestadorForm`) |

## Schema Confirmado

| Campo UI | Campo DB | Tipo DB | Existe? |
|----------|----------|:-------:|:-------:|
| `nomeCompleto` | `nome_completo` | text | ✅ |
| `cpfCnpj` | `cpf_cnpj` | text | ✅ |
| `dataNascimento` | `data_nascimento` | date | ✅ |
| `authUserId` | `auth_user_id` | uuid | ✅ |
| `dataValidadeCNH` | — | — | ❌ **NÃO EXISTE** |
| `metadata` | `metadata` | jsonb | ✅ |
| CNH documents | `documentos_prestadores.tipo` | text | ✅ (tipo='CNH Frente'/'CNH Verso') |

## Playwright (4/4 + 1 parcial)

| Cenário | Resultado |
|:-------:|:---------:|
| Lista carrega (19 linhas, sem `undefined`) | ✅ |
| Detalhe abre (dados corretos) | ✅ |
| Busca funciona | ✅ |
| Network sem erros HTTP | ✅ |
| Edição controlada (escrita DB → UI) | ⚠️ Persistência OK, navegação ao M43 requer paginação |

## Matriz auth_user_id

| Situação | Quantidade | Impacto |
|----------|:---------:|:-------:|
| Total prestadores | 33 | — |
| Com auth_user_id | **1** | Apenas PRESTADOR TESTE APP |
| Sem auth_user_id | **32** | Sem login no App Motorista |
| liberado_app=true | **2** | PRESTADOR TESTE APP + BRUNO |
| Com auth + alocações | 1 | Normal |
| Sem auth + com alocações | **20** | Operam no TMS, não no App |
| Duplicidade auth_user_id | 0 | ✅ |
| **Classificação** | — | **Implantação parcial do Auth App** |

## HML Candidate

| Prestador | Status | Aloc | Veic | Auth | Seguro |
|-----------|:-----:|:----:|:----:|:----:|:------:|
| `M43_2026-06-29_18-24-20 Motorista Teste` | ativo | 0 | 0 | não | ✅ |

## Percentual

| Sub-módulo | Antes | Agora |
|-----------|:-----:|:-----:|
| Lista/leitura | 0% | **85%** |
| Paginação | 0% | **90%** |
| Detalhe/editação | 0% | **80%** |
| Documentos/CNH | 0% | **60%** |
| Auth/App | 0% | **20%** |
| **Prestadores (médio)** | **0%** | **70%** |
| **Geral** | **48%** | **49%** |

## Conclusão

```
PRESTADORES — LEITURA, PAGINAÇÃO E EDIÇÃO CONTROLADA HOMOLOGADAS;
ONBOARDING AUTH E CRUD COMPLETO AINDA PENDENTES
```
