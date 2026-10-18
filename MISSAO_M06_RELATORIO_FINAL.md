# M06 — Relatório Final de Validação Transacional

## Status: ✅ APROVADA COM RESSALVAS

## Resumo

| Item | Resultado |
|------|-----------|
| **Migration** | `20260801_m06_rls_remaining_tables.sql` (1080 linhas) |
| **Conexão** | `uwrvzsjtpgaifkktpepn.supabase.co` (PRODUÇÃO) |
| **Tabelas auditadas** | 27 |
| **Erros introduzidos pela M6** | **0** |
| **Policies esperadas criadas** | **10/10** |
| **Pre-existing USING(true) policies** | 13 (warnings, fora do escopo da M6) |
| **ROOLBACK** | OK — 0 alterações persistentes |
| **Integridade dos dados** | OK — 85/33/24 registros inalterados |

## Policies Criadas pela M6 (10/10 ✅)

### Portal Cliente (6)
| Policy | Tabela | Função |
|--------|--------|--------|
| `fr_select_cliente` | `financeiro_receber` | Cliente vê seus recebíveis via `f_obter_cliente_id_do_usuario()` |
| `prestadores_select_portal` | `prestadores` | Cliente vê prestadores vinculados às suas entregas |
| `veiculos_select_portal` | `veiculos` | Cliente vê veículos dos prestadores via `alocacoes_escala.prestador_id → prestadores.id → veiculos.prestador_vinculado` |
| `fcte_select_cliente` | `fiscal_ctes` | CTes do cliente |
| `fnfse_select_cliente` | `fiscal_nfse` | NFSes do cliente |
| `fmdfe_select_cliente` | `fiscal_mdfes` | MDFes do cliente |

### Portal Prestador (2)
| Policy | Tabela | Função |
|--------|--------|--------|
| `prestadores_select_own` | `prestadores` | Prestador vê apenas seu próprio perfil |
| `contratos_select_prestador` | `contratos_gerados` | Prestador vê contratos onde é parte |

### TMS (2)
| Policy | Tabela | Função |
|--------|--------|--------|
| `cip_select_tms / cip_insert_tms / cip_update_tms` | `crm_interacoes_prestadores` | TMS acessa interações com prestadores (substitui 4 `authenticated_*` policies USING(true)) |
| `tv_select_tms` | `tabelas_valores` | TMS acessa tabelas (filtra por `tenant_id`) |

## Pre-existing Warnings (13 — fora do escopo da M6)

Policies com `USING(true)` que já existiam antes da M6 e não são modificadas por ela:

| Tabela | Policy | Risco |
|--------|--------|:-----:|
| `financeiro_pagar` | `fp_select_tms` | Médio |
| `composicao_financeira_os` | `Allow all` | Médio |
| `crm_leads` | `Allow all`, `allow_anon_read` | Alto |
| `crm_historico` | `allow_anon_read` | Alto |
| `crm_followups` | `allow_anon_read` | Alto |
| `prestadores` | `App prestador can insert as candidate` | Médio |
| `fiscal_ctes` | `Allow all operations` | Alto |
| `fiscal_nfse` | `Allow all operations` | Alto |
| `fiscal_mdfes` | `Allow all operations` | Alto |
| `contratos_gerados` | `Allow all contratos_gerados` | Médio |
| `contratos_modelos` | `Allow all contratos_modelos` | Médio |
| `contratos_historico` | `Allow all contratos_historico` | Médio |
| `orcamentos` | 6 policies anon (insert/select/update) | Alto |

## Tabelas que Não Existem em Produção (3 — ignoradas via IF EXISTS)

- `financeiro_baixas`
- `despesas_operacionais`
- `auditoria_operacional`

## Lições Aprendidas

1. **`tenant_id` não existe na maioria das tabelas** — apenas `tabelas_valores` e `operacao_localizacao` têm a coluna em produção. Policies não devem filtrar por `tenant_id` sem verificar a coluna primeiro.
2. **`fp_select_tms` já existia** — de uma tentativa anterior de migration (M55). Todas as CREATEs precisam de `IF NOT EXISTS`.
3. **`DROP POLICY IF EXISTS ON tabela_inexistente`** causa `relation does not exist`. DROPs de tabelas que podem não existir devem ficar dentro de `DO $$ ... IF EXISTS ...`
4. **Nomes de colunas reais diferem do schema esperado**: `veiculo_id` não existe em `alocacoes_escala` (join via `prestador_id → prestadores → veiculos.prestador_vinculado`).
5. **Sempre confirmar schema remoto antes de escrever migrations** — o script `m6_check_tenant_columns.mjs` salvou a validação.
