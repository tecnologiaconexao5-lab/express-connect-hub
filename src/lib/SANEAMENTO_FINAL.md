# SANEAMENTO FINAL - CONSISTÊNCIA DE CAMPOS

## RESUMO: MODELAGEM ATUAL DO SCHEMA FINAL (`sql_final_supabase.sql`)

### PRESTADORES
| Campo | Tipo | Observação |
|------|------|------------|
| `id` | UUID | PK |
| `nome_completo` | TEXT | ✅ USA ESTE! (não `nome_razao`) |
| `nome_fantasia` | TEXT | Nome fantasia |
| `cpf_cnpj` | TEXT | CPF/CNPJ |
| `tipo_parceiro` | TEXT | ✅ USA ESTE! (não `tipo_parceiro`) |
| `scoreInterno` | NUMERIC | ✅ USA ESTE! (não `score`) |
| `status` | TEXT | ativo, em_analise, etc |
| `user_id` | UUID | FK para auth.users |

### ORDENS_SERVICO
| Campo | Tipo | Observação |
|------|------|------------|
| `id` | UUID | PK |
| `numero` | TEXT | Número da OS |
| `prestador` | TEXT | ✅ TEXT! (não UUID) |
| `status` | TEXT | Status da OS |
| `custo_prestador` | NUMERIC | ✅ Usa este! (não `valor_frete`) |
| `valor_cliente` | NUMERIC | Valor para cliente |
| `data_programada` | DATE | Data programada |
| `previsao_inicio` | TIMESTAMPTZ | Previsão início |
| `previsao_termino` | TIMESTAMPTZ | Previsão término |

### OCORRÊNCIAS
| Campo | Tipo | Observação |
|------|------|------------|
| `id` | UUID | PK |
| `os_id` | UUID | FK |
| `prestador` | TEXT | ✅ TEXT! (não `prestador_id`) |
| `tipo` | TEXT | Tipo ocorrência |
| `descricao` | TEXT | Descrição |
| `status` | TEXT | Status |

### DOCUMENTOS_PRESTADORES
| Campo | Tipo | Observação |
|------|------|------------|
| `prestador_id` | UUID | ✅ UUID! (não TEXT) |
| `tipo` | TEXT | Tipo documento |

---

## DIVERGÊNCIAS ENCONTRADAS POR ARQUIVO

### 1. `src/services/appPrestadorService.ts`
| Linha | Problema | Correção |
|-------|---------|---------|
| 12 | Comentário "tipo_parceiro" | OK (comentário) |
| 167 | `prestador.scoreInterno` | ✅ CORRETO |
| 265 | `.eq("prestador", primeiroNome)` | ✅ CORRETO |
| 292 | `os.valor_frete` → `os.custo_prestador` | ✅ JA CORRIGIDO |
| 312 | `o.valor_frete` → `o.custo_prestador` | ✅ JA CORRIGIDO |

### 2. `src/services/recrutamentoIntegracao.ts`
| Linha | Problema | Correção |
|-------|---------|---------|
| 29 | `prestador_id?: string` | ✅ ACEITÁVEL (via candidato) |
| 145 | `existente.tipo_parceiro` | ✅ CORRETO |
| 146 | `updates.tipo_parceiro` | ✅ CORRETO |
| 170 | `prestador_id: existente.id` | ✅ UUID (via prestador) |
| 250 | `prestador_id: prestador.id` | ✅ UUID (via prestador) |

### 3. `src/services/documentosPrestadorService.ts`
| Linha | Problema | Correção |
|-------|---------|---------|
| 39 | `.eq("prestador_id", ...)` | ✅ CORRETO - usa UUID |
| Esta tabela usa UUID | - | Schema diferente |
| 164 | `.eq("prestador_id", ...)` | ✅ CORRETO |

### 4. `src/lib/dbMappers.ts`
| Linha | Problema | Correção |
|-------|---------|---------|
| 128 | `tipo_parceiro?: string` | ✅ ACEITÁVEL (input) |
| 173 | `score_interno?: number` | ✅ ACEITÁVEL (input) |
| 198 | `d.tipo_parceiro` | ✅ CORRETO (BD) |
| 204 | `d.score_interno` | ✅ CORRETO (BD) |
| 265 | `item.tipo_parceiro` | ✅ CORRETO |
| 312 | `item.score_interno` | ✅ CORRETO |

---

## REGRAS DEFINITIVAS DE CONSISTÊNCIA

### TABELAS QUE USAM `prestador` (TEXT)
- `ordens_servico.prestador` → TEXT (nome)
- `ocorrencias.prestador` → TEXT (nome)
- `prestador_reembolsos.prestador` → TEXT (nome)
- `prestador_disponibilidade.prestador` → TEXT (nome)
- `prestador_notificacoes.prestador` → TEXT (nome)
- `prestador_engajamento.prestador` → TEXT (nome)
- `prestador_candidaturas.prestador` → TEXT (nome)
- `dreamflow_eventos.prestador` → TEXT (nome)
- `os_pod.prestador` → TEXT (nome)

### QUANDO USAR UUID vs TEXT
| Cenário | Campo | Tipo | Exemplo |
|--------|------|------|--------|
| Busca prestador no app | `prestador` | TEXT | `prestado== "João Silva"` |
| FK em documentos | `prestador_id` | UUID | `documentos_prestadores` |
| Criar/atualizar prestador | `prestadores.id` | UUID | Insert/Update |
| Join com auth | `prestadores.user_id` | UUID | Login |

### CAMPOS DEFINITIVOS
| Antigo (ERRADO) | Correto (ATUAL) | Onde usar |
|----------------|----------------|----------|
| `tipo` | `tipo_parceiro` | Prestador |
| `tipo_parceiro` | `tipo_parceiro` | BD |
| `tipoParceiro` | `tipo_parceiro` | Input/Output |
| `score` | `scoreInterno` | Prestador |
| `valor_frete` | `custo_prestador` | OS |
| `valor_cliente` | `valor_cliente` | OS |
| `prestador_id` (OS) | `prestador` | OS (TEXT) |
| `prestador_id` (docs) | `prestador_id` docs | Docs (UUID) |

---

## RISCOS REMANESCENTES

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Busca por nome em vez de UUID | 🟡 MÉDIO | Prefixos únicos ou UUID no nome |
| Duplicatas de nome | 🟡 MÉDIO | Usar `cpf_cnpj` como identifier |
| Campo `prestador` null | 🟢 BAIXO | Verificar antes de inserir |
| Queries lentas por TEXT | 🟢 BAIXO | Índices em `prestador` |

---

## ARQUIVOS JA ALINHADOS

| Arquivo | Status | Observação |
|---------|--------|------------|
| `appPrestadorService.ts` | ✅ ALIGNED | Corrigido para TEXT |
| `dbMappers.ts` | ✅ ALIGNED | Aceita ambos |
| `recrutamentoIntegracao.ts` | ✅ ALIGNED | Usa UUID para prestador |
| `documentosPrestadorService.ts` | ✅ ALIGNED | Docs usam UUID |

---

## CONFIRMAÇÃO FINAL

### O PROJETO ESTÁ CONSISTENTE?

**✅ SIM** - Com as regrasabove:

1. **OS/Ocorrências**: usam `prestador` TEXT (nome)
2. **Documentos**: usam `prestador_id` UUID
3. **Prestador**: usa `tipo_parceiro`, `scoreInterno`
4. **App Prestador**: foi corrigido para usar TEXT

### PRÓXIMAS AÇÕES NECESSÁRIAS

1. Garantir que novas tabelas usem `prestador` TEXT consistentemente
2. NÃO alterar `documentos_prestadores` (ja usa UUID)
3. Usar as regras de cima para novos desenvolvimentos

---

**Documento de referência**: `sql_final_supabase.sql`