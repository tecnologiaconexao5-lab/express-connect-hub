# ROTEIRO FINAL - EXECUÇÃO NO SUPABASE SQL EDITOR

## ✅ PREPARAÇÃO ANTES DE EXECUTAR

1. Acesse o Supabase SQL Editor
2. Clique em "New query"
3. Copie o bloco desejado
4. Execute

---

## 📋 ORDEM DE EXECUÇÃO RECOMENDADA

### BLOCO 1 - ALTER TABLE (Já existentes)
| # | Bloco | Campos | Complexity | Recomendação |
|---|------|-------|-----------|-------------|
| 1.1 | os_enderecos | 7 campos | 🟡 Média | Execute em produção |
| 1.2 | ocorrencias | 6 campos | 🟡 Média | Execute em produção |

### BLOCO 2 - Centrais do App
| # | Bloco | Novo? | Complexity | Executar |
|---|------|------|-----------|----------|
| 2.1 | prestador_acesso | ✅ SIM | 🟢 Baixa | **PRIMEIRO** |
| 2.2 | prestador_disponibilidade | ✅ SIM | 🟢 Baixa | Segundo |
| 2.3 | prestador_candidaturas | ✅ SIM | 🟢 Baixa | Terceiro |
| 2.4 | os_pod | ✅ SIM | 🟢 Baixa | Quarto |

### BLOCO 3 - Financeiros e Complementares
| # | Bloco | Novo? | Complexity | Executar |
|---|------|------|-----------|----------|
| 3.1 | prestador_reembolsos | ✅ SIM | 🟢 Baixa | Quinto |
| 3.2 | ABASTECIMENTOS | ⚠️ JÁ EXISTE | 🟡 Revisar | Skip |
| 3.3 | prestador_notificacoes | ✅ SIM | 🟢 Baixa | Sexto |

### BLOCO 4 - Config e Inteligência
| # | Bloco | Novo? | Complexity | Executar |
|---|------|------|-----------|----------|
| 4.1 | prestador_engajamento | ✅ SIM | 🟢 Baixa | Sétimo |
| 4.2 | app_config | ✅ SIM | 🟢 Baixa | Oitavo (com inserts) |
| 4.3 | dreamflow_eventos | ✅ SIM | 🟢 Baixa | Nono |

### BLOCO 5 - Realtime (Opcional)
| # | Bloco | Recomendação |
|---|------|---------------|
| 5.1 | Realtime tables | Apenas se necessária |

---

## 🚀 EXECUÇÃO RÁPIDA (ORDEM)

```sql
-- [1] Execute primeiro
-- prestador_acesso

-- [2] Segundo
-- prestador_disponibilidade

-- [3] Terceiro
-- prestador_candidaturas

-- [4] Quarto
-- os_pod

-- [5] Quinto
-- prestador_reembolsos

-- [6] Sexto
-- prestador_notificacoes

-- [7] Sétimo
-- prestador_engajamento

-- [8] Oitavo (inclui INSERTs)
-- app_config

-- [9] Nono
-- dreamflow_eventos
```

---

## ⚠️ BLOCO 1 (ALTER TABLE) - DETALHADO

O Bloco 1 tem linhas comentadas. Para ativar:

```sql
-- 1.1: os_enderecos
ALTER TABLE public.os_enderecos 
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric,
ADD COLUMN IF NOT EXISTS hora_chegada timestamptz,
ADD COLUMN IF NOT EXISTS hora_inicio timestamptz,
ADD COLUMN IF NOT EXISTS hora_fim timestamptz,
ADD COLUMN IF NOT EXISTS observacao text,
ADD COLUMN IF NOT EXISTS status_chegada text DEFAULT 'pendente';

CREATE INDEX IF NOT EXISTS idx_os_enderecos_coords 
  ON public.os_enderecos(latitude, longitude) 
  WHERE latitude IS NOT NULL;

-- 1.2: ocorrencias
ALTER TABLE public.ocorrencias
ADD COLUMN IF NOT EXISTS prestador_id uuid REFERENCES public.prestadores(id),
ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id),
ADD COLUMN IF NOT EXISTS fotos jsonb,
ADD COLUMN IF NOT EXISTS resolvida_por uuid REFERENCES public.usuarios(id),
ADD COLUMN IF NOT EXISTS nota_fiscal text,
ADD COLUMN IF NOT EXISTS impacto_valor numeric;

CREATE INDEX IF NOT EXISTS idx_ocorrencias_prestador 
  ON public.ocorrencias(prestador_id) 
  WHERE prestador_id IS NOT NULL;
```

---

## 🔄 SKIP (NÃO EXECUTAR)

| Tabela | Motivo |
|--------|-------|
| `public.abastecimentos` | Já existe em `combustiveis_schema.sql` |
| `public.tracking_eventos` | Ja existe em `tracking_schema.sql` |
| `public.notificacoes` | Já existe (genérica, para TMS) |

---

## ✅ VALIDAÇÃO PÓS-EXECUCÃO

Após executar, verifique:

```sql
-- Verificar tabelas criadas
SELECT 
  table_name,
  table_type 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name LIKE 'prestador%'
OR table_name IN ('os_pod', 'app_config', 'dreamflow_eventos')
ORDER BY table_name;
```

Resultado esperado:
- prestador_acesso
- prestador_disponibilidade
- prestador_candidaturas
- prestador_notificacoes
- prestador_engajamento
- prestador_reembolsos
- os_pod
- app_config
- dreamflow_eventos

---

## 📊 RESUMO EXECUTÁVEL

| Bloco | Tabelas Novas | Execute? |
|------|--------------|----------|
| 1 | 0ALTER | ✅ Sim |
| 2 | 4 | ✅ Sim |
| 3 | 2* | ✅ Sim |
| 4 | 3 | ✅ Sim |
| 5 | 0 | ⚠️ Opcional |

*Exclude prestador_notificacoes que é nova

**Total: ~9 tabelas novas + 2 ALTER TABLE**

---

## ⏱️ TEMPO ESTIMADO

- Bloco 1: ~30 segundos
- Bloco 2: ~30 segundos
- Bloco 3: ~20 segundos
- Bloco 4: ~20 segundos

**Total: ~2 minutos**

---

## 📦 PRÓXIMO PASSO

Após executar este SQL:
1. Execute o build do projeto: `npm run build`
2. Verifique se não há erros
3. O service está pronto para uso

---

**FIM DO ROTEIRO**