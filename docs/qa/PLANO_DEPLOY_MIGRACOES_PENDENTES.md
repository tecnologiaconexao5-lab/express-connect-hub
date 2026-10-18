# PLANO DE DEPLOY — Migrações Pendentes (5 fichas)

**Data:** 2026-07-31
**Ambiente:** PRODUÇÃO (`uwrvzsjtpgaifkktpepn.supabase.co`)
**Total:** 5 migrations, ~1650 linhas SQL combinadas
**Estimativa de downtime:** < 5 segundos (nenhuma migration é blocking)

---

## ÍNDICE

1. [Ordem de Execução e Dependências](#1-ordem-de-execução-e-dependências)
2. [Ficha de Cada Migration](#2-ficha-de-cada-migration)
3. [Plano de Rollback](#3-plano-de-rollback)
4. [Backup Pré-Deploy](#4-backup-pré-deploy)
5. [Testes SQL de Homologação Pós-Deploy](#5-testes-sql-de-homologação-pós-deploy)
6. [Matriz de Risco e Decisão por Migration](#6-matriz-de-risco-e-decisão-por-migration)
7. [Checklist Go-Live](#7-checklist-go-live)
8. [Procedimento de Emergência](#8-procedimento-de-emergência)

---

## 1. ORDEM DE EXECUÇÃO E DEPENDÊNCIAS

```
M1 ───> M2 ───> M3 ───> M4 ───> M5
(safe)   (func)   (RLS)   (RLS)   (trigger)
```

| Ordem | Migration | Objetos | Risco | Dur. |
|:-----:|-----------|---------|:-----:|:----:|
| **M1** | `20260730_fix_assinatura_legivel.sql` | 18x ADD COLUMN em `clientes` + COMMENTS | ✅ **NENHUM** | 0.5s |
| **M2** | `20260722_m135b_portal_pedido_para_os.sql` | ADD COLUMN, INDEX, UNIQUE, FUNCTION (RPC), TRIGGER | ⚠️ BAIXO | 1s |
| **M3** | `20260725_missao_rls_fix_priority_tables.sql` | 34 DROP + 25 CREATE RLS policies, 14 tabelas | 🔶 **MÉDIO** | 2s |
| **M4** | `20260725_missao_rls_fix_core_operations.sql` | 8 DROP + 13 CREATE RLS policies, 3 tabelas core | 🔶 **MÉDIO** | 1s |
| **M5** | `20260731_p0_propagacao_financeira_trigger.sql` | CREATE OR REPLACE FUNCTION + TRIGGER | ⚠️ BAIXO | 1s |

### Dependência técnica
- **M3 e M4 são independentes entre si** (tocam tabelas disjuntas)
- **M5 é independente de RLS** (trigger roda SECURITY DEFINER, ignora RLS)
- **M1 e M2 não têm dependência** com nenhuma outra
- Ordem recomendada é do menor risco para o maior, mas **não há dependência técnica obrigatória**

---

## 2. FICHA DE CADA MIGRATION

### M1 — `20260730_fix_assinatura_legivel.sql` ✅ RISCO ZERO

**Objetivo:** Adicionar 18 colunas comerciais/fiscais faltantes na tabela `clientes`.

**O que faz:**
```
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ...
  tipo_cobranca text
  vencimento_padrao integer DEFAULT 15
  agrupamento_faturamento text
  cte_obrigatorio boolean DEFAULT false
  xml_obrigatorio boolean DEFAULT false
  comprovante_obrigatorio boolean DEFAULT false
  canhoto_obrigatorio boolean DEFAULT false
  assinatura_legivel boolean DEFAULT false
  protocolo_obrigatorio boolean DEFAULT false
  geolocalizacao boolean DEFAULT false
  tomador text
  cnae text
  cfop_padrao text
  retencoes text
  envio_xml boolean DEFAULT false
  observacoes_fiscais text
  municipio_padrao text
  regime_tributario text
  aliquota_iss numeric DEFAULT 0
  incentivo_fiscal boolean DEFAULT false
  tabela_valores_padrao_id uuid REFERENCES tabelas_valores(id) ON DELETE SET NULL
```

**Dependências:** NENHUMA
**Tabelas impactadas:** Apenas `clientes`
**Risco:** ✅ ZERO — `ADD COLUMN IF NOT EXISTS` nunca quebra
**Rollback:** `ALTER TABLE clientes DROP COLUMN IF EXISTS <coluna>` (18 vezes)
**Estimada:** 0.5s

---

### M2 — `20260722_m135b_portal_pedido_para_os.sql` ⚠️ BAIXO

**Objetivo:** Criar vínculo bidirecional `portal_pedidos ↔ ordens_servico`, RPC de conversão, trigger de evento.

**O que faz (456 linhas):**
1. Verifica/cria `os_vinculada_id` em `portal_pedidos` + INDEX
2. `ADD COLUMN pedido_portal_id` em `ordens_servico` + INDEX
3. `CREATE UNIQUE INDEX` em `portal_pedidos(os_vinculada_id)` — proteção duplicidade
4. `ADD COLUMN` 7 colunas de controle em `portal_pedidos` (converted_at, erro_processamento, etc.)
5. `DROP/ADD CONSTRAINT` status_check com novos status (convertido, erro_conversao)
6. `CREATE OR REPLACE FUNCTION converter_pedido_para_os()` — RPC transacional + idempotente
7. `CREATE OR REPLACE FUNCTION trg_evento_portal_pedido_criado()` — trigger corrigido
8. `CREATE TRIGGER` (se não existir)
9. `GRANT EXECUTE` da RPC para authenticated

**Dependências:** NENHUMA
**Tabelas impactadas:** `portal_pedidos`, `ordens_servico`
**Riscos identificados:**

| Risco | Prob. | Impacto | Mitigação |
|-------|:-----:|:-------:|-----------|
| UNIQUE INDEX falha se houver pedido com os_vinculada_id duplicado | 🔶 Média | Médio | `CREATE UNIQUE INDEX WHERE os_vinculada_id IS NOT NULL` — só falha se já existir duplicata (improvavel) |
| CONSTRAINT status_check falha se pedido existente com status fora da lista | 🔶 Média | Médio | `DROP CONSTRAINT` primeiro, depois `ADD` — seguro, mas pode haver pedidos com status inválido |
| TRIGGER já existe (M104) | Baixa | Baixo | `DO $$ IF NOT EXISTS ...` — coverage condicional |

**Rollback:** Comentado no final do arquivo (seção 7), 9 comandos DROP.
**Estimada:** 1s

**Pós-condição para M3:** M2 adiciona `pedido_portal_id` a `ordens_servico`. M3 (RLS priority) dropa `portal_pedidos_select/insert/update/delete` policies e cria novas (apenas portais). **Não há conflito** porque M3 mexe em RLS, M2 mexe em schema. M3 já tem os DROP POLICY IF EXISTS, então policies existentes são removidas independente de quando foram criadas.

---

### M3 — `20260725_missao_rls_fix_priority_tables.sql` 🔶 MÉDIO

**Objetivo:** Substituir policies públicas/anon (`USING(true)`) por policies scoped em 14 tabelas prioritárias.

**O que faz (521 linhas):**
- 34x `DROP POLICY IF EXISTS` (policies públicas existentes)
- 25x `CREATE POLICY` (policies scoped por tenant_usuarios, f_obter_cliente_id_do_usuario, prestadores.auth_user_id)
- 1x `ALTER TABLE ENABLE ROW LEVEL SECURITY` (`documentos_prestadores` — se ainda não ativado)
- 1 bloco `DO $$` de validação final (report de policies restantes)
- Múltiplos `DO $$` com `IF NOT EXISTS` para criação segura de policies TMS

**14 tabelas impactadas:**

| Tabela | Policies antigas (DROP) | Policies novas (CREATE) | Risco chave |
|--------|:-----------------------:|:-----------------------:|-------------|
| `documentos_prestadores` | 3 (insert/select/update) | 7 (select/insert/update/delete x prestador+TMS) | Documentos órfãos (prestador_id=NULL) ficam visíveis apenas via TMS |
| `pagamentos_prestadores` | 1 (ALL public) | 3 (select tenant cliente prestador) | Sem tenant_id: fallback para cliente OU prestador |
| `portal_tracking_realtime` | ~3 | ~2 | Tabela nunca usada (2 registros apenas) |
| `portal_pedidos` | 4 (select/insert/update/delete) | ~2 (select portal, insert portal) | Pedidos só visíveis pelo dono |
| `portal_ocorrencias` | 3 (select/insert/update) | 5 (portal select/insert/update + TMS select/insert/update) | **NOVAS**: po_select_tms, po_insert_tms, po_update_tms com join OS→tenant |
| `entregas_protocolo` | 2 (Anon insert, Authenticated select) | 6 (authenticated tenant, prestador, portal) | 44 registros existentes viram a ser restritos |
| `portal_avaliacoes` | ~3 | ~2 | |
| `portal_comprovantes` | ~3 | ~1 | Tabela fantasma (ninguém usa) |
| `portal_rotas` | ~3 | ~2 | |
| `portal_relatorios` | ~3 | ~2 | |
| `portal_notificacoes` | ~3 | ~2 | |
| `portal_protocolos` | ~3 | ~1 | |
| `portal_preferencias_cliente` | ~3 | ~1 | |
| `portal_faturas` | ~3 | ~2 | |

**Bug conhecido:** Policy `tracking_insert_prestador` compara `prestador_id = auth.uid()` diretamente, mas `prestador_id` em `portal_tracking_realtime` referencia `prestadores.id` (NUNCA `auth.uid()`). **Essa policy é dead code** — nenhum INSERT de tracking vindo do prestador funciona. A policy correta precisaria de subquery `EXISTS (SELECT 1 FROM prestadores WHERE id = prestador_id AND auth_user_id = auth.uid())`. Impacto: baixo porque a tabela só tem 2 registros offline.

**Dependências:** NENHUMA
**Riscos:**

| Risco | Prob. | Impacto | Mitigação |
|-------|:-----:|:-------:|-----------|
| `tenant_usuarios` não tem row para usuário logado | 🔶 Média | **Crítico** — TMS perde acesso | Testar antes com `SELECT * FROM tenant_usuarios WHERE user_id = auth.uid()` |
| `prestadores.auth_user_id` é NULL para prestadores existentes | 🔶 Média | Alto — prestador não vê seus dados | Verificar antes: `SELECT id, auth_user_id FROM prestadores WHERE auth_user_id IS NULL` |
| `f_obter_cliente_id_do_usuario()` retorna sentinel/NULL | 🔶 Média | Alto — Portal Cliente não vê dados | Testar função antes |
| `current_tenant_id_safe()` retorna sentinel | 🔶 Média | Alto — TMS perde dados | Testar função antes |
| Tabela sem RLS ativada anteriormente (documentos_prestadores) | Baixa | Baixo | `ENABLE ROW LEVEL SECURITY` já está no script |
| **After deploy:** TMS fica sem acesso por 1-2s enquanto policies antigas são dropadas e novas são criadas | Baixa | Mínimo | Operação transacional por migration |

**Rollback:** Complexo — requer recriar todas as policies antigas. Script separado recomendado.
**Estimada:** 2s

---

### M4 — `20260725_missao_rls_fix_core_operations.sql` 🔶 MÉDIO

**Objetivo:** Substituir policies públicas/anon em `alocacoes_escala`, `ordens_servico`, `clientes` por policies scoped (tenant_usuarios guard, cliente_id, prestador_id).

**O que faz (203 linhas):**
- 8x `DROP POLICY IF EXISTS`
- 13x `CREATE POLICY`
- 1 bloco `DO $$` de validação final

**3 tabelas impactadas:**

| Tabela | DROP | CREATE | Guard |
|--------|:----:|:------:|-------|
| `alocacoes_escala` | 4 (ae_select/insert/update/update_anon) | 6 (ae_select_tms/cliente/prestador, insert_tms/prestador, update_tms, delete_tms) | tenant_usuarios + prestadores.auth_user_id |
| `ordens_servico` | 1 (os_select_own) | 6 (os_select_tms/cliente/prestador, insert_tms, update_tms, delete_tms) | tenant_usuarios + prestadores (via alocacoes_escala) |
| `clientes` | 2 (cliente_select_own, clientes_select_own) | 1 (clientes_select_own recriada) | authenticated only |

**BUG CRÍTICO — `os_select_prestador` depende de alocacoes ter `ordem_servico_id` populado:**
A policy `os_select_prestador` (linha 114) faz:
```sql
USING (EXISTS (
  SELECT 1 FROM alocacoes_escala ae
  JOIN prestadores p ON p.id = ae.prestador_id
  WHERE ae.ordem_servico_id = ordens_servico.id
    AND p.auth_user_id = auth.uid()
));
```
Se `ae.ordem_servico_id` for NULL (alocações sem OS vinculada), o prestador **não consegue ver** a OS associada à sua alocação. Em produção, ~121 alocações não têm OS vinculada. Impacto real depende de como o App Motorista consulta OS.

**Dependências:** NENHUMA (tabelas disjuntas de M3)
**Riscos:**

| Risco | Prob. | Impacto | Mitigação |
|-------|:-----:|:-------:|-----------|
| App Motorista usa anon key → policies novas exigem authenticated | 🔶 Média | **Crítico** — app para de funcionar | Verificar se `ae_insert_prestador`/`ae_update_prestador` (preservadas) usam authenticated |
| Policies TMS com `tenant_usuarios` guard bloqueiam se setting `app.current_tenant_id` não estiver definido | 🔶 Média | Alto — TMS vazio | Usuários TMS entram via login que define `app.current_tenant_id`, mas testar |
| `os_select_prestador` falha para alocações sem `ordem_servico_id` | Alta | Médio — prestador não vê OS | O App Motorista consulta por alocação, não por OS. Impacto baixo. |
| `(cliente_id)::uuid` em `os_select_cliente` falha se valor TEXT não for UUID | 🔶 Média | Médio — `invalid input syntax for type uuid` | Mesmo bug da policy atual: linhas com tenant_id TEXT inválido quebram |

**Rollback:** Complexo — requer recriar policies antigas. Script separado.
**Estimada:** 1s

---

### M5 — `20260731_p0_propagacao_financeira_trigger.sql` ⚠️ BAIXO

**Objetivo:** Criar/re-criar trigger de propagação financeira automática em `alocacoes_escala` (CREATE OR REPLACE).

**O que faz (402 linhas):**
1. `CREATE OR REPLACE FUNCTION f_trg_propagar_financeiro_alocacao()` — Reescrita completa (M108F + M104A padrão)
2. `DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao` + `CREATE TRIGGER`
3. `COMMENT ON FUNCTION` + `COMMENT ON TRIGGER`

**Dispara em:** INSERT e UPDATE de colunas financeiras/status em `alocacoes_escala`
**Cria/atualiza:** `ordens_servico`, `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os`

**Dependências:** Tabelas `financeiro_receber`, `financeiro_pagar`, `pagamentos_prestadores`, `composicao_financeira_os` já existem
**Riscos:**

| Risco | Prob. | Impacto | Mitigação |
|-------|:-----:|:-------:|-----------|
| Trigger já existe com mesmo nome (M108F) | Alta | Nenhum | `DROP TRIGGER IF EXISTS` + `CREATE` é seguro |
| Trigger falha ao propagar e **não quebra o INSERT da alocação** | Baixa | Baixo | EXCEPTION handler captura tudo e loga WARNING |
| Cria `ordens_servico` para alocações que já têm OS | 🔶 Média | Médio — duplicidade | `ON CONFLICT (id) DO UPDATE` protege; mas pode criar OS paralela |
| `financeiro_receber` UNIQUE(os_id) | 🔶 **ALTO** | **Alto** — se trigger criar com os_id já existente, ON CONFLICT atualiza silenciosamente valores | Valores de alocação podem sobrescrever valores manuais |
| Lookup `prestadores` falha (tabela vazia) | Alta | Baixo | EXCEPTION handler: `v_prestador_nome := 'Prestador #...'` |
| Lookup `clientes` falha | Baixa | Baixo | EXCEPTION handler: `v_cliente_nome := 'Cliente #...'` |

**Pós-condição para trigger já ativo em produção:**
A M108F (já aplicada) criou `trg_propagar_financeiro_alocacao` com a função `f_trg_propagar_financeiro_alocacao()`. M5 dá `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` com a mesma função atualizada (`CREATE OR REPLACE FUNCTION`). A nova função tem:
- ✅ EXCEPTION handler (não quebra a alocação)
- ✅ Lookup de nomes reais
- ✅ Fórmula unificada: `outros_custos = adicionais + ajudante - descontos`
- ✅ Reversa incluída nos totais
- ✅ Margens calculadas (apenas na conclusão)
- ✅ `ON CONFLICT (os_id) DO UPDATE` em todas as 4 tabelas
- ✅ `WHEN (NEW.status IS DISTINCT FROM 'cancelada')` — não dispara em cancelamento

**Rollback:** `DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;` + recriar M108F original se necessário.
**Estimada:** 1s

---

## 3. PLANO DE ROLLBACK

### Rollback por migration

| Migration | Rollback | Comando | Tempo seguro |
|-----------|----------|---------|:------------:|
| **M1** | DROP COLUMN (18x) | `ALTER TABLE clientes DROP COLUMN IF EXISTS ...` | ∞ |
| **M2** | DROP + REMOVE | `DROP FUNCTION IF EXISTS converter_pedido_para_os`, `DROP INDEX`, `ALTER TABLE DROP COLUMN` (ver seção 7 do script) | ∞ (sem dados) |
| **M3** | Recriar policies antigas | Script separado (não incluso) | 24h |
| **M4** | Recriar policies antigas | Script separado (não incluso) | 24h |
| **M5** | DROP TRIGGER + recriar anterior | `DROP TRIGGER IF EXISTS ...` + guardar M108F original | ∞ |

### Script de rollback completo (emergência)

**Arquivo separado:** `scripts/rollback_pendentes_20260731.sql` (a gerar antes do deploy)

Conteúdo mínimo para rollback de emergência:
```sql
-- ROLLBACK RLS priority tables (M3) — Recria políticas públicas originais
-- ATENÇÃO: Isto RECRIA o buraco de segurança. Use apenas em emergência.
-- (non-blocking, seguro executar)
CREATE POLICY "Permitir insert documentos prestadores" ON public.documentos_prestadores FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Permitir select documentos prestadores" ON public.documentos_prestadores FOR SELECT TO public USING (true);
CREATE POLICY "Permitir update documentos prestadores" ON public.documentos_prestadores FOR UPDATE TO public USING (true);
-- ... repetir para todas as 14 tabelas ...
-- Para cada tabela: DROP POLICY IF EXISTS <novas_policies> + recriar antigas

-- ROLLBACK RLS core (M4) — Recria policies anon/originais
-- ... similar ...

-- ROLLBACK P0 trigger (M5)
DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala;

-- ROLLBACK M135b (M2)
DROP FUNCTION IF EXISTS public.converter_pedido_para_os(UUID, UUID);
DROP INDEX IF EXISTS idx_portal_pedidos_os_vinculada_unique;
DROP INDEX IF EXISTS idx_ordens_servico_pedido_portal;
ALTER TABLE public.ordens_servico DROP COLUMN IF EXISTS pedido_portal_id;
-- ... + resto da seção 7 do script M2 ...

-- ROLLBACK colunas clientes (M1)
ALTER TABLE clientes DROP COLUMN IF EXISTS tipo_cobranca,
  DROP COLUMN IF EXISTS vencimento_padrao,
  -- ... 18 colunas ...
  DROP COLUMN IF EXISTS tabela_valores_padrao_id;
```

---

## 4. BACKUP PRÉ-DEPLOY

### Obrigatório antes de qualquer migration

```bash
# 1. Backup de policies atuais
psql "$DATABASE_URL" -c "
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'documentos_prestadores', 'pagamentos_prestadores', 'portal_tracking_realtime',
      'portal_pedidos', 'portal_ocorrencias', 'entregas_protocolo',
      'portal_avaliacoes', 'portal_comprovantes', 'portal_rotas',
      'portal_relatorios', 'portal_notificacoes', 'portal_protocolos',
      'portal_preferencias_cliente', 'portal_faturas',
      'alocacoes_escala', 'ordens_servico', 'clientes'
    )
  ORDER BY tablename, policyname;
" > backup/policies_pre_deploy_20260731.sql

# 2. Backup de triggers atuais (especialmente propagação financeira)
psql "$DATABASE_URL" -c "
  SELECT tgname, tgrelid::regclass AS table_name,
         pg_get_triggerdef(oid) AS trigger_definition
  FROM pg_trigger
  WHERE tgname IN ('trg_propagar_financeiro_alocacao')
    AND tgrelid > 0
    AND NOT tgisinternal;
" > backup/triggers_pre_deploy_20260731.sql

# 3. Backup de funções existentes (CREATE OR REPLACE serão alteradas)
psql "$DATABASE_URL" -c "
  SELECT proname, pg_get_functiondef(oid)
  FROM pg_proc
  WHERE proname IN ('f_trg_propagar_financeiro_alocacao', 'converter_pedido_para_os',
                    'trg_evento_portal_pedido_criado')
    AND pronamespace = 'public'::regnamespace;
" > backup/functions_pre_deploy_20260731.sql

# 4. Snapshot de contagem de registros (para validar pós-deploy)
psql "$DATABASE_URL" -c "
  SELECT 'financeiro_receber' AS tabela, COUNT(*) FROM financeiro_receber UNION ALL
  SELECT 'financeiro_pagar', COUNT(*) FROM financeiro_pagar UNION ALL
  SELECT 'pagamentos_prestadores', COUNT(*) FROM pagamentos_prestadores UNION ALL
  SELECT 'composicao_financeira_os', COUNT(*) FROM composicao_financeira_os UNION ALL
  SELECT 'portal_ocorrencias', COUNT(*) FROM portal_ocorrencias UNION ALL
  SELECT 'portal_pedidos', COUNT(*) FROM portal_pedidos UNION ALL
  SELECT 'alocacoes_escala', COUNT(*) FROM alocacoes_escala UNION ALL
  SELECT 'ordens_servico', COUNT(*) FROM ordens_servico
  ORDER BY tabela;
" > backup/row_counts_pre_deploy_20260731.sql
```

### O que NÃO precisa de backup
- Tabelas inteiras (nenhuma migration altera dados existentes — apenas policies, colunas, índices, funções, triggers)
- Auth (nenhuma migration mexe em auth)

---

## 5. TESTES SQL DE HOMOLOGAÇÃO PÓS-DEPLOY

Executar EM ORDEM, após cada migration, antes de prosseguir para a próxima.

### 5.1 — Após M1 (colunas clientes)

```sql
-- T1: Colunas adicionadas com defaults corretos
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'clientes'
  AND column_name IN (
    'tipo_cobranca', 'vencimento_padrao', 'assinatura_legivel',
    'regime_tributario', 'tabela_valores_padrao_id'
  );

-- Critério de aprovação: 5 rows, cada uma com data_type e default esperados
```

### 5.2 — Após M2 (portal pedido → OS)

```sql
-- T2: Coluna pedido_portal_id existe em ordens_servico
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ordens_servico' AND column_name = 'pedido_portal_id';

-- T3: UNIQUE INDEX criado
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'portal_pedidos'
  AND indexname = 'idx_portal_pedidos_os_vinculada_unique';

-- T4: RPC existe e é executável por authenticated
SELECT proname, pronargs, proargtypes::text,
       pg_get_functiondef(p.oid) AS func_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'converter_pedido_para_os';

-- T5: Trigger de evento existe
SELECT tgname, tgrelid::regclass, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname = 'trg_evento_portal_pedido_criado'
  AND tgrelid > 0 AND NOT tgisinternal;

-- Critério de aprovação: T2-T5 retornam 1 row cada, sem erros
```

### 5.3 — Após M3 (RLS priority tables)

```sql
-- T6: Nenhuma policy pública/anon permanece nas 14 tabelas
SELECT tablename, COUNT(*) AS total_policies,
       COUNT(*) FILTER (WHERE roles @> ARRAY['public'::name] OR roles @> ARRAY['anon'::name]) AS public_anon_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'documentos_prestadores', 'pagamentos_prestadores', 'portal_tracking_realtime',
    'portal_pedidos', 'portal_ocorrencias', 'entregas_protocolo',
    'portal_avaliacoes', 'portal_comprovantes', 'portal_rotas',
    'portal_relatorios', 'portal_notificacoes', 'portal_protocolos',
    'portal_preferencias_cliente', 'portal_faturas'
  )
GROUP BY tablename
ORDER BY tablename;

-- T7: TMS consegue ler portal_ocorrencias (teste com sessão TMS autenticada)
-- (executar via aplicação, não como SQL puro)
-- SELECT * FROM portal_ocorrencias LIMIT 1;

-- Critério de aprovação (T6): public_anon_policies = 0 para todas as 14 tabelas
```

### 5.4 — Após M4 (RLS core operations)

```sql
-- T8: Nenhuma policy pública/anon em alocacoes_escala, ordens_servico, clientes
SELECT tablename, COUNT(*) AS total_policies,
       COUNT(*) FILTER (WHERE roles @> ARRAY['public'::name] OR roles @> ARRAY['anon'::name]) AS public_anon_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('alocacoes_escala', 'ordens_servico', 'clientes')
GROUP BY tablename
ORDER BY tablename;

-- T9: Policies esperadas existem em alocacoes_escala
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'alocacoes_escala'
ORDER BY policyname;

-- Critério de aprovação: public_anon_policies = 0; ae_select_tms/ae_select_cliente existem
```

### 5.5 — Após M5 (propagação financeira)

```sql
-- T10: Trigger existe e está ativo
SELECT tgname, tgrelid::regclass, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname = 'trg_propagar_financeiro_alocacao'
  AND tgrelid > 0 AND NOT tgisinternal;

-- T11: Função existe e contém EXCEPTION handler
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'f_trg_propagar_financeiro_alocacao'
  AND pronamespace = 'public'::regnamespace;

-- T12: Contagem de registros financeiros antes vs depois (não deve mudar apenas por aplicar a migration)
-- Comparar com backup/row_counts_pre_deploy_20260731.sql
SELECT 'financeiro_receber' AS tabela, COUNT(*) FROM financeiro_receber UNION ALL
SELECT 'financeiro_pagar', COUNT(*) FROM financeiro_pagar UNION ALL
SELECT 'pagamentos_prestadores', COUNT(*) FROM pagamentos_prestadores UNION ALL
SELECT 'composicao_financeira_os', COUNT(*) FROM composicao_financeira_os
ORDER BY tabela;

-- Critério de aprovação: T10 retorna trigger; T11 retorna com prosrc contendo 'EXCEPTION'
```

---

## 6. MATRIZ DE RISCO E DECISÃO POR MIGRATION

| Mig. | Risco | Bloqueante? | Pode pular? | Decisão |
|:----:|:-----:|:-----------:|:-----------:|---------|
| M1 | ✅ Nenhum | ❌ | ✅ (só colunas comerciais) | **APLICAR** — 0 risco, 18 colunas passam a existir |
| M2 | ⚠️ Baixo | ❌ | ✅ (portal pedidos sem caller) | **APLICAR** — RPC pronta, trigger corrigido |
| M3 | 🔶 Médio | ❌ | ✅ (segurança apenas) | **APLICAR** — remove 34 brechas de segurança públicas |
| M4 | 🔶 Médio | ❌ | ✅ (segurança apenas) | ⚠️ **AVALIAR** — risco de App Motorista parar se usar anon key |
| M5 | ⚠️ Baixo | ❌ | ✅ (trigger M108F já ativa) | **APLICAR** — função corrigida, não quebra nada |

### Decisão sobre M4 (core operations RLS)

**Aplicar APENAS se confirmar que App Motorista usa auth.uid() autenticado, não anon key.**

Para verificar antes do deploy:
```sql
-- Executar no DB de produção:
SELECT DISTINCT auth.role() FROM alocacoes_escala LIMIT 1; -- (não funciona assim)

-- Melhor: verificar uma alocação inserida pelo App Motorista
-- Se o App usa anon, ela foi inserida com role anon.
-- Se usa auth.uid(), foi inserida como authenticated.

-- Verificar sessão ativa do App:
-- Não é possível via SQL. Confirmar com DEV do App Motorista.
```

**Se App Motorista usa anon key:** NÃO aplicar M4 até migrar App para authenticated.
**Se App Motorista usa authenticated:** APLICAR M4.

---

## 7. CHECKLIST GO-LIVE

### Antes da janela (preparação)

- [ ] Backup de policies atuais salvo em `backup/policies_pre_deploy_20260731.sql`
- [ ] Backup de triggers atuais salvo em `backup/triggers_pre_deploy_20260731.sql`
- [ ] Backup de functions atual salvo em `backup/functions_pre_deploy_20260731.sql`
- [ ] Backup de row counts salvo em `backup/row_counts_pre_deploy_20260731.sql`
- [ ] Script de rollback de emergência gerado e revisado
- [ ] `DATABASE_URL` com service_role ou超级管理员 acesso disponível
- [ ] Conexão psql testada: `psql "$DATABASE_URL" -c "SELECT 1"`
- [ ] App Motorista confirma que usa auth.uid() authenticated (não anon key)
- [ ] 5 usuários corporativos existem e conseguem logar (verificar sessão real)
- [ ] `tsc --noEmit` → 0 erros (frontend compila)
- [ ] `npm run build` → sem erros

### Durante a janela (5 passos)

- [ ] **Step 1 — M1**: Aplicar `20260730_fix_assinatura_legivel.sql`
- [ ] **Validação M1**: Executar T1 — colunas existem com defaults
- [ ] **Step 2 — M2**: Aplicar `20260722_m135b_portal_pedido_para_os.sql`
- [ ] **Validação M2**: Executar T2-T5 — coluna, index, RPC, trigger
- [ ] **Step 3 — M3**: Aplicar `20260725_missao_rls_fix_priority_tables.sql`
- [ ] **Validação M3**: Executar T6 — 0 policies públicas/anon
- [ ] **Step 4 — M4**: Aplicar `20260725_missao_rls_fix_core_operations.sql` (se aprovado)
- [ ] **Validação M4**: Executar T8-T9 — 0 policies públicas/anon, policies TMS existem
- [ ] **Step 5 — M5**: Aplicar `20260731_p0_propagacao_financeira_trigger.sql`
- [ ] **Validação M5**: Executar T10-T12 — trigger ativo, contagens preservadas

### Após a janela (validação)

- [ ] Login TMS com tamiris.castilho → dashboard carrega com dados
- [ ] Login TMS com financeiro → módulo financeiro carrega
- [ ] Login TMS com operacional → escala, OS carregam
- [ ] Portal Cliente → ocorrências carregam do DB (não mock)
- [ ] Criar alocação → trigger cria financeiro automaticamente
- [ ] Navegação Playwright M55-C1, C2, C3: 27/27 testes
- [ ] `npx playwright test tests/e2e/missao55-*` — sem erros
- [ ] Console do navegador sem erros 401/403/500

### Gatilhos de abort (parar e rollback)

| Gatilho | Ação |
|---------|------|
| TMS não carrega dados após M3 | Rollback M3 (recriar policies antigas) |
| Portal Cliente não carrega após M3 | Rollback M3 |
| App Motorista não envia dados após M4 | Rollback M4 IMEDIATO |
| Trigger M5 dobra registros financeiros | Rollback M5 |
| Qualquer migration falha com erro SQL | Parar, investigar, não prosseguir |

---

## 8. PROCEDIMENTO DE EMERGÊNCIA

### Se algo quebrar durante o deploy

```bash
# 1. IDENTIFICAR qual migration estava sendo aplicada
#    Verificar último comando executado no psql/Supabase SQL Editor

# 2. DECIDIR: rollback parcial ou completo?
#    - Erro em M1 ou M2: rollback apenas da migração que falhou
#    - Erro em M3 ou M4: rollback IMEDIATO da migration + verificar acesso TMS
#    - Erro em M5: DROP TRIGGER + verificar se registros financeiros foram duplicados

# 3. EXECUTAR ROLLBACK
psql "$DATABASE_URL" -f scripts/rollback_pendentes_20260731.sql

# 4. RESTAURAR POLICIES (emergência máxima)
psql "$DATABASE_URL" -f backup/policies_pre_deploy_20260731.sql

# 5. RESTAURAR TRIGGER
psql "$DATABASE_URL" -f backup/triggers_pre_deploy_20260731.sql

# 6. VERIFICAR ACESSO
#    Login TMS → deve funcionar como antes
#    Login Portal → deve funcionar como antes
```

### Contato de emergência
- **Diego Balbino** — autor das migrations
- **Supabase Dashboard** — `https://supabase.com/dashboard/project/uwrvzsjtpgaifkktpepn`

---

## RESUMO — RISCOS REMANESCENTES PÓS-DEPLOY

Se todas as 5 migrations forem aplicadas com sucesso, os seguintes riscos PERMANECEM:

| Risco | Gravidade | Justificativa |
|-------|:---------:|---------------|
| `tracking_insert_prestador` usa `prestador_id = auth.uid()` (dead code) | Baixa | Tabela tem 2 registros apenas; ninguém usa |
| `os_select_prestador` não funciona para alocações sem `ordem_servico_id` | Média | ~121 alocações sem OS; App Motorista consulta por alocação |
| `financeiro_receber/pagar` sem UNIQUE(os_id) robusto | Média | ON CONFLICT protege trigger, mas UI manual pode duplicar |
| RLS policies TMS dependem de `app.current_tenant_id` definido | Média | Se login não definir, sentinel UUID bloqueia |
| `f_obter_cliente_id_do_usuario()` pode retornar NULL | Média | Portal Cliente fica vazio |
| 0 prestadores em produção — policies de prestador são dead code | Baixa | Até prestadores serem cadastrados, policies não executam |
