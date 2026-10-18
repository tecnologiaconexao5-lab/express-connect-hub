# Missão 03B — Confirmação de Schema e Proposta de Correções

**Data:** 2026-07-27  
**Ambiente:** Produção (`uwrvzsjtpgaifkktpepn.supabase.co`)  
**Modo:** SOMENTE LEITURA — Nenhuma alteração aplicada  
**Branch:** `auditoria-final-integracao`

---

## Sumário

| Query | Arquivo | Linha | HTTP | Causa Raiz |
|-------|---------|:-----:|:----:|-----------|
| #1 | `RoteirizadorWeb.tsx` — prestadores | 155 | 400 | Coluna `cep` não existe em `prestadores` |
| #2 | `RoteirizadorWeb.tsx` — veiculos | 161 | 400 | Coluna `termica` não existe em `veiculos` |
| #3 | `ocorrenciaService.ts` — portal_ocorrencias | 30 | 400 | Coluna `os_id` não existe + FK `ordens_servico!os_id` não encontrada |

---

## Evidências de Confirmação

### Metodologia

Teste coluna-a-coluna via REST API do Supabase com `anon key`, usando `select` incremental para isolar a primeira coluna inexistente. Todas as queries com `select=col1,col2,...&limit=1`.

### Resultados dos testes REST

#### Query #1 — prestadores

| Teste | Select | Resultado |
|-------|--------|:---------:|
| 1 | `id,nome_completo` | **OK 200** |
| 2 | `+status` | **OK 200** |
| 3 | `+cep` | **ERR 400** ← PRIMEIRA FALHA |
| 4 | `+regiao_principal` (sem cep) | **OK 200** ✅ |

**Conclusão:** `cep` é a primeira coluna inexistente na ordem do select original
`("id, nome_completo, veiculos, status, cep, regiao_principal")`.

`veiculos` também não existe como coluna, mas é atingida depois de `cep` (que já causou o 400).

#### Query #2 — veiculos

| Teste | Select | Resultado |
|-------|--------|:---------:|
| 1 | `id,tipo_veiculo,placa` | **OK 200** |
| 2 | `+capacidade_kg` | **OK 200** |
| 3 | `+capacidade_m3` | **OK 200** |
| 4 | `+prestador_vinculado` | **OK 200** |
| 5 | `+termica` | **ERR 400** ← PRIMEIRA FALHA |
| 6 | `+status` (sem termica) | **OK 200** ✅ |

**Conclusão:** `termica` é a única coluna inexistente no select original
`("id, tipo_veiculo, placa, capacidade_kg, capacidade_m3, prestador_vinculado, termica, status")`.

Todas as demais colunas existem. `status=eq.Ativo` funciona (case-insensitive).

#### Query #3 — portal_ocorrencias

| Teste | Query | Resultado |
|-------|-------|:---------:|
| 1 | `select=*,clientes:cliente_id(nome_fantasia,razao_social)` | **OK 200** ✅ |
| 2 | `select=*,ordens_servico!os_id(numero_os)` | **ERR 400** ❌ |

Body do erro (capturado em Missão 03A):
```json
{
  "code": "PGRST200",
  "details": "Searched for a foreign key relationship between 'portal_ocorrencias' and 'ordens_servico' using the hint 'os_id' in the schema 'public', but no matches were found.",
  "hint": "Perhaps you meant 'portal_cliente_perfil_view' instead of 'ordens_servico'.",
  "message": "Could not find a relationship between 'portal_ocorrencias' and 'ordens_servico' in the schema cache"
}
```

**Conclusão:** Dupla falha — (1) `os_id` não existe como coluna, (2) não há FK entre `portal_ocorrencias` e `ordens_servico`.

---

## Causas Raiz

### Causa #1 — Coluna `cep` em `prestadores`

**Schema real** (`supabase/migrations/20260510000001_core_baseline.sql` linhas 85-167):
```sql
CREATE TABLE public.prestadores (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    nome_completo text,
    cpf_cnpj text,
    telefone text,
    ...
    regiao_principal text,
    endereco jsonb,
    ...
    status text DEFAULT 'ativo'::text,
    ...
);
```

A tabela **não tem** coluna `cep`. Endereços são armazenados como JSONB na coluna `endereco` (de onde `RoteirizadorWeb.tsx` linha 105 já extrai: `end.cep || ""`).

**Todas as outras colunas** do select original existem: ✅ `id`, `nome_completo`, `status`, `regiao_principal`.

### Causa #2 — Coluna `termica` em `veiculos`

**Schema real** (`supabase/migrations/20260510000001_core_baseline.sql` linhas 172-210):
```sql
CREATE TABLE public.veiculos (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    placa text,
    tipo_veiculo text,
    ...
    capacidade_kg numeric,
    capacidade_m3 numeric,
    prestador_vinculado uuid,
    status text DEFAULT 'disponivel'::text,
    ...
    tipo_carga text,
    temperatura_min numeric,
    temperatura_max numeric,
    ...
);
```

A tabela **não tem** coluna `termica`. Colunas similares disponíveis:
- `tipo_carga` — pode conter 'refrigerada'
- `temperatura_min` / `temperatura_max` — faixa de temperatura

### Causa #3 — Coluna `os_id` e FK em `portal_ocorrencias`

**Gap de migration**: Duas migrations criam `portal_ocorrencias`:
1. **`20260509000003_tabelas_faltantes.sql`** (linha 114) — cria SEM `os_id`:
   ```sql
   CREATE TABLE IF NOT EXISTS public.portal_ocorrencias (
       id uuid, cliente_id uuid, tipo text, descricao text,
       prioridade text, status text, created_at timestamptz,
       updated_at timestamptz
   );
   ```
2. **`portal_cliente_enterprise.sql`** (linha 46) — cria COM `os_id`:
   ```sql
   CREATE TABLE IF NOT EXISTS public.portal_ocorrencias (
       id uuid, cliente_id uuid, os_id uuid, prestador_id uuid,
       veiculo_id uuid, ...
   );
   ```
   Porém `IF NOT EXISTS` impede a execução porque a tabela já existe. As colunas adicionais (`os_id`, `prestador_id`, `veiculo_id`, `anexos`, `metadata`) nunca foram adicionadas.

**Comentário na migration original** (linha 124):
```sql
-- FK sera adicionado pelo arquivo portal_cliente_enterprise.sql
```
O arquivo `portal_cliente_enterprise.sql` tentou adicionar via `CREATE TABLE IF NOT EXISTS` (falhou) + `CREATE INDEX IF NOT EXISTS ... os_id` (também falharia pois coluna não existe).

---

## Correções Propostas

### Correção #1 — `RoteirizadorWeb.tsx` linha 155

**Query original** (ERR 400):
```typescript
.select("id, nome_completo, veiculos, status, cep, regiao_principal")
.eq("status", "ativo")
```

**Query corrigida**:
```typescript
.select("id, nome_completo, veiculos!prestador_vinculado(tipo_veiculo, placa, capacidade_kg, capacidade_m3, status), status, regiao_principal")
.eq("status", "ativo")
```

**Alterações**:
- `veiculos` → `veiculos!prestador_vinculado(tipo_veiculo, placa, capacidade_kg, capacidade_m3, status)` — usa FK real `prestador_vinculado` para obter veículos do prestador
- `cep` **removido** (não existe na tabela). A linha 105 já extrai cep de `endereco->>'cep'`:
  ```typescript
  cep: (end.cep || "").toString().replace(/\D/g, '')
  ```
- Demais colunas permanecem (✅ existem)

**Linhas que usam `cep` e `veiculos`**: 105, 133, 155, 185, 186, 189

### Correção #2 — `RoteirizadorWeb.tsx` linha 161

**Query original** (ERR 400):
```typescript
.select("id, tipo_veiculo, placa, capacidade_kg, capacidade_m3, prestador_vinculado, termica, status")
```

**Query corrigida**:
```typescript
.select("id, tipo_veiculo, placa, capacidade_kg, capacidade_m3, prestador_vinculado, status, tipo_carga, temperatura_min, temperatura_max")
```

**Alterações**:
- `termica` → `tipo_carga, temperatura_min, temperatura_max`

**Linha 189** deve ser ajustada de:
```typescript
tipoOperacao: v.termica === "refrigerado" ? "refrigerado" : "seco",
```
Para:
```typescript
tipoOperacao: v.tipo_carga === "refrigerada" ? "refrigerado" : "seco",
```

### Correção #3 — `ocorrenciaService.ts` linhas 28-34

**Query original** (ERR 400):
```typescript
.select(`
  *,
  clientes:cliente_id (nome_fantasia, razao_social),
  ordens_servico!os_id (numero_os)
`)
```

**Query corrigida**:
```typescript
.select(`
  *,
  clientes:cliente_id (nome_fantasia, razao_social)
`)
```

**Alterações**:
- `ordens_servico!os_id(numero_os)` **removido** — coluna `os_id` não existe na tabela
- O campo `os_id` deve ser adicionado à tabela via migration de correção (`ALTER TABLE public.portal_ocorrencias ADD COLUMN os_id uuid;`) com FK para `ordens_servico(id)`

### Correção de Schema — `portal_ocorrencias`

Migration necessária (`20260727_m03b_fix_portal_ocorrencias_schema.sql` — NÃO CRIADA, apenas proposta):

```sql
-- Adicionar colunas faltantes
ALTER TABLE public.portal_ocorrencias
  ADD COLUMN IF NOT EXISTS os_id uuid,
  ADD COLUMN IF NOT EXISTS prestador_id uuid,
  ADD COLUMN IF NOT EXISTS veiculo_id uuid,
  ADD COLUMN IF NOT EXISTS anexos jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Adicionar FKs
ALTER TABLE public.portal_ocorrencias
  ADD CONSTRAINT fk_portal_ocorrencias_os
  FOREIGN KEY (os_id) REFERENCES public.ordens_servico(id);

ALTER TABLE public.portal_ocorrencias
  ADD CONSTRAINT fk_portal_ocorrencias_prestador
  FOREIGN KEY (prestador_id) REFERENCES public.prestadores(id);

ALTER TABLE public.portal_ocorrencias
  ADD CONSTRAINT fk_portal_ocorrencias_veiculo
  FOREIGN KEY (veiculo_id) REFERENCES public.veiculos(id);

-- Recriar índices
CREATE INDEX IF NOT EXISTS idx_portal_ocorrencias_os
  ON public.portal_ocorrencias(os_id);
```

---

## Resumo final

| # | Arquivo | Linha | Coluna Ausente | Tipo | Similar Existente |
|:-:|---------|:-----:|:--------------:|:----:|:-----------------:|
| 1 | `RoteirizadorWeb.tsx` | 155 | `cep` (prestadores) | Coluna | `endereco->>'cep'` (JSONB) |
| 1 | `RoteirizadorWeb.tsx` | 155 | `veiculos` (prestadores) | Coluna | `veiculos!prestador_vinculado()` (FK) |
| 2 | `RoteirizadorWeb.tsx` | 161 | `termica` (veiculos) | Coluna | `tipo_carga`, `temperatura_min/max` |
| 3 | `ocorrenciaService.ts` | 30 | `os_id` (portal_ocorrencias) | Coluna + FK | Não existe — requer `ALTER TABLE ADD COLUMN` |
| 3 | `ocorrenciaService.ts` | 33 | `ordens_servico!os_id` | FK | Não existe — requer correção de schema |

**Todas as 3 queries HTTP 400 têm causa raiz confirmada. As correções exigem alteração de TypeScript (RoteirizadorWeb.tsx, ocorrenciaService.ts) e, para #3, também correção de schema SQL.**

---

## Como este relatório foi gerado

1. REST API direta ao Supabase produção coluna-por-coluna (21 chamadas)
2. Validação individual de cada coluna (`select=col` vs `select=col1,col2,...`)
3. Confirmação de schema via arquivos de migration em `supabase/migrations/`
   - `20260510000001_core_baseline.sql` — schema `prestadores` e `veiculos`
   - `20260509000003_tabelas_faltantes.sql` — primeira versão de `portal_ocorrencias`
   - `portal_cliente_enterprise.sql` — segunda versão de `portal_ocorrencias` (IF NOT EXISTS)
4. Isolamento da coluna exata que causa o erro 400 (a primeira não-encontrada na ordem do select)
5. Body do erro HTTP 400 capturado e analisado para confirmação do código PGRST200
