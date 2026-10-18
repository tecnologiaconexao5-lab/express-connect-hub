# Politicas RLS — Express Connect Hub / TMS

> **Missao:** 01 | **Data:** 2026-06-26

---

## 1. Estrategia de RLS

### Regra Universal (pós-Missao 01)
```
SELECT  → anon (leitura publica para compatibilidade com app atual)
INSERT  → authenticated (escrita apenas autenticada)
UPDATE  → authenticated
DELETE  → authenticated
```

### Excecoes
- `orcamentos`: INSERT permitido para anon (criacao de orcamento pelo comercial sem login)
- `fiscal_*`: ja usava `auth.role() = 'authenticated'` — mantido
- `ia_comunicacoes_robos`: ja usava `auth.role() = 'authenticated'` — mantido
- `usuarios_cliente`: politica `cliente_read_own` com `auth.uid()` — mantida

---

## 2. Templates de Politica

### Template A — Tabelas IA (maioria)
```sql
CREATE POLICY "{tabela}_select_anon" ON {tabela} FOR SELECT TO anon USING (true);
CREATE POLICY "{tabela}_insert_auth" ON {tabela} FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "{tabela}_update_auth" ON {tabela} FOR UPDATE TO authenticated USING (true);
CREATE POLICY "{tabela}_delete_auth" ON {tabela} FOR DELETE TO authenticated USING (true);
```

### Template B — Futuro (row-level por tenant)
```sql
CREATE POLICY "{tabela}_select_own" ON {tabela} FOR SELECT TO authenticated
  USING (empresa_id = current_setting('app.current_tenant_id')::uuid);
```

### Template C — Futuro (row-level por usuario)
```sql
CREATE POLICY "{tabela}_select_own" ON {tabela} FOR SELECT TO authenticated
  USING (cliente_id IN (
    SELECT cliente_id FROM usuarios_cliente WHERE auth_user_id = auth.uid()
  ));
```

---

## 3. Inventario de Politicas por Tabela

### CRM (6 tabelas)
| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `crm_leads` | anon | auth | auth | auth |
| `crm_historico` | anon | auth | — | — |
| `crm_followups` | anon | auth | — | — |
| `crm_conversas` | anon | auth | auth | — |
| `crm_mensagens` | anon | auth | — | — |
| `crm_interacoes_prestadores` | anon | auth | auth | auth |

### Operacao (5 tabelas)
| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `orcamentos` | anon | **anon** | auth | auth |
| `rotas` | anon | auth | auth | — |
| `rota_paradas` | anon | auth | auth | — |
| `rota_execucoes` | anon | auth | auth | — |
| `escala_operacional` | anon | auth | auth | auth |

### Portal Cliente (11 tabelas)
| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `portal_pedidos` | anon | auth | auth | auth |
| `portal_notificacoes` | anon | auth | auth | — |
| `portal_ocorrencias` | anon | auth | auth | auth |
| `portal_faturas` | anon | auth | auth | auth |
| ... (7 outras) | anon | auth | auth | auth |

### IA (60+ tabelas)
| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `ia_ferramentas` | anon | auth | auth | auth |
| `ia_execucoes_ferramentas` | anon | auth | auth | auth |
| `ia_missoes` | anon | auth | auth | auth |
| `ia_trabalhos` | anon | auth | auth | auth |
| `memoria_entidades` | anon | auth | auth | auth |
| ... (55+ outras) | anon | auth | auth | auth |

### Excecoes (mantidas com politicas anteriores)
| Tabela | Por que |
|--------|---------|
| `ia_comunicacoes_robos` | `auth.role() = 'authenticated'` (F28) |
| `diretor_virtual_eventos_ia` | `auth.role() = 'authenticated'` (F27) |
| `fiscal_ctes` | `auth.role() = 'authenticated'` |
| `fiscal_nfse` | `auth.role() = 'authenticated'` |
| `recrutamento_operacoes` | `auth.role() IN ('authenticated','service_role')` |
| `usuarios_cliente` | `auth.uid() = auth_user_id` |

---

## 4. Storage Buckets

| Bucket | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `documentos` | publico | auth | auth | auth |
| `biblioteca-global` | publico | auth | auth | auth |
| `contratos` | publico | auth/service_role | auth/service_role | — |

---

## 5. Proximos Passos

1. Implementar Supabase Auth → politicas `authenticated` passam a ter efeito real
2. Adicionar `empresa_id` para isolamento multi-tenant
3. Adicionar `auth.uid()` row-level nas tabelas de negocio
4. Criar politicas por perfil usando `auth.jwt() -> 'role'`

---

*Documento gerado para Missao 01 — OpenCode Go Pro*
