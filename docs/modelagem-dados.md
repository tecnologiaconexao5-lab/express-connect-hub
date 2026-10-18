# Modelagem de Dados — Express Connect Hub / TMS

> Auditoria: 2026-06-26 | ~100 tabelas | 74 migrations

---

## 1. Visão Geral

### Tabelas por Domínio
| Domínio | Tabelas | FK Coverage | CHECK Coverage |
|---------|---------|-------------|----------------|
| Core (clientes, prestadores, OS, veiculos) | 6 | ~40% | Baixa |
| Escala/Operação | 8 | ~60% | Média |
| Financeiro | 5 | ~20% | Baixa |
| Fiscal | 12 | ~70% | Média |
| Portal Cliente | 11 | ~10% | Baixa |
| Contratos | 3 | ~30% | Média |
| CRM/Comercial | 6 | ~60% | Baixa |
| Recrutamento | 4 | ~50% | Baixa |
| IA/Automação | 40+ | ~80% | Baixa |
| Infra/Config | 8 | ~50% | Alta |

---

## 2. Problemas Críticos de Modelagem (P0)

### 2.1 `os_id` com tipos diferentes (P0 — CORRUPÇÃO DE DADOS)

| Tabela | Coluna | Tipo |
|--------|--------|------|
| `alocacoes_escala` | `id` | UUID |
| `ordens_servico` | `id` | UUID |
| `pagamentos_prestadores` | `os_id` | UUID |
| `composicao_financeira_os` | `os_id` | UUID |
| **`financeiro_receber`** | **`os_id`** | **TEXT** |
| **`financeiro_pagar`** | **`os_id`** | **TEXT** |

Joins entre `financeiro_receber` e `alocacoes_escala` exigem CAST e podem falhar silenciosamente.

**Correção:**
```sql
ALTER TABLE financeiro_receber ALTER COLUMN os_id TYPE UUID USING os_id::UUID;
ALTER TABLE financeiro_pagar ALTER COLUMN os_id TYPE UUID USING os_id::UUID;
```

### 2.2 Foreign Keys Ausentes (16 FKs críticos)

| Tabela | Coluna | Deveria referenciar |
|--------|--------|---------------------|
| `ordens_servico` | `cliente_id` | `clientes.id` |
| `ordens_servico` | `prestador_id` | `prestadores.id` |
| `escala_operacional` | `os_id` | `ordens_servico.id` |
| `escala_operacional` | `prestador_id` | `prestadores.id` |
| `escala_operacional` | `veiculo_id` | `veiculos.id` |
| `financeiro_receber` | `cliente_id` | `clientes.id` |
| `financeiro_pagar` | `fornecedor_id` | `prestadores.id` |
| `portal_pedidos` | `os_vinculada_id` | `ordens_servico.id` |
| `portal_ocorrencias` | `os_id` | `ordens_servico.id` |
| `portal_ocorrencias` | `cliente_id` | `clientes.id` |
| `portal_ocorrencias` | `prestador_id` | `prestadores.id` |
| `portal_faturas` | `cliente_id` | `clientes.id` |
| `contratos_historico` | `contrato_id` | `contratos_gerados.id` |
| `orcamentos` | `os_vinculada_id` | `ordens_servico.id` |
| `fiscal_events` | `documento_id` | (polimórfico) |
| `pagamentos_prestadores` | `prestador_id` | `prestadores.id` |

---

## 3. Constraints Financeiras Ausentes (P0/P1)

### 3.1 CHECK >= 0 em valores (P0)
Nenhuma tabela financeira tem `CHECK (valor >= 0)`:

```sql
ALTER TABLE alocacoes_escala ADD CONSTRAINT ck_valor_frete_pos CHECK (valor_frete >= 0);
ALTER TABLE alocacoes_escala ADD CONSTRAINT ck_valor_repasse_pos CHECK (valor_repasse >= 0);
ALTER TABLE financeiro_receber ADD CONSTRAINT ck_fr_valor_pos CHECK (valor >= 0);
ALTER TABLE financeiro_pagar ADD CONSTRAINT ck_fp_valor_pos CHECK (valor >= 0);
ALTER TABLE pagamentos_prestadores ADD CONSTRAINT ck_pp_valor_pos CHECK (valor >= 0);
```

### 3.2 UNIQUE ausente em `composicao_financeira_os.os_id` (P0)
O trigger e código TypeScript usam `ON CONFLICT (os_id)` mas a constraint não existe:
```sql
ALTER TABLE composicao_financeira_os ADD CONSTRAINT uq_composicao_os UNIQUE (os_id);
```

### 3.3 CHECK em colunas de status (P1)
| Tabela | Coluna | Valores esperados |
|--------|--------|-------------------|
| `financeiro_receber` | `status` | aberto, pago, vencido, atrasado, cancelado |
| `financeiro_pagar` | `status` | aberto, pago, vencido, atrasado, cancelado |
| `portal_faturas` | `status` | aberta, a_vencer, vencida, paga, cancelada |
| `crm_leads` | `estagio` | lead_novo, primeiro_contato, proposta_enviada, negociacao, fechado, perdido |
| `ordens_servico` | `status_faturamento` | nao_faturado, faturado, parcial |
| `ordens_servico` | `status_pagamento` | pendente, pago, parcial |

---

## 4. Tabelas Duplicadas / Sobrepostas

### 4.1 `escala_operacional` vs `alocacoes_escala` (P1)
- `escala_operacional`: criada 2026-05-17, sem FKs, sem colunas financeiras
- `alocacoes_escala`: criada 2026-05-22, FKs com SET NULL, 20+ colunas financeiras, CHECK, triggers, histórico dedicado
- **Recomendação**: Deprecated `escala_operacional`, migrar dados restantes, remover tabela

### 4.2 `recrutamento_prestadores` vs `prestadores` (P2)
- Pipeline de recrutamento vs cadastro ativo. Design intencional mas sem migration path.

### 4.3 `recrutamento_candidatos` vs `candidatos` (P2)
- Duas tabelas para mesmo domínio. Consolidar ou documentar diferença.

### 4.4 `portal_faturas` vs `financeiro_receber` (P2)
- Visão cliente vs controle interno. Sem constraint de reconciliação.

---

## 5. Índices Faltantes

| Tabela | Colunas | Motivo |
|--------|---------|--------|
| `financeiro_receber` | `(cliente_id, status)` | Inadimplência por cliente |
| `financeiro_receber` | `(os_id)` | Deduplicação |
| `financeiro_receber` | `(data_vencimento, status)` | Relatórios de aging |
| `financeiro_pagar` | `(fornecedor_id, status)` | Contas a pagar por prestador |
| `pagamentos_prestadores` | `(prestador_id, status_pagamento)` | Status pagamento |
| `pagamentos_prestadores` | `(os_id)` | Deduplicação |
| `ordens_servico` | `(prestador_id, status)` | OS por prestador |
| `ordens_servico` | `(cliente_id, status)` | OS por cliente |
| `ordens_servico` | `(status_faturamento, status_pagamento)` | Filtro financeiro |
| `portal_pedidos` | `(os_vinculada_id)` | Join com OS |
| `contratos_historico` | `(contrato_id)` | Histórico por contrato |

---

## 6. Triggers

### Triggers de `updated_at` — Cobertura parcial
Apenas ~25 de ~100 tabelas têm trigger `updated_at`. Tabelas sem:
- `clientes`, `prestadores`, `veiculos`
- `portal_notificacoes`, `portal_comprovantes`, `portal_protocolos`, `portal_relatorios`
- `financeiro_receber`, `financeiro_pagar`
- `escala_operacional`

### Trigger de Propagação Financeira (P0 — Concorrência)
`f_trg_propagar_financeiro_alocacao` (`20260731`) escreve nas mesmas 4 tabelas que o TypeScript. Ambos disparam na mesma condição (`concluida + finalizada=true`). Risco de race condition.

---

## 7. Operações Destrutivas no Código

| Local | Operação | Risco |
|-------|----------|-------|
| `OrdensServicoLista.tsx:246-251` | DELETE cascade em 4 tabelas | Perda de dados financeiros |
| `ContasReceberEnterprise.tsx:972` | DELETE hard em financeiro_receber | Sem auditoria |
| `ClientesLista.tsx:190` | DELETE hard em clientes | Orfandade em cascade |
| `PrestadoresLista.tsx:164` | DELETE hard em prestadores | Orfandade em cascade |
| `enterpriseKanbanService.ts:822` | DELETE massivo | Apaga todos os registros |

**Recomendação:** Implementar soft-delete (`deleted_at`) ou auditoria obrigatória antes de DELETE.

---

## 8. Migration de Correção Recomendada

```sql
-- 1. Alinhar tipos UUID
ALTER TABLE financeiro_receber ALTER COLUMN os_id TYPE UUID USING os_id::UUID;
ALTER TABLE financeiro_pagar ALTER COLUMN os_id TYPE UUID USING os_id::UUID;

-- 2. Adicionar UNIQUE
ALTER TABLE composicao_financeira_os ADD CONSTRAINT uq_composicao_os UNIQUE (os_id);

-- 3. Adicionar CHECK em valores
ALTER TABLE alocacoes_escala ADD CONSTRAINT ck_valor_frete_pos CHECK (valor_frete >= 0);
ALTER TABLE alocacoes_escala ADD CONSTRAINT ck_valor_repasse_pos CHECK (valor_repasse >= 0);
ALTER TABLE financeiro_receber ADD CONSTRAINT ck_fr_valor_pos CHECK (valor >= 0);
ALTER TABLE financeiro_pagar ADD CONSTRAINT ck_fp_valor_pos CHECK (valor >= 0);
ALTER TABLE pagamentos_prestadores ADD CONSTRAINT ck_pp_valor_pos CHECK (valor >= 0);

-- 4. Adicionar FKs críticos
ALTER TABLE ordens_servico ADD CONSTRAINT fk_os_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE ordens_servico ADD CONSTRAINT fk_os_prestador FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE SET NULL;
ALTER TABLE contratos_historico ADD CONSTRAINT fk_ch_contrato FOREIGN KEY (contrato_id) REFERENCES contratos_gerados(id) ON DELETE CASCADE;
ALTER TABLE portal_pedidos ADD CONSTRAINT fk_pp_os FOREIGN KEY (os_vinculada_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;

-- 5. Adicionar CHECK em status
ALTER TABLE financeiro_receber ADD CONSTRAINT ck_fr_status CHECK (status IN ('aberto','pago','vencido','atrasado','cancelado'));
ALTER TABLE financeiro_pagar ADD CONSTRAINT ck_fp_status CHECK (status IN ('aberto','pago','vencido','atrasado','cancelado'));
ALTER TABLE portal_faturas ADD CONSTRAINT ck_pf_status CHECK (status IN ('aberta','a_vencer','vencida','paga','cancelada'));

-- 6. Marcar escala_operacional como deprecated
COMMENT ON TABLE escala_operacional IS 'DEPRECATED — use alocacoes_escala';

-- 7. Trigger de auditoria financeira
CREATE TABLE IF NOT EXISTS financeiro_receber_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receber_id UUID NOT NULL,
    valor_anterior NUMERIC,
    valor_novo NUMERIC,
    status_anterior TEXT,
    status_novo TEXT,
    changed_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 9. Classificação

| Categoria | P0 | P1 | P2 |
|-----------|----|----|-----|
| Tipo de dados inconsistente | 1 | 0 | 0 |
| FKs ausentes | 0 | 11 | 5 |
| Constraints CHECK ausentes | 1 | 2 | 7 |
| UNIQUE ausente | 1 | 0 | 0 |
| Tabelas duplicadas | 0 | 1 | 3 |
| Índices faltantes | 0 | 5 | 6 |
| Triggers ausentes | 1 | 0 | 0 |
| Soft-delete ausente | 2 | 0 | 0 |
| **Total** | **6** | **19** | **21** |

---

*Documento gerado por auditoria de modelagem automatizada — OpenCode Go Pro*
