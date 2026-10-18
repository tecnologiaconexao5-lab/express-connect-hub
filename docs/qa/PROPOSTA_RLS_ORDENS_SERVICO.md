# PROPOSTA DE CORREÇÃO — RLS ORDENS_SERVICO

**Data:** 2026-07-23
**Missão:** 136-C.2-QA0.4-R1
**Status:** PROPOSTA — NÃO APLICADA

---

## 1. DIAGNÓSTICO

### Problema
Consultas SELECT em `ordens_servico` sem filtro por ID específico falham com:
```
invalid input syntax for type uuid: "M43_2026-06-29_18-27-54 Cliente"
```

### Causa Raiz
A RLS policy `os_select_tenant` faz:
```sql
CREATE POLICY "os_select_tenant" ON ordens_servico 
FOR SELECT TO anon, authenticated 
USING (tenant_id = current_tenant_id_safe());
```

A coluna `tenant_id` em `ordens_servico` é do tipo TEXT (tabela criada antes da convenção UUID). Algumas linhas contêm valores TEXT não-UUID (ex: "M43_2026-06-29_18-27-54 Cliente"). Quando o RLS avalia `tenant_id = current_tenant_id_safe()`, o PostgreSQL tenta fazer cast implícito de TEXT para UUID, que falha para essas linhas.

### Evidências
- **43/49** OS IDs referenciados por `alocacoes_escala` foram encontrados individualmente
- **6/49** falham com erro de cast UUID
- `SELECT id FROM ordens_servico LIMIT 5` funciona (primeiras 5 linhas têm tenant_id válido)
- `SELECT id FROM ordens_servico` sem LIMIT falha (alguma linha tem tenant_id inválido)
- `tenant_id` exibido como string nas OS encontradas (ex: "00000000-0000-0000-0000-000000000001")

---

## 2. POLÍTICA ATUAL (extraída da migration)

**Arquivo:** `supabase/migrations/20260626_missao16_multitenant_rls_p0.sql:123`
```sql
CREATE POLICY "os_select_tenant" ON ordens_servico 
FOR SELECT TO anon, authenticated 
USING (tenant_id = current_tenant_id_safe());
```

**Função `current_tenant_id_safe()`** (`20260626_missao16_multitenant_rls_p0.sql:15`):
```sql
CREATE OR REPLACE FUNCTION current_tenant_id_safe()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    v_tenant_id := NULLIF(current_setting('app.tenant_id', true), '')::UUID;
    IF v_tenant_id IS NOT NULL THEN RETURN v_tenant_id; END IF;
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RETURN '00000000-0000-0000-0000-000000000001'; END IF;
    SELECT tenant_id INTO v_tenant_id
    FROM tenant_usuarios
    WHERE user_id = v_user_id AND status = 'ativo'
    LIMIT 1;
    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## 3. PROPOSTA DE CORREÇÃO

### Abordagem A (Recomendada) — Safe cast com fallback
Substituir a policy para usar um safe-cast que trata valores não-UUID como FALSE (linha não acessível):

```sql
DROP POLICY IF EXISTS "os_select_tenant" ON ordens_servico;
CREATE POLICY "os_select_tenant" ON ordens_servico 
FOR SELECT TO anon, authenticated 
USING (
  CASE 
    WHEN tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
    THEN tenant_id::uuid = current_tenant_id_safe()
    ELSE false
  END
);
```

### Abordagem B — Migrar tenant_id para UUID com correção de dados
Passo 1 — Fixar dados existentes (encontrar e corrigir tenant_id inválidos):
```sql
UPDATE ordens_servico 
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
```

Passo 2 — Alterar tipo da coluna para UUID:
```sql
ALTER TABLE ordens_servico ALTER COLUMN tenant_id TYPE UUID 
USING tenant_id::uuid;
```

Passo 3 — Manter a policy original (volta a funcionar).

### Abordagem C — Mínimo: apenas corrigir os 6 registos problemáticos
```sql
-- Identificar e corrigir apenas as linhas com tenant_id inválido
UPDATE ordens_servico 
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NOT NULL 
  AND tenant_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND id IN (
    -- IDs das OS que falham (extrair da lista de 6)
    '19eedf62-...', '2073a75d-...', '215eaf04-...'
  );
```

---

## 4. IMPACTO POR PERFIL

| Perfil | Afetado? | Motivo |
|--------|:--------:|--------|
| `super_admin` | Sim | Consultas agregadas a `ordens_servico` falham |
| `financeiro` | Sim | Relatórios financeiros que consultam OS quebram |
| `comercial` | Sim | Conversão orçamento→OS pode ser afetada |
| `operacional` | Sim | Escala vinculada a OS pode não carregar |
| `cliente` | Não | Portal cliente não consulta `ordens_servico` diretamente |
| anon | Sim | Mesmo erro para usuário não autenticado |

---

## 5. RISCO DA CORREÇÃO

| Abordagem | Risco | Complexidade | Recomendada |
|:---------:|:-----:|:------------:|:-----------:|
| A (safe cast) | Baixo — apenas muda política SELECT | Simples | ✅ |
| B (migração coluna) | Médio — altera tipo de coluna | Complexa | ❌ (após validação QA) |
| C (correção mínima) | Baixo — só corrige 6 registos | Muito simples | ✅ Emergencial |

**Recomendação:** Aplicar Abordagem A (safe cast) imediatamente + Abordagem C (corrigir 6 registos) como emergencial. Abordagem B apenas após validação em ambiente QA.

---

## 6. MIGRATION PROPOSTA

```sql
-- Proposta: fix RLS em ordens_servico para tratar tenant_id TEXT inválido
-- Autor: QA0.4-R1
-- Data: 2026-07-23

BEGIN;

-- Abordagem A + C combinadas

-- 1. Corrigir registos existentes com tenant_id inválido
UPDATE ordens_servico 
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NOT NULL 
  AND tenant_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2. Substituir RLS policy com safe cast
DROP POLICY IF EXISTS "os_select_tenant" ON ordens_servico;
CREATE POLICY "os_select_tenant" ON ordens_servico 
FOR SELECT TO anon, authenticated 
USING (
  CASE 
    WHEN tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
    THEN tenant_id::uuid = current_tenant_id_safe()
    ELSE false
  END
);

COMMIT;
```

---

## 7. VALIDAÇÃO PÓS-CORREÇÃO

Após aplicar, executar:
```sql
-- Teste 1: SELECT agregado deve funcionar
SELECT COUNT(*) FROM ordens_servico;

-- Teste 2: SELECT com filtro WHERE continua funcionando
SELECT id, cliente FROM ordens_servico LIMIT 10;

-- Teste 3: Verificar que tenant_id inválidos foram corrigidos
SELECT COUNT(*) FROM ordens_servico 
WHERE tenant_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
-- Resultado esperado: 0
```

---

**⚠️ NÃO APLICAR EM PRODUÇÃO SEM VALIDAÇÃO EM AMBIENTE QA.**
