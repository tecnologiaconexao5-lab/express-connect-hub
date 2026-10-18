# MISSÃO 03A — Rastreamento da Origem das 3 Queries HTTP 400

**Data:** 2026-07-27 | **Auditor:** IA | **Escopo:** Rastreamento código-fonte

---

## Sumário Executivo

| # | Tabela | HTTP | Arquivo | Linha | Função | Causa Provável |
|---|--------|:----:|---------|:-----:|--------|---------------|
| 1 | `prestadores` | 400 | `RoteirizadorWeb.tsx` | 155 | `loadData()` | Coluna `veiculos` como bare column (sem sintaxe de relação `veiculos(tipo,placa)`) |
| 2 | `veiculos` | 400 | `RoteirizadorWeb.tsx` | 161 | `loadData()` | `status=eq.Ativo` com valor capitalizado ou coluna inexistente (`termica`, `prestador_vinculado`) |
| 3 | `portal_ocorrencias` | 400 | `ocorrenciaService.ts` | 30-35 | `listarOcorrencias()` | Join `ordens_servico!os_id(numero_os)` sem FK real entre as tabelas |

**Cadeia comum:** RoteirizadorWeb.tsx + OcorrenciasLista.tsx → Operacao.tsx (abas "roteirizacao" + "ocorrencias")

---

## Query #1 — `prestadores`

### Network observado
```
GET /rest/v1/prestadores
  ?select=id,nome_completo,veiculos,status,cep,regiao_principal
  &status=eq.ativo
  &limit=50
→ HTTP 400
```

### Cadeia completa

```
React Component: RoteirizadorWeb (src/components/operacao/RoteirizadorWeb.tsx:68)
  ↓
Página pai: Operacao.tsx:82 → <RoteirizadorWeb />
  ↓
useEffect (src/components/operacao/RoteirizadorWeb.tsx:80)
  SEM dependency array → roda em todo render
  ↓
loadData() (linha 81)
  ↓
supabase.from("prestadores") (linha 153-154)
  ↓
.select("id, nome_completo, veiculos, status, cep, regiao_principal") (linha 155)
  ↓
.eq("status", "ativo") (linha 156)
  ↓
.limit(50) (linha 157)
  ↓
SUPABASE REST API → HTTP 400
```

### Arquivo: `src/components/operacao/RoteirizadorWeb.tsx`

| Atributo | Valor |
|----------|-------|
| Linha | 155 |
| Função | `loadData()` dentro de `useEffect` (linha 80-203) |
| Componente | `RoteirizadorWeb` (functional component, linha 68) |
| Export | `export default RoteirizadorWeb` (linha 1424) |
| import em | `src/pages/Operacao.tsx` linha 10 e 82 |

### Causa provável
`veiculos` é usado como **coluna simples** (bare column), não como relação (`veiculos(tipo,placa)`). Se `veiculos` não for uma coluna JSONB válida na tabela `prestadores`, o Supabase REST API devolve 400. A query bem-sucedida em `EscalaLista.tsx:305` usa `veiculos(tipo,placa)` (sintaxe de relação), confirmando que `veiculos` como bare column não é suportada.

---

## Query #2 — `veiculos`

### Network observado
```
GET /rest/v1/veiculos
  ?select=id,tipo_veiculo,placa,capacidade_kg,capacidade_m3,prestador_vinculado,termica,status
  &status=eq.Ativo
  &limit=100
→ HTTP 400
```

### Cadeia completa

```
React Component: RoteirizadorWeb (src/components/operacao/RoteirizadorWeb.tsx:68)
  ↓
Página pai: Operacao.tsx:82 → <RoteirizadorWeb />
  ↓
useEffect (src/components/operacao/RoteirizadorWeb.tsx:80)
  SEM dependency array → roda em todo render
  ↓
loadData() (linha 81)
  ↓
supabase.from("veiculos") (linha 159-160)
  ↓
.select("id, tipo_veiculo, placa, capacidade_kg, capacidade_m3, prestador_vinculado, termica, status") (linha 161)
  ↓
.eq("status", "Ativo") (linha 162)  ← "Ativo" com 'A' maiúsculo!
  ↓
.limit(100) (linha 163)
  ↓
SUPABASE REST API → HTTP 400
```

### Arquivo: `src/components/operacao/RoteirizadorWeb.tsx`

| Atributo | Valor |
|----------|-------|
| Linha | 161 |
| Função | `loadData()` dentro de `useEffect` (linha 80-203) |
| Componente | `RoteirizadorWeb` (mesmo componente, mesma useEffect) |

### Causa provável
1. **`status=eq.Ativo`** — valor com 'A' maiúsculo. No enum de status da tabela `veiculos`, os valores podem ser lowercase (`ativo`).
2. **Colunas potencialmente inexistentes**: `prestador_vinculado`, `termica`, `capacidade_m3` podem não existir no schema da tabela `veiculos` ou ter nomes diferentes.

A query bem-sucedida em `escalaService.ts:362` usa apenas `.select("status")` na tabela `veiculos`, o que sugere que as colunas no select expandido podem não ser todas válidas.

---

## Query #3 — `portal_ocorrencias`

### Network observado
```
GET /rest/v1/portal_ocorrencias
  ?select=*,clientes:cliente_id(nome_fantasia,razao_social),ordens_servico!os_id(numero_os)
  &order=created_at.desc
  &limit=100
→ HTTP 400
```

### Cadeia completa

```
React Component: OcorrenciasLista (src/components/operacao/OcorrenciasLista.tsx:28)
  ↓
Página pai: Operacao.tsx:86 → <OcorrenciasLista />
  ↓
useEffect (OcorrenciasLista.tsx:64)
  ↓
listarOcorrencias() (linha 51)
  ↓
Service: src/services/ocorrenciaService.ts:26
  ↓
supabase.from("portal_ocorrencias") (linha 29)
  ↓
.select(`*,
  clientes:cliente_id (nome_fantasia, razao_social),
  ordens_servico!os_id (numero_os)`) (linhas 30-34, template literal multi-linha)
  ↓
.order("created_at", { ascending: false }) (linha 35)
  ↓
.limit(100) (linha 47)
  ↓
SUPABASE REST API → HTTP 400
```

### Arquivo: `src/services/ocorrenciaService.ts`

| Atributo | Valor |
|----------|-------|
| Linha | 30-34 (select template literal) + 47 (limit) |
| Função | `listarOcorrencias(filtros?)` exportada na linha 26 |
| Interface | `OcorrenciaTMS` (linha 4) |
| Service | serviço dedicado (não é um builder genérico) |
| importado por | `src/components/operacao/OcorrenciasLista.tsx` linha 14 |

### Causa provável
A sintaxe de join **`ordens_servico!os_id(numero_os)`** usa o operador `!` (inner join forçado) do Supabase REST API. Este operador exige que exista **uma foreign key constraint real** entre `portal_ocorrencias.os_id` e `ordens_servico.id`. Se não houver FK, o Supabase retorna HTTP 400.

A migração que criou `portal_ocorrencias` (`20260630000001_m44a_tabela_ocorrencias.sql`) pode não ter definido a FK para `ordens_servico`, ou o nome da coluna de referência não corresponde.

---

## Efeito Multiplicador: `useEffect` sem dependency array

Em `RoteirizadorWeb.tsx` linha 203:
```typescript
  });  // useEffect SEM []) — sem dependency array!
```

Isso significa que o `useEffect` roda em **todo render** do componente, não apenas na montagem. React 18 Strict Mode monta e desmonta cada componente 2× em desenvolvimento, gerando **4 chamadas** (2 montagens × 2 renders cada) para cada query.

**Evidência na rede:** 5 chamadas para prestadores e 2 para veiculos em ~100ms.

---

## Diagrama Completo

```
Operacao.tsx (página)
├── Tab "os"        → <OrdensServicoLista />
├── Tab "escala"    → <EscalaLista />          ← query prestadores BEM-SUCEDIDA (veiculos(tipo,placa))
├── Tab "roteirizacao" → <RoteirizadorWeb />   ← query prestadores 400 + veiculos 400
│   └── useEffect() sem deps
│       ├── supabase.from("prestadores").select("id, nome_completo, veiculos, status, cep, regiao_principal").eq("status", "ativo").limit(50)
│       └── supabase.from("veiculos").select("id, tipo_veiculo, placa, capacidade_kg, capacidade_m3, prestador_vinculado, termica, status").eq("status", "Ativo").limit(100)
├── Tab "ocorrencias" → <OcorrenciasLista />   ← query portal_ocorrencias 400
│   └── useEffect()
│       └── listarOcorrencias()
│           └── supabase.from("portal_ocorrencias").select(`*, clientes:cliente_id(...), ordens_servico!os_id(...)`).limit(100)
└── Tab "pod"       → <PodLista />
```

---

## Classificação de Causa Raiz

### Primária — Schema/Query Mismatch
As 3 queries usam colunas ou sintaxes que não correspondem ao schema real do banco:
1. **prestadores**: `veiculos` como bare column (should be `veiculos(tipo,placa)` join)
2. **veiculos**: `status=eq.Ativo` (case mismatch) + colunas potencialmente ausentes (`termica`, `prestador_vinculado`, `capacidade_m3`)
3. **portal_ocorrencias**: `ordens_servico!os_id` (FK inexistente)

### Secundária — useEffect sem dependency array
`RoteirizadorWeb.tsx:203` — `useEffect` sem `[]` causa execução em todo re-render, multiplicando chamadas 400.

### Terciária — Falta de tratamento de erro nas queries
Nenhuma das 3 queries tem `try/catch` ou `.catch()` para capturar o erro 400. O erro é silencioso no console do navegador como `console.warn` (RoteirizadorWeb.tsx:197) ou silencioso via `.catch()` genérico.

---

## Arquivos Envolvidos

| Arquivo | Linhas | Papel |
|---------|:------:|-------|
| `src/components/operacao/RoteirizadorWeb.tsx` | 1424 | Query #1 (prestadores) + Query #2 (veiculos) |
| `src/services/ocorrenciaService.ts` | 214 | Query #3 (portal_ocorrencias) |
| `src/components/operacao/OcorrenciasLista.tsx` | 399 | Caller do service #3 |
| `src/pages/Operacao.tsx` | ~90 | Página que monta RoteirizadorWeb e OcorrenciasLista |
| `src/components/operacao/EscalaLista.tsx` | — | Query prestadores BEM-SUCEDIDA (referência de comparação) |
| `src/services/escala/escalaService.ts` | — | Query veiculos BEM-SUCEDIDA (referência de comparação) |

---

## Notas Técnicas

- **grep não encontrava strings**: As colunas do `RoteirizadorWeb.tsx` estavam sendo procuradas apenas em serviços/hooks, ignorando o componente principal que as chama inline (sem service layer).
- **Template literal multi-linha**: O select do `ocorrenciaService.ts` usa template literal (\`...\`) multi-linha, o que fazia o grep de linha única falhar.
- **`limit=50` vs `limit=10`**: SearchableSelect usa `limit(10)` e **não** é responsável pelas queries 400. As queries 400 vêm do `RoteirizadorWeb.tsx` que usa `limit(50)`.
