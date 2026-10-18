# CHECKPOINT — Implantação 135-B.1

## Metadados
| Campo | Valor |
|-------|-------|
| Data | 2026-07-22 |
| Branch | main |
| Último commit | 148b67f (missão 133-D.2) |
| Migration pendente | `20260722_m135b_portal_pedido_para_os.sql` |

## Estado do Banco Remoto (antes da implantação)

### Schema portal_pedidos
| Situação | Colunas |
|----------|---------|
| ✅ Já existem | `os_vinculada_id`, `erro_processamento`, `codigo_erro`, `tentativas_processamento`, `ultima_tentativa_em`, `solicitacao_via`, `data_solicitada` |
| ❌ Serão criadas | `converted_at` |

### Schema ordens_servico
| Situação | Colunas |
|----------|---------|
| ✅ `cliente` é UUID | Confirmado |
| ❌ Será criada | `pedido_portal_id` |

### RPC
| Status | Detalhe |
|--------|---------|
| ❌ Não existe | `converter_pedido_para_os()` será criada |

### Índices
| Status | Índice |
|--------|--------|
| ❌ Não existe | `idx_portal_pedidos_os_vinculada_unique` (UNIQUE) |
| ❌ Não existe | `idx_ordens_servico_pedido_portal` |

### CHECK constraint
| Atual | Nova |
|-------|------|
| 8 valores | 12 valores (+ aprovado, convertido, rejeitado, erro_conversao) |

### Pedidos existentes: 8 (todos "enviado")

### RLS: pp_select_own, pp_insert_own, pp_update_own — preservados

## Arquivos da Missão
| Arquivo | Status |
|---------|--------|
| `supabase/migrations/20260722_m135b_portal_pedido_para_os.sql` | ✅ Auditada, segura para aplicar |
| `scripts/m135b_test_conversao.sql` | ✅ Testes SQL |
| `scripts/m135b1_deploy_homologate.mjs` | ✅ Script de deploy completo |
| `scripts/m135b1_audit_only.mjs` | ✅ Auditoria já executada |
| `scripts/m135b1_cleanup_hml.sql` | A gerar após conversão |
| `docs/homologacao/missao135b/` | ✅ Declaração, contrato, relatório |

## Riscos Identificados
| Risco | Mitigação |
|-------|-----------|
| Migration já parcialmente aplicada | `IF NOT EXISTS` em todas as ALTER |
| Dados existentes podem ser afetados | Migration só ADD, nunca DROP |
| CHECK constraint replace | DROP + ADD é atômico, não afeta registros existentes |
